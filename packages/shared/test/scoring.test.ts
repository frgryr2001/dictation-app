import { describe, expect, it } from "vitest";
import { normalize, score, validateLesson } from "../src";
import sample from "../../../apps/web/public/lessons/sample.json";

describe("normalize", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalize("Hello, World!")).toEqual(["hello", "world"]);
  });
  it("expands reductions and contractions", () => {
    expect(normalize("I'm gonna go")).toEqual(["i", "am", "going", "to", "go"]);
    expect(normalize("They don't know")).toEqual(["they", "do", "not", "know"]);
  });
});

describe("score", () => {
  it("perfect answer", () => {
    const r = score("The city wants a new bridge.", "the city wants a new bridge");
    expect(r.accuracy).toBe(1);
    expect(r.missed).toEqual([]);
  });

  it("detects a dropped function word", () => {
    const r = score("The city wants a new bridge.", "city wants new bridge");
    expect(r.missed).toEqual(["the", "a"]);
    expect(r.ops.filter((o) => o.kind === "missed")).toHaveLength(2);
  });

  it("detects a mishear and an extra word", () => {
    const r = score("I want to go", "I want go to the");
    const kinds = r.ops.map((o) => o.kind);
    expect(kinds).toContain("extra");
    expect(r.accuracy).toBeLessThan(1);
  });

  it("treats reductions as equivalent", () => {
    expect(score("I want to leave", "i wanna leave").accuracy).toBe(1);
  });
});

describe("lesson contract", () => {
  it("sample lesson matches the schema", () => {
    expect(() => validateLesson(sample)).not.toThrow();
  });
  it("rejects overlapping sentences", () => {
    const bad = structuredClone(sample);
    bad.sentences[1].start = bad.sentences[0].start;
    expect(() => validateLesson(bad)).toThrow(/overlaps/);
  });
});
