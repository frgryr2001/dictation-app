"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { score, validateLesson, type Lesson, type ScoreResult } from "@dictation/shared";

const LESSON_URL = "/lessons/sample.json";

export default function Page() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopAt = useRef<number | null>(null);

  useEffect(() => {
    fetch(LESSON_URL)
      .then((r) => r.json())
      .then((data) => setLesson(validateLesson(data)))
      .catch((e: Error) => setError(e.message));
  }, []);

  // Play only [start, end] of the current sentence — no file slicing needed.
  const play = useCallback(
    (rate = 1) => {
      const audio = audioRef.current;
      if (!audio || !lesson) return;
      const s = lesson.sentences[idx];
      audio.playbackRate = rate;
      audio.currentTime = s.start;
      stopAt.current = s.end;
      void audio.play();
    },
    [lesson, idx],
  );

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio && stopAt.current !== null && audio.currentTime >= stopAt.current) {
      audio.pause();
      stopAt.current = null;
    }
  };

  const check = () => {
    if (!lesson) return;
    setResult(score(lesson.sentences[idx].text, typed));
  };

  const next = () => {
    if (!lesson) return;
    setIdx((i) => Math.min(i + 1, lesson.sentences.length - 1));
    setTyped("");
    setResult(null);
  };

  if (error) return <main><p className="wrong">Failed to load lesson: {error}</p></main>;
  if (!lesson) return <main><p className="muted">Loading…</p></main>;

  const total = lesson.sentences.length;
  const isLast = idx === total - 1;

  return (
    <main>
      <h1>Dictation</h1>
      <p className="muted">
        {lesson.source} · sentence {idx + 1}/{total}
      </p>

      <audio ref={audioRef} src={lesson.audioUrl} preload="auto" onTimeUpdate={onTimeUpdate} />

      <div className="panel">
        <div className="row">
          <button onClick={() => play(1)}>▶ Play</button>
          <button className="ghost" onClick={() => play(0.75)}>🐢 0.75×</button>
        </div>

        <textarea
          placeholder="Type exactly what you hear… (Ctrl/⌘ + Enter to check)"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) check();
          }}
        />

        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={check} disabled={!typed.trim()}>Check</button>
          <button className="ghost" onClick={next} disabled={isLast || !result}>Next →</button>
        </div>

        {result && (
          <>
            <div className="score">{Math.round(result.accuracy * 100)}%</div>
            <div className="diff">
              {result.ops.map((op, k) => {
                if (op.kind === "correct") return <span key={k} className="w correct">{op.ref}</span>;
                if (op.kind === "missed") return <span key={k} className="w missed">{op.ref}</span>;
                if (op.kind === "extra") return <span key={k} className="w extra">{op.hyp}</span>;
                return (
                  <span key={k} className="w wrong" title={`you typed "${op.hyp}"`}>
                    {op.ref}
                  </span>
                );
              })}
            </div>
            <div className="legend muted">
              <span className="w correct">correct</span>
              <span className="w wrong">misheard</span>
              <span className="w missed">missed</span>
              <span className="w extra">extra</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
