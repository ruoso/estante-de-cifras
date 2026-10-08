package cifra

// The text layer (spec §1.3), shared by songs and setlists (§10.2). A port of
// the reference's reference/cifra_md/text.py — never imported from it:
// agreement is by the corpus, not shared code (DIRECTION §3.6).
//
// It lives here, a neutral document-wide primitive, so the later
// cifra_go.reader stands on this one shared implementation rather than a
// private copy (cifra_go.setlists refinement §Decisions). Zero third-party
// runtime dependency beyond golang.org/x/text/unicode/norm for NFC, which the
// spec requires and the Go standard library does not provide; UTF-8 decoding
// and line handling are stdlib.

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

// NotUTF8Error reports input that is not valid UTF-8: not a document, and never
// rewritten (§1.3 step 1). Mirrors the reference's NotUTF8Error.
type NotUTF8Error struct{ Byte int }

func (e *NotUTF8Error) Error() string {
	return "cifra: not valid UTF-8"
}

// lineEnd ends a line at LF, at CR LF, or at a lone CR. CR LF is listed first so
// the pair is consumed as one terminator, not two (§1.3). The terminator is not
// part of the line.
var lineEnd = regexp.MustCompile("\r\n|\r|\n")

// prepare returns the lines of a document, prepared in the order §1.3 gives —
// the order is observable, so it is followed exactly:
//
//  1. reject non-UTF-8 bytes (never rewritten);
//  2. remove every U+FEFF — a byte order mark at the start and anywhere else,
//     so none can come to begin a canonical text;
//  3. normalise to NFC, before the split so a recomposition cannot move a line
//     boundary;
//  4. split at LF, CR LF, or a lone CR; a terminator at the very end does not
//     begin another line; the empty text is zero lines;
//  5. replace each tab with exactly one space — never a run to a tab stop;
//  6. strip trailing U+0020 from each line — only U+0020, never U+00A0 or any
//     other Unicode whitespace.
func prepare(data []byte) ([]string, error) {
	if !utf8.Valid(data) {
		return nil, &NotUTF8Error{Byte: firstInvalidUTF8(data)}
	}
	text := string(data)
	text = strings.ReplaceAll(text, "\ufeff", "")
	text = norm.NFC.String(text)
	if text == "" {
		return []string{}, nil
	}
	lines := lineEnd.Split(text, -1)
	if lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	for i, ln := range lines {
		lines[i] = strings.TrimRight(strings.ReplaceAll(ln, "\t", " "), " ")
	}
	return lines, nil
}

// Prepare is the exported text layer (§1.3) for the corpus harness's /tl check,
// mirroring the reference's prepare and the JS twin's impl.prepare: the prepared
// lines of a document, or NotUTF8Error for non-UTF-8 input. The reader uses the
// unexported prepare directly.
func Prepare(data []byte) ([]string, error) {
	return prepare(data)
}

// markers are git's conflict markers (§11.12.3).
var markers = [4]string{"<<<<<<<", "=======", ">>>>>>>", "|||||||"}

// isMarkerLine reports a line of git's conflict markers: one of the four, alone
// or followed by a space and anything (§11.12.3). `line` is a prepared line
// (§1.3). Mirrors the reference's is_marker_line.
func isMarkerLine(line string) bool {
	for _, m := range markers {
		if line == m || strings.HasPrefix(line, m+" ") {
			return true
		}
	}
	return false
}

// firstInvalidUTF8 reports the byte offset of the first ill-formed UTF-8
// sequence, for the error's detail.
func firstInvalidUTF8(data []byte) int {
	for i := 0; i < len(data); {
		r, size := utf8.DecodeRune(data[i:])
		if r == utf8.RuneError && size == 1 {
			return i
		}
		i += size
	}
	return len(data)
}
