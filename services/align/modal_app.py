"""Batch alignment on a serverless GPU (Modal).

Runs at ingest time only, never while a learner waits:
    mp3 URL -> WhisperX transcribe + forced alignment -> lesson JSON

Usage:
    pip install modal && modal setup
    modal run modal_app.py --audio-url https://.../clip.mp3 --lesson-id voa-001
"""

import json

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("whisperx==3.3.1", "requests")
    .add_local_python_source("lesson")
)

app = modal.App("dictation-align", image=image)


@app.function(gpu="T4", timeout=900)
def align(audio_url: str, lesson_id: str, source: str = "VOA Learning English") -> dict:
    import tempfile

    import requests
    import whisperx

    from lesson import to_lesson

    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        resp = requests.get(audio_url, timeout=120)
        resp.raise_for_status()
        f.write(resp.content)
        f.flush()

        device = "cuda"
        audio = whisperx.load_audio(f.name)
        model = whisperx.load_model("large-v3", device, compute_type="float16", language="en")
        result = model.transcribe(audio, batch_size=16)

        align_model, metadata = whisperx.load_align_model(language_code="en", device=device)
        aligned = whisperx.align(
            result["segments"], align_model, metadata, audio, device, return_char_alignments=False
        )

    return to_lesson(aligned, lesson_id=lesson_id, audio_url=audio_url, source=source)


@app.local_entrypoint()
def main(audio_url: str, lesson_id: str, out: str = ""):
    lesson = align.remote(audio_url, lesson_id)
    path = out or f"{lesson_id}.json"
    with open(path, "w") as fh:
        json.dump(lesson, fh, indent=2, ensure_ascii=False)
    print(f"wrote {path}: {len(lesson['sentences'])} sentences")
