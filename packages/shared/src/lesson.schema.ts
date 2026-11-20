/**
 * Lesson contract — the single source of truth between the alignment
 * service (Python, services/align) and the web app (apps/web).
 * Any change here must be mirrored in services/align/lesson.py.
 */

export interface Word {
  w: string; // word as spoken
  s: number; // start, seconds
  e: number; // end, seconds
}

export interface Sentence {
  i: number; // index in lesson
  text: string;
  start: number; // seconds
  end: number; // seconds
  words: Word[];
}

export interface Lesson {
  id: string;
  audioUrl: string;
  source: string;
  level?: "A2" | "B1" | "B2" | "C1";
  sentences: Sentence[];
}

/** Runtime validation for lesson JSON loaded over the network. */
export function validateLesson(data: unknown): Lesson {
  const fail = (msg: string): never => {
    throw new Error(`Invalid lesson: ${msg}`);
  };
  if (typeof data !== "object" || data === null) fail("not an object");
  const l = data as Record<string, unknown>;
  for (const key of ["id", "audioUrl", "source"]) {
    if (typeof l[key] !== "string") fail(`${key} must be a string`);
  }
  if (!Array.isArray(l.sentences)) fail("sentences must be an array");

  let prevEnd = -Infinity;
  (l.sentences as unknown[]).forEach((raw, idx) => {
    const s = raw as Sentence;
    if (s.i !== idx) fail(`sentence ${idx}: i must equal its index`);
    if (typeof s.text !== "string" || !s.text.trim()) fail(`sentence ${idx}: empty text`);
    if (!(s.start < s.end)) fail(`sentence ${idx}: start must be < end`);
    if (s.start < prevEnd) fail(`sentence ${idx}: overlaps previous sentence`);
    if (!Array.isArray(s.words)) fail(`sentence ${idx}: words must be an array`);
    prevEnd = s.end;
  });
  return data as Lesson;
}
