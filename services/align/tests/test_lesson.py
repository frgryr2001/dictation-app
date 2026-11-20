"""Golden tests for the alignment -> lesson conversion.

`fixtures/whisperx_output.json` is a recorded WhisperX result. When the real
pipeline is re-run, save its output over the fixture and the golden check
fails CI if any sentence boundary moves more than DRIFT_TOLERANCE.
"""

import json
from pathlib import Path

import pytest

from lesson import max_drift, to_lesson

FIXTURES = Path(__file__).parent / "fixtures"
DRIFT_TOLERANCE = 0.150  # seconds


def load(name):
    return json.loads((FIXTURES / name).read_text())


def build():
    return to_lesson(
        load("whisperx_output.json"),
        lesson_id="golden-001",
        audio_url="/audio/sample.mp3",
        source="fixture",
        level="B1",
    )


def test_matches_golden_within_drift():
    assert max_drift(build(), load("golden_lesson.json")) <= DRIFT_TOLERANCE


def test_sentence_indices_and_order():
    s = build()["sentences"]
    assert [x["i"] for x in s] == list(range(len(s)))
    for prev, cur in zip(s, s[1:]):
        assert prev["end"] <= cur["start"], "sentences must not overlap"


def test_skips_empty_and_too_short_segments():
    texts = [x["text"] for x in build()["sentences"]]
    assert "" not in texts
    assert "Uh." not in texts  # 0.1s blip in the fixture


def test_words_without_timestamps_are_dropped_but_text_kept():
    s = build()["sentences"][1]
    assert "2,000" in s["text"]
    assert all("s" in w and "e" in w for w in s["words"])


def test_drift_detects_text_regression():
    bad = build()
    bad["sentences"][0]["text"] = "something else"
    with pytest.raises(AssertionError):
        max_drift(bad, load("golden_lesson.json"))
