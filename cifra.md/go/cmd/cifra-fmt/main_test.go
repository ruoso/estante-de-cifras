package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	cifra "github.com/ruoso/cifra.md/go"
)

// An untidy song: no fence, a `*` list marker, an upper-case key, trailing
// spaces and a level-3 heading. Canonical form fixes all of them.
const untidy = "# Atraente\n* Artist: Chiquinha Gonzaga\n\n### A\nC7 | F | C   |  Dm G7  \n"

func TestStdinToStdoutIsCanonical(t *testing.T) {
	var out bytes.Buffer
	if code := run([]string{"-q"}, strings.NewReader(untidy), &out); code != 0 {
		t.Fatalf("exit %d", code)
	}
	if !cifra.IsCanonical(out.Bytes()) {
		t.Fatalf("output is not canonical:\n%s", out.String())
	}
	for _, want := range []string{"- artist: Chiquinha Gonzaga", "## A", "```"} {
		if !strings.Contains(out.String(), want) {
			t.Errorf("output lacks %q:\n%s", want, out.String())
		}
	}
}

func TestWriteInPlaceThenListIsClean(t *testing.T) {
	dir := t.TempDir()
	song := filepath.Join(dir, "atraente.cifra.md")
	if err := os.WriteFile(song, []byte(untidy), 0o644); err != nil {
		t.Fatal(err)
	}
	var out bytes.Buffer
	if code := run([]string{"-l", "-q", song}, nil, &out); code != 1 || strings.TrimSpace(out.String()) != song {
		t.Fatalf("-l before -w: exit %d, listed %q", code, out.String())
	}
	if code := run([]string{"-w", "-q", song}, nil, &out); code != 0 {
		t.Fatalf("-w: exit %d", code)
	}
	written, _ := os.ReadFile(song)
	if !cifra.IsCanonical(written) {
		t.Fatalf("-w left a non-canonical file:\n%s", written)
	}
	out.Reset()
	if code := run([]string{"-l", "-q", song}, nil, &out); code != 0 || out.Len() != 0 {
		t.Fatalf("-l after -w: exit %d, listed %q", code, out.String())
	}
}

func TestSetlistIsReadAsSetlist(t *testing.T) {
	dir := t.TempDir()
	list := filepath.Join(dir, "gig.setlist.md")
	if err := os.WriteFile(list, []byte("# Gig\n\n1. [Atraente](atraente.cifra.md)   \n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if code := run([]string{"-w", "-q", list}, nil, &bytes.Buffer{}); code != 0 {
		t.Fatalf("exit %d", code)
	}
	written, _ := os.ReadFile(list)
	if !cifra.IsCanonicalSetlist(written) {
		t.Fatalf("not a canonical setlist:\n%s", written)
	}
}

func TestUnknownTokensAreReported(t *testing.T) {
	// `A#o` is how some transcriptions write a diminished chord; the grammar
	// reads `°` and `dim`, not `o`, so it is an unknown token.
	song := "# Test\n\n## A\n```\nC | A#o | G7 | C\n```\n"
	var out bytes.Buffer
	if code := run([]string{"-q", "-u"}, strings.NewReader(song), &out); code != 1 {
		t.Fatalf("exit %d, want 1 for an unknown token", code)
	}
	if code := run([]string{"-q", "-u"}, strings.NewReader(strings.Replace(song, "A#o", "A#°", 1)), &out); code != 0 {
		t.Fatalf("exit %d, want 0 once the chord is spelled with °", code)
	}
}

func TestNotUTF8IsAnError(t *testing.T) {
	if code := run([]string{"-q"}, bytes.NewReader([]byte{0xff, 0xfe, 'C'}), &bytes.Buffer{}); code != 1 {
		t.Fatalf("exit %d, want 1", code)
	}
}
