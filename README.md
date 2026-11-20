# Dictation

Hear a real English sentence, type what you hear, and see exactly which words your ear missed.

## Structure

```
apps/web/           Next.js app: sentence player + diff UI (client-side scoring)
packages/shared/    Lesson JSON contract + word-level scoring (TypeScript)
services/align/     WhisperX forced alignment on Modal (Python, batch at ingest)
```

The **lesson JSON** (`packages/shared/src/lesson.schema.ts`) is the contract
between the alignment service and the web app. Each side can be built and tested
on its own.

## How it works

- **Alignment runs at ingest, never while the learner waits.** You give it an
  mp3 URL, WhisperX runs on a serverless GPU, and the result is saved as JSON
  with sentence and word timestamps.
- **Playback** seeks to a sentence's `start` and pauses at its `end`, so there
  is no need to slice the audio files.
- **Scoring** runs in the browser. Both texts are normalized (case,
  punctuation, `gonna` → `going to`), then a word-level Levenshtein alignment
  labels each word as correct, misheard, missed, or extra.
- **CI** includes a golden test that fails if a sentence boundary drifts more
  than 150 ms.

## Run locally

```bash
pnpm install
pnpm dev            # http://localhost:3000 — plays the bundled sample lesson
pnpm test           # scoring + contract tests
cd services/align && pip install -r requirements-dev.txt && pytest -q tests
```

The bundled `sample.mp3` is synthetic speech (espeak-ng). Its word timings are
approximate and only exist so the demo runs. Real lessons come from the
alignment service.

## Generate a real lesson

```bash
pip install modal && modal setup
cd services/align
modal run modal_app.py --audio-url https://example.com/clip.mp3 --lesson-id voa-001
# writes voa-001.json → copy to apps/web/public/lessons/
```

Use public-domain sources such as VOA Learning English or LibriVox.

## Roadmap

- [ ] Lesson picker and a VOA ingest script
- [ ] Track missed words across sessions and replay your weak spots
- [ ] Offline cache (IndexedDB + Cache API)
- [ ] Audio on Cloudflare R2 behind a CDN
