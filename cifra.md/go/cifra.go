package cifra

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
//
// Outcome, Merge, MergeOutputs, ConflictsJSON, ResolveMarked and MarkerLines are
// implemented in merge.go and setlist_merge.go (spec §11), owned by
// cifra_go.merge.
