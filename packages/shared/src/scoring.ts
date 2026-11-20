/**
 * Word-level dictation scoring.
 *
 * 1. normalize(): lowercase, strip punctuation, expand contractions/reductions
 *    so "gonna" and "going to" count as the same thing.
 * 2. alignWords(): Levenshtein alignment on word tokens (not characters),
 *    then backtrack to label every word: correct / wrong / missed / extra.
 */

const EXPANSIONS: Record<string, string> = {
  gonna: "going to",
  wanna: "want to",
  gotta: "got to",
  "can't": "can not",
  cannot: "can not",
  "won't": "will not",
  "i'm": "i am",
  "it's": "it is",
  "that's": "that is",
  "there's": "there is",
  "what's": "what is",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "i've": "i have",
  "we've": "we have",
  "you've": "you have",
  "i'll": "i will",
  "you'll": "you will",
  "we'll": "we will",
  "i'd": "i would",
};

export function normalize(text: string): string[] {
  let t = text.toLowerCase().replace(/[’‘]/g, "'");
  t = t
    .split(/\s+/)
    .map((tok) => tok.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ""))
    .map((tok) => {
      if (EXPANSIONS[tok]) return EXPANSIONS[tok];
      if (tok.endsWith("n't")) return tok.slice(0, -3) + " not";
      return tok;
    })
    .join(" ");
  return t
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export type Op =
  | { kind: "correct"; ref: string; hyp: string }
  | { kind: "wrong"; ref: string; hyp: string }
  | { kind: "missed"; ref: string }
  | { kind: "extra"; hyp: string };

export interface ScoreResult {
  ops: Op[];
  accuracy: number; // correct / reference words, 0..1
  missed: string[]; // reference words the learner didn't get
}

/** O(n*m) DP — sentences are short, so this is instant in the browser. */
export function alignWords(ref: string[], hyp: string[]): Op[] {
  const n = ref.length;
  const m = hyp.length;
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j - 1] + sub, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }

  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const sub = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + sub) {
        ops.push(
          sub === 0
            ? { kind: "correct", ref: ref[i - 1], hyp: hyp[j - 1] }
            : { kind: "wrong", ref: ref[i - 1], hyp: hyp[j - 1] },
        );
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ kind: "missed", ref: ref[i - 1] });
      i--;
    } else {
      ops.push({ kind: "extra", hyp: hyp[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

export function score(reference: string, typed: string): ScoreResult {
  const ref = normalize(reference);
  const hyp = normalize(typed);
  const ops = alignWords(ref, hyp);
  const correct = ops.filter((o) => o.kind === "correct").length;
  const missed = ops.flatMap((o) =>
    o.kind === "missed" || o.kind === "wrong" ? [o.ref] : [],
  );
  return { ops, accuracy: ref.length ? correct / ref.length : 1, missed };
}
