// unknownTokens — where the reader's unknown tokens stand in the source (spec
// §2.9: "a reader SHOULD make the distinct unknown symbols of a document
// available"; §1.7.2 for what follows a bracket heading). Pins the export's
// contract for the app's editor marks (songs.unknown_tokens_loud refinement
// §Acceptance 1): every token in source order as {text, line, column}, each
// equal to its source slice, and exactly the model's `unknown` items. No one's
// copyrighted words appear.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, test, expect } from "vitest";

import { parse, prepare, unknownTokens } from "../src/index.js";

const fenced = (t) => "# Tarde Clara\n\n```\n" + t + "\n```\n";

// Count every `unknown` item of a model.
function unknownItems(doc) {
  let n = 0;
  for (const s of doc.sections)
    for (const p of s.body)
      if (p.type === "music")
        for (const l of p.lines) for (const m of l.measures || []) for (const it of m.items) if (it.type === "unknown") n += 1;
  return n;
}

describe("unknownTokens (§2.9)", () => {
  test("bracket chords: the heading's name is a section, what follows is two unknown tokens (§1.7.2)", () => {
    expect(unknownTokens(fenced("[Am]Teste [G]linha"))).toEqual([
      { text: "Teste", line: 4, column: 4 },
      { text: "[G]linha", line: 4, column: 10 },
    ]);
  });

  test("an annotation the format does not define, inside a bar", () => {
    expect(unknownTokens(fenced("| G | rit. |"))).toEqual([{ text: "rit.", line: 4, column: 6 }]);
  });

  test("a word in a run of chords", () => {
    expect(unknownTokens(fenced("G C fine"))).toEqual([{ text: "fine", line: 4, column: 4 }]);
  });

  test("(solo) is kept as one token", () => {
    expect(unknownTokens(fenced("| G | (solo) |"))).toEqual([{ text: "(solo)", line: 4, column: 6 }]);
  });

  test("an ending no repeat claims is demoted to an unknown token", () => {
    const doc = fenced("| 1. G | C |");
    expect(unknownItems(parse(doc))).toBe(1);
    expect(unknownTokens(doc)).toEqual([{ text: "1.", line: 4, column: 2 }]);
  });

  test("a word in a chord line over words, in a sung song", () => {
    const doc = fenced("| G   | fine\nTarde clara de verão");
    expect(parse(doc).sung).toBe(true);
    expect(unknownTokens(doc)).toEqual([{ text: "fine", line: 4, column: 8 }]);
  });

  test("a fenced line of words with no chords above it is a line of unknown tokens", () => {
    expect(unknownTokens(fenced("Teste linha")).map((t) => [t.text, t.column])).toEqual([
      ["Teste", 0],
      ["linha", 6],
    ]);
  });

  test("a bracket heading's tokens are offset by the heading, after its count too", () => {
    expect(unknownTokens(fenced("[Refrão]  G  rit."))).toEqual([{ text: "rit.", line: 4, column: 13 }]);
  });

  test("a clean chart has none", () => {
    expect(unknownTokens(fenced("| G | C | D7 | G |"))).toEqual([]);
  });

  test("text outside a fence is notes, not music", () => {
    expect(unknownTokens("# Tarde Clara\n\nTeste linha fine\n")).toEqual([]);
  });

});

// Over every corpus input: each token is its source slice, and there are as
// many as the model has unknown items (the export's contract against the
// corpus, spec §2.9).
describe("unknownTokens over the corpus", () => {
  const corpusDir = fileURLToPath(new URL("../../corpus/", import.meta.url));
  const inputs = readdirSync(corpusDir)
    .map((d) => join(corpusDir, d, "input.cifra.md"))
    .filter((f) => existsSync(f));

  test("the corpus has inputs", () => {
    expect(inputs.length).toBeGreaterThan(0);
  });

  for (const file of inputs) {
    test(file.slice(corpusDir.length), () => {
      const bytes = readFileSync(file);
      let doc;
      try {
        doc = parse(bytes);
      } catch {
        // not UTF-8: no document, so no tokens (the text layer refuses both)
        expect(() => unknownTokens(bytes)).toThrow();
        return;
      }
      const lines = prepare(bytes);
      const tokens = unknownTokens(bytes);
      for (const t of tokens) expect(lines[t.line - 1].slice(t.column, t.column + t.text.length)).toBe(t.text);
      expect(tokens.length).toBe(unknownItems(doc));
    });
  }
});
