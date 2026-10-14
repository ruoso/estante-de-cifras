package cifra

// Unit tests for the §1.3 / §10.2 text layer on purpose-written text. Pins §10.2
// and §1.3 as chapter 10 uses them (cifra_go.setlists refinement, unit level):
// non-UTF-8 rejected and reported; U+FEFF removed; NFC applied; lines split at
// LF, CR LF and a lone CR; tabs → one space; trailing U+0020 stripped; the empty
// text → no lines.

import (
	"errors"
	"reflect"
	"testing"
)

func mustPrepare(t *testing.T, data []byte) []string {
	t.Helper()
	lines, err := prepare(data)
	if err != nil {
		t.Fatalf("prepare: unexpected error %v", err)
	}
	return lines
}

func TestPrepareRejectsNonUTF8(t *testing.T) {
	// A lone 0xFF is never valid UTF-8 (§1.3 step 1): rejected, never rewritten.
	_, err := prepare([]byte{0x41, 0xFF, 0x42})
	if err == nil {
		t.Fatalf("prepare accepted non-UTF-8 input")
	}
	var nu *NotUTF8Error
	if !errors.As(err, &nu) {
		t.Fatalf("prepare error is %T, want *NotUTF8Error", err)
	}
}

func TestPrepareRemovesBOM(t *testing.T) {
	// A BOM at the start and in the middle are both removed (§1.3 step 2).
	lines := mustPrepare(t, []byte("\ufeffone\ufefftwo"))
	if want := []string{"onetwo"}; !reflect.DeepEqual(lines, want) {
		t.Fatalf("got %q, want %q", lines, want)
	}
}

func TestPrepareNormalisesToNFC(t *testing.T) {
	// "e" + combining acute (NFD) composes to "é" (NFC) before anything else
	// reads the text (§1.3 step 3).
	lines := mustPrepare(t, []byte("Café"))
	if want := []string{"Café"}; !reflect.DeepEqual(lines, want) {
		t.Fatalf("got %q, want %q", lines, want)
	}
}

func TestPrepareSplitsLineEndings(t *testing.T) {
	// LF, CR LF and a lone CR each end a line; a terminator at the very end does
	// not begin another (§1.3 step 4).
	lines := mustPrepare(t, []byte("a\nb\r\nc\rd\n"))
	if want := []string{"a", "b", "c", "d"}; !reflect.DeepEqual(lines, want) {
		t.Fatalf("got %q, want %q", lines, want)
	}
}

func TestPrepareReplacesTabsWithOneSpace(t *testing.T) {
	// Each tab becomes exactly one space, never a run to a tab stop (§1.3 step 5).
	lines := mustPrepare(t, []byte("a\t\tb"))
	if want := []string{"a  b"}; !reflect.DeepEqual(lines, want) {
		t.Fatalf("got %q, want %q", lines, want)
	}
}

func TestPrepareStripsTrailingSpaces(t *testing.T) {
	// Only trailing U+0020 is stripped, never U+00A0 or other whitespace (§1.3
	// step 6). The non-breaking space here is kept.
	lines := mustPrepare(t, []byte("a  \n b "))
	if want := []string{"a", " b "}; !reflect.DeepEqual(lines, want) {
		t.Fatalf("got %q, want %q", lines, want)
	}
}

func TestPrepareEmptyTextIsNoLines(t *testing.T) {
	// The empty text, and a text of only terminators, are zero lines (§1.3).
	if lines := mustPrepare(t, []byte("")); len(lines) != 0 {
		t.Fatalf("empty text gave %q, want no lines", lines)
	}
	if lines := mustPrepare(t, []byte("\n")); !reflect.DeepEqual(lines, []string{""}) {
		t.Fatalf(`"\n" gave %q, want one empty line`, lines)
	}
}
