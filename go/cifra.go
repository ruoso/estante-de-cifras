package cifra

import "errors"

// ErrNotImplemented is returned by every corpus-facing operation until the
// task that owns it fills it in. The corpus harness runs each operation on
// every corpus entry; while an operation is a stub, its checks are named in the
// harness's expected-failures ledger, so the suite is green and the whole
// corpus surface is still executed.
var ErrNotImplemented = errors.New("cifra: not implemented")

// Outcome is the result of a merge. Its shape belongs to cifra_go.merge; for
// now it is a minimal placeholder the harness threads from Merge to
// MergeOutputs. Payload carries whatever the merge produced between those two
// calls; cifra_go.merge replaces it with the real fields.
type Outcome struct {
	Payload any
}

// Parse reads a song's text (bytes, which need not yet be known-good UTF-8 —
// the text layer validates that) into a model (spec §1 to §7). The only error it
// returns is non-UTF-8 input (NotUTF8Error); everything else unparseable is a
// diagnostic inside the model, never a Go error (§9.2). Implemented in parse.go
// and its sibling layers (chord.go, pitch.go, tuning.go, frets.go, layout.go);
// owned by cifra_go.reader.
func Parse(src []byte) (Model, error) {
	lines, err := prepare(src)
	if err != nil {
		return nil, err
	}
	p := &songParser{lines: lines}
	return p.run(), nil
}

// Write serialises a song model to its canonical text (spec §8), as
// serialize(canonical(model)). It refuses a model whose text would hold a line
// of git's conflict markers, returning a *MarkedTextError naming the first such
// line (§8.1). Implemented in write.go and layout.go; owned by cifra_go.writer.
func Write(model Model) ([]byte, error) {
	return writeModel(model)
}

// Canonical returns the model of the canonical form of a song model (spec §8.2,
// §8.3, §4.5): it drops what the canonical form does not keep, applies the
// footnote invariants I1 → I3 → I2, re-lays-out every sung line whose markers
// changed width, and re-derives bar numbers and repeat groups, leaving `sungAt`
// and `diagnostics` as they were. Implemented in write.go; owned by
// cifra_go.writer.
func Canonical(model Model) (Model, error) {
	return canonicalModel(model), nil
}

// IsCanonical reports whether a document's bytes are in canonical form (spec
// §9.1): a non-UTF-8 text is not a document (false), a text holding a marker
// line is never canonical (false), otherwise it is canonical when Write(Parse)
// gives it back byte for byte. The hook uses it to decide a push. Implemented in
// write.go; owned by cifra_go.writer.
func IsCanonical(text []byte) bool {
	return isCanonical(text)
}

// ParseSetlist, WriteSetlist and CanonicalSetlist are implemented in
// setlist.go (spec §10), owned by cifra_go.setlists.

// Merge merges three inputs of a song or a setlist (spec §11); a nil input is
// an absent side. Stub; owned by cifra_go.merge.
func Merge(base, ours, theirs []byte, setlist bool) (Outcome, error) {
	return Outcome{}, ErrNotImplemented
}

// MergeOutputs turns a merge Outcome into the files a merge entry stores
// (result, result.deleted, conflicts.json, marked), keyed by file name. Stub;
// owned by cifra_go.merge.
func MergeOutputs(outcome Outcome, setlist bool) (map[string][]byte, error) {
	return nil, ErrNotImplemented
}
