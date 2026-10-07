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
// the text layer validates that) into a model. Stub; owned by cifra_go.reader.
func Parse(src []byte) (Model, error) {
	return nil, ErrNotImplemented
}

// Write serialises a song model to its canonical text (spec §8). It refuses a
// marked text. Stub; owned by cifra_go.writer.
func Write(model Model) ([]byte, error) {
	return nil, ErrNotImplemented
}

// Canonical returns the model of the canonical form of a song model (spec §8.2,
// §8.3, §4.5). Stub; owned by cifra_go.writer.
func Canonical(model Model) (Model, error) {
	return nil, ErrNotImplemented
}

// ParseSetlist reads a setlist's text into a model (spec §10.6). Stub; owned by
// cifra_go.setlists.
func ParseSetlist(src []byte) (Model, error) {
	return nil, ErrNotImplemented
}

// WriteSetlist serialises a setlist model to its canonical text (spec §10.9).
// Stub; owned by cifra_go.setlists.
func WriteSetlist(model Model) ([]byte, error) {
	return nil, ErrNotImplemented
}

// CanonicalSetlist returns the model of the canonical form of a setlist model.
// Stub; owned by cifra_go.setlists.
func CanonicalSetlist(model Model) (Model, error) {
	return nil, ErrNotImplemented
}

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
