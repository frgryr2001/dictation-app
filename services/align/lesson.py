"""Pure conversion: WhisperX aligned output -> lesson JSON.

No GPU or heavy deps here, so it runs in CI. Must stay in sync with
packages/shared/src/lesson.schema.ts.
"""

from __future__ import annotations

import re
from typing import Any

MIN_SENTENCE_SECONDS = 0.3


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def to_lesson(
    aligned: dict[str, Any],
    *,
    lesson_id: str,
    audio_url: str,
    source: str,
    level: str | None = None,
) -> dict[str, Any]:
    """Convert `whisperx.align(...)` output into the lesson contract.

    WhisperX words occasionally lack timestamps (numbers, symbols). Those
    words are kept in the text but dropped from `words`; sentence bounds come
    from the segment itself.
    """
    sentences: list[dict[str, Any]] = []
    prev_end = 0.0

    for seg in aligned.get("segments", []):
        text = _clean(seg.get("text", ""))
        start, end = seg.get("start"), seg.get("end")
        if not text or start is None or end is None:
            continue
        start = max(float(start), prev_end)  # never overlap previous sentence
        end = float(end)
        if end - start < MIN_SENTENCE_SECONDS:
            continue

        words = [
            {"w": w["word"].strip(), "s": round(w["start"], 3), "e": round(w["end"], 3)}
            for w in seg.get("words", [])
            if "start" in w and "end" in w and w.get("word", "").strip()
        ]
        sentences.append(
            {
                "i": len(sentences),
                "text": text,
                "start": round(start, 3),
                "end": round(end, 3),
                "words": words,
            }
        )
        prev_end = end

    lesson: dict[str, Any] = {
        "id": lesson_id,
        "audioUrl": audio_url,
        "source": source,
        "sentences": sentences,
    }
    if level:
        lesson["level"] = level
    return lesson


def max_drift(actual: dict[str, Any], expected: dict[str, Any]) -> float:
    """Largest sentence start/end difference (seconds) between two lessons.

    Raises if sentence count or text differs — that's a real regression,
    not drift.
    """
    a, e = actual["sentences"], expected["sentences"]
    if len(a) != len(e):
        raise AssertionError(f"sentence count {len(a)} != expected {len(e)}")
    drift = 0.0
    for sa, se in zip(a, e):
        if sa["text"] != se["text"]:
            raise AssertionError(f"text mismatch at {sa['i']}: {sa['text']!r} != {se['text']!r}")
        drift = max(drift, abs(sa["start"] - se["start"]), abs(sa["end"] - se["end"]))
    return drift
