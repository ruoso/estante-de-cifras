// Package corpus is the Go implementation's corpus harness: it holds package
// cifra to the reference corpus, byte for byte, in both directions. It is a
// check, re-implemented from the Python reference (reference/tools/corpus.py,
// reference/tests/test_corpus.py) and mirrored on the JavaScript twin
// (js/test/corpus/harness.js) — never shared code. It reads only the corpus
// bytes that Python generates and that every implementation is held to
// (DIRECTION §3.6); it imports neither the reference nor the JS package.
//
// This landing builds the reading checks (1–4 and 6) and a forward merge check
// for every entry, and drives each against an expected-failures ledger: a
// ledgered check must fail, an unledgered check must pass, and every check is
// run either way, so nothing is skipped and both a premature pass and a
// regression fail the gate. The text-layer (/tl) and per-chord (/chords)
// reading checks fall to cifra_go.reader, and the symmetry/canonicality/
// resolution/permutation merge checks to cifra_go.merge; they extend this
// harness and prune the ledger as they land.
package corpus

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	cifra "github.com/ruoso/cifra.md/go"
)

// Impl is the corpus-facing surface of an implementation, injected into the
// checks so the harness can be driven by the real stubbed package and, in its
// own unit tests, by synthetic fakes. The names mirror package cifra's
// operations.
type Impl interface {
	Parse(src []byte) (cifra.Model, error)
	Write(model cifra.Model) ([]byte, error)
	Canonical(model cifra.Model) (cifra.Model, error)
	ParseSetlist(src []byte) (cifra.Model, error)
	WriteSetlist(model cifra.Model) ([]byte, error)
	CanonicalSetlist(model cifra.Model) (cifra.Model, error)
	Merge(base, ours, theirs []byte, setlist bool) (cifra.Outcome, error)
	MergeOutputs(outcome cifra.Outcome, setlist bool) (map[string][]byte, error)
}

// ReadingEntry is a song or setlist reading entry: a directory under corpus/
// holding input / input.parsed.json / canonical / parsed.json. Kind is "song"
// or "setlist", fixing which reader and writer run and the text extension.
type ReadingEntry struct {
	Name string
	Dir  string
	Kind string
}

// MergeEntry is a merge entry: a directory under corpus/merge/.
type MergeEntry struct {
	Name string
	Dir  string
}

// Discovered is the corpus split into its reading and merge entries.
type Discovered struct {
	Reading []ReadingEntry
	Merge   []MergeEntry
}

// Check is one runnable corpus check. Run returns nil on a match and a non-nil
// error on any mismatch or when a stubbed operation is called. ID is the
// ledger id: "<entry>/<n>" for a reading check, "merge/<entry>/<n>" for a merge
// check.
type Check struct {
	ID  string
	Run func() error
}

// CorpusDir resolves the corpus directory from this source file's own path —
// the Go idiom for the JS harness's new URL("../../corpus/", import.meta.url).
// corpus/ is a sibling of go/, outside the module tree, so it cannot be
// embedded; resolving it this way needs no configuration and works from
// whatever checkout the gate points `go test` at.
func CorpusDir() string {
	_, file, _, _ := runtime.Caller(0) // <root>/go/internal/corpus/harness.go
	return filepath.Join(filepath.Dir(file), "..", "..", "..", "corpus")
}

// Discover lists the corpus exactly as the reference does (corpus.py lines
// 50–61): a subdirectory with input.cifra.md is a song reading entry, one with
// input.setlist.md a setlist reading entry (song checked first); every
// subdirectory of corpus/merge/ is a merge entry; both sorted by name. It finds
// every entry present, so a new corpus entry cannot be silently skipped.
func Discover(corpusDir string) (Discovered, error) {
	var d Discovered
	names, err := dirNames(corpusDir)
	if err != nil {
		return d, err
	}
	for _, name := range names {
		if name == "merge" {
			continue
		}
		dir := filepath.Join(corpusDir, name)
		if !isDir(dir) {
			continue
		}
		switch {
		case fileExists(filepath.Join(dir, "input.cifra.md")):
			d.Reading = append(d.Reading, ReadingEntry{Name: name, Dir: dir, Kind: "song"})
		case fileExists(filepath.Join(dir, "input.setlist.md")):
			d.Reading = append(d.Reading, ReadingEntry{Name: name, Dir: dir, Kind: "setlist"})
		}
	}
	mergeDir := filepath.Join(corpusDir, "merge")
	if isDir(mergeDir) {
		mergeNames, err := dirNames(mergeDir)
		if err != nil {
			return d, err
		}
		for _, name := range mergeNames {
			dir := filepath.Join(mergeDir, name)
			if isDir(dir) {
				d.Merge = append(d.Merge, MergeEntry{Name: name, Dir: dir})
			}
		}
	}
	return d, nil
}

// Dump serialises a model the one pinned way: cifra.Encode (json.dumps-
// equivalent) plus the single trailing newline the corpus files carry.
func Dump(model any) []byte {
	return append(cifra.Encode(model), '\n')
}

// ReadingChecks returns the reading checks for an entry: 1–4 and 6 (the text-
// layer and chord checks are cifra_go.reader's). For a setlist it uses the
// setlist reader and writer; for a song the song reader and writer.
//
//  1. Parse(input) serialised == input.parsed.json
//  2. Write(model of input.parsed.json) == canonical
//  3. Parse(canonical) serialised == parsed.json
//  4. Write(model of parsed.json) == canonical
//  6. Canonical(model of input.parsed.json) == model of parsed.json, each
//     without diagnostics and sungAt
func ReadingChecks(entry ReadingEntry, impl Impl) []Check {
	parse, write, canonical := impl.Parse, impl.Write, impl.Canonical
	ext := ".cifra.md"
	if entry.Kind == "setlist" {
		parse, write, canonical = impl.ParseSetlist, impl.WriteSetlist, impl.CanonicalSetlist
		ext = ".setlist.md"
	}
	id := func(n string) string { return entry.Name + "/" + n }
	bytesOf := func(name string) ([]byte, error) { return os.ReadFile(filepath.Join(entry.Dir, name)) }
	modelOf := func(name string) (cifra.Model, error) {
		b, err := bytesOf(name)
		if err != nil {
			return nil, err
		}
		return cifra.DecodeModel(b)
	}
	inputText := "input" + ext
	canonicalText := "canonical" + ext

	return []Check{
		{ID: id("1"), Run: func() error {
			src, err := bytesOf(inputText)
			if err != nil {
				return err
			}
			model, err := parse(src)
			if err != nil {
				return err
			}
			return compareModelBytes(model, bytesOrNil(bytesOf("input.parsed.json")), id("1"))
		}},
		{ID: id("2"), Run: func() error {
			model, err := modelOf("input.parsed.json")
			if err != nil {
				return err
			}
			got, err := write(model)
			if err != nil {
				return err
			}
			return compareBytes(got, bytesOrNil(bytesOf(canonicalText)), id("2"))
		}},
		{ID: id("3"), Run: func() error {
			src, err := bytesOf(canonicalText)
			if err != nil {
				return err
			}
			model, err := parse(src)
			if err != nil {
				return err
			}
			return compareModelBytes(model, bytesOrNil(bytesOf("parsed.json")), id("3"))
		}},
		{ID: id("4"), Run: func() error {
			model, err := modelOf("parsed.json")
			if err != nil {
				return err
			}
			got, err := write(model)
			if err != nil {
				return err
			}
			return compareBytes(got, bytesOrNil(bytesOf(canonicalText)), id("4"))
		}},
		{ID: id("6"), Run: func() error {
			input, err := modelOf("input.parsed.json")
			if err != nil {
				return err
			}
			got, err := canonical(input)
			if err != nil {
				return err
			}
			want, err := modelOf("parsed.json")
			if err != nil {
				return err
			}
			return compareBytes(
				Dump(stripModel(got)),
				Dump(stripModel(want)),
				id("6"),
			)
		}},
	}
}

// mergeOutputNames are the four files a merge entry may store as its outcome,
// for the entry's extension. "asymmetric" is a hand-written input marker, never
// an output.
func mergeOutputNames(ext string) []string {
	return []string{"result" + ext, "result.deleted", "conflicts.json", "marked" + ext}
}

// MergeChecks returns the forward merge check for an entry (the fuller
// symmetry, canonicality, resolution and permutation checks are
// cifra_go.merge's): merging base, ours and theirs gives exactly the entry's
// stored output files, byte for byte, and no other.
func MergeChecks(entry MergeEntry, impl Impl) []Check {
	ext := mergeExtension(entry.Dir)
	setlist := ext == ".setlist.md"
	id := func(n string) string { return "merge/" + entry.Name + "/" + n }

	return []Check{
		{ID: id("1"), Run: func() error {
			inputs := mergeInputs(entry.Dir, ext)
			outcome, err := impl.Merge(inputs[0], inputs[1], inputs[2], setlist)
			if err != nil {
				return err
			}
			produced, err := impl.MergeOutputs(outcome, setlist)
			if err != nil {
				return err
			}
			for name, data := range produced {
				path := filepath.Join(entry.Dir, name)
				stored, err := os.ReadFile(path)
				if err != nil {
					return fmt.Errorf("%s: merge produced %s, which the entry does not have", id("1"), name)
				}
				if err := compareBytes(data, stored, id("1")+" ["+name+"]"); err != nil {
					return err
				}
			}
			for _, name := range mergeOutputNames(ext) {
				if _, ok := produced[name]; ok {
					continue
				}
				if fileExists(filepath.Join(entry.Dir, name)) {
					return fmt.Errorf("%s: the entry has %s, which the merge did not produce", id("1"), name)
				}
			}
			return nil
		}},
	}
}

// StaleLedgerIds returns the ledger ids that name no discovered check, forcing
// the ledger to track the corpus: a renamed or removed check leaves a stale id
// that fails the harness.
func StaleLedgerIds(ledger []string, checkIDs map[string]bool) []string {
	stale := []string{}
	for _, id := range ledger {
		if !checkIDs[id] {
			stale = append(stale, id)
		}
	}
	return stale
}

// stripModel drops the top-level diagnostics and sungAt keys, which describe a
// text, not a model, for the sixth check.
func stripModel(model cifra.Model) cifra.Model {
	if model == nil {
		return model
	}
	return model.Without("diagnostics", "sungAt")
}

func compareBytes(actual, expected []byte, label string) error {
	if bytes.Equal(actual, expected) {
		return nil
	}
	return fmt.Errorf("%s: %d bytes differ from the expected %d", label, len(actual), len(expected))
}

func compareModelBytes(model cifra.Model, expected []byte, label string) error {
	return compareBytes(Dump(model), expected, label)
}

// bytesOrNil discards the error from a corpus read so a check can compare
// against the empty value when a stored file is missing — a missing file is a
// legitimate mismatch, not a harness fault, and is reported as a byte
// difference by compareBytes.
func bytesOrNil(data []byte, _ error) []byte { return data }

// mergeExtension is ".setlist.md" when the entry holds any *.setlist.md file,
// else ".cifra.md" (corpus.py extension()).
func mergeExtension(dir string) string {
	names, err := dirNames(dir)
	if err != nil {
		return ".cifra.md"
	}
	for _, name := range names {
		if strings.HasSuffix(name, ".setlist.md") {
			return ".setlist.md"
		}
	}
	return ".cifra.md"
}

// mergeInputs reads base, ours and theirs for the entry's extension, in that
// fixed order; a missing side is nil (an absent input). Inputs are read as raw
// bytes — a merge input need not be UTF-8.
func mergeInputs(dir, ext string) [3][]byte {
	var out [3][]byte
	for i, side := range [3]string{"base", "ours", "theirs"} {
		path := filepath.Join(dir, side+ext)
		if data, err := os.ReadFile(path); err == nil {
			out[i] = data
		}
	}
	return out
}

func dirNames(dir string) ([]string, error) {
	ents, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(ents))
	for _, e := range ents {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	return names, nil
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
