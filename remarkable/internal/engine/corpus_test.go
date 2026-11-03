package engine

// integration — the format's conformance corpus (cifra.md/corpus/NN-*/
// input.cifra.md) read by the built device bundle in goja, as the reader
// reads a song it opens (design §4.1, §6 105 sheet): every song at all
// twelve keys with the example book's instrument loaded, each call under a
// deadline, then every chord the table lacked filled as the background
// search fills it (§4.6, 108 shapes). A call that throws, hangs or answers a
// sheet at the wrong key fails — any of which leaves the song screen blank.
// The corpus is the format's edge cases (an empty song, unclosed fences,
// unknown tokens, CRLF and a BOM, ambiguities), so it reaches where the
// fixture books do not.

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// corpusDir is the format's corpus (cifra.md is a subtree of this repository).
const corpusDir = "../../../cifra.md/corpus"

// callBudget bounds one call. The desktop answers in milliseconds; the rM2
// is roughly ten times slower, and a reading call there must stay well under
// a second (§4.2), so a call over this on the host is a hang or a regression.
const callBudget = 2 * time.Second

// corpusSongs lists the corpus's song inputs (not its setlists or merges).
func corpusSongs(t *testing.T) map[string]string {
	t.Helper()
	paths, err := filepath.Glob(filepath.Join(corpusDir, "[0-9][0-9]-*", "input.cifra.md"))
	if err != nil {
		t.Fatal(err)
	}
	if len(paths) < 30 {
		t.Fatalf("found %d corpus songs under %s, want the corpus", len(paths), corpusDir)
	}
	songs := map[string]string{}
	for _, p := range paths {
		raw, err := os.ReadFile(p)
		if err != nil {
			t.Fatal(err)
		}
		songs[filepath.Base(filepath.Dir(p))] = string(raw)
	}
	return songs
}

func TestCorpusSheets(t *testing.T) {
	f := readFixture(t, "example-book.default-shapes.json")
	e := openBuilt(t)
	if _, err := e.Load(context.Background(), f.Entry, f.Table); err != nil {
		t.Fatalf("Load: %v", err)
	}
	for name, text := range corpusSongs(t) {
		t.Run(name, func(t *testing.T) {
			for k := range 12 {
				ctx, cancel := context.WithTimeout(context.Background(), callBudget)
				start := time.Now()
				got, err := e.Sheet(ctx, text, k, SheetOptions{})
				took := time.Since(start)
				cancel()
				if err != nil {
					t.Fatalf("offset %d: Sheet after %v: %v", k, took, err)
				}
				if got.Offset != k {
					t.Errorf("offset %d: the sheet is at offset %d", k, got.Offset)
				}
			}
		})
	}

	// The background search: every chord the table lacked is filled, each
	// within the budget, and none is missed twice.
	ctx := context.Background()
	misses, err := e.Misses(ctx)
	if err != nil {
		t.Fatalf("Misses: %v", err)
	}
	for _, m := range misses {
		fctx, cancel := context.WithTimeout(ctx, callBudget)
		start := time.Now()
		_, err := e.Fill(fctx, m.Chord)
		took := time.Since(start)
		cancel()
		if err != nil {
			t.Errorf("Fill %q after %v: %v", m.Chord, took, err)
		}
	}
	again, err := e.Misses(ctx)
	if err != nil {
		t.Fatalf("Misses: %v", err)
	}
	if len(again) != 0 {
		t.Errorf("%d chords still missed after filling every one: %v", len(again), again)
	}
}
