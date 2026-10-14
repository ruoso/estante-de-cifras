package cifra

// Unit tests for the reader's diagnostics: every code the corpus pins, with its
// message and line, plus the NotUTF8Error-only error path and bad-notation.
// Diagnostics are data inside the model, never Go errors (§9.2). Purpose-written
// documents; agreement with the reference and JS twin is by the corpus, not code.

import (
	"errors"
	"testing"
)

func TestParseErrorsOnlyOnNonUTF8(t *testing.T) {
	m, err := Parse([]byte{0x41, 0xff, 0x42}) // a stray 0xFF is not UTF-8
	if err == nil {
		t.Fatal("Parse should error on non-UTF-8 input")
	}
	var nu *NotUTF8Error
	if !errors.As(err, &nu) {
		t.Errorf("error = %T, want *NotUTF8Error", err)
	}
	if m != nil {
		t.Error("no model is built for non-UTF-8 input")
	}
}

func TestUnparseableContentIsNeverAGoError(t *testing.T) {
	// A document full of things a reader does not understand still parses; the
	// trouble is reported as diagnostics (§9.2), never as a Go error.
	m, err := Parse([]byte("## S\n```\n( Dm\n% )\n```\n- notation: klingon\n"))
	if err != nil {
		t.Fatalf("Parse returned a Go error for unparseable content: %v", err)
	}
	if m == nil {
		t.Fatal("expected a model")
	}
}

func TestDiagnosticCodesMessagesAndLines(t *testing.T) {
	cases := []struct {
		name    string
		src     string
		code    string
		line    int
		message string
	}{
		{
			"marker-line",
			"## S\n```\n<<<<<<< ours\n```\n",
			"marker-line", 3,
			"a conflict marker: this text is an unresolved merge, and cannot be saved until it is resolved",
		},
		{
			"duplicate-property",
			"# S\n- key: C\n- key: D\n",
			"duplicate-property", 3,
			"`key` is set again; the earlier value is not kept",
		},
		{
			"bad-property (not key: value)",
			"# S\n- just some text\n",
			"bad-property", 2,
			"a property is `key: value`, with a space after the colon; this line is not kept",
		},
		{
			"bad-property (words)",
			"- words: maybe\n# S\n",
			"bad-property", 1,
			"`words` is yes or no, not 'maybe'",
		},
		{
			"bad-notation",
			"- notation: klingon\n```\nC\n```\n",
			"bad-notation", 1,
			"unknown notation 'klingon'; using brazilian",
		},
		{
			"heading-looks-like-key",
			"## S\n```\nG: Am\n```\n",
			"heading-looks-like-key", 3,
			"`G: Am` reads as a section called 'G' holding one chord; if it is the song's key, write `- key: Am` in the properties",
		},
		{
			"extra-rule",
			"## S\n```\nC\n```\n\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: x32010\n\n---\n",
			"extra-rule", 11,
			"a second rule; only the first divides the document, and this one is not kept",
		},
		{
			"bad-block-heading",
			"## S\n```\nC\n```\n\n---\n\n## Chorus\n- C: x32010\n",
			"bad-block-heading", 8,
			"`## Chorus` comes after the rule, where a heading is a voicings block and needs a tuning (`## Voicings: E2 A2 D3 G3 B3 E4`). If it is a section of the song, move the rule below it; the lines under it are not read",
		},
		{
			"duplicate-block",
			"---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: x32010\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- G: 320003\n",
			"duplicate-block", 6,
			"a second block for the same tuning and variation; merged",
		},
		{
			"item-outside-block",
			"---\n\n- C: x32010\n",
			"item-outside-block", 3,
			"a voicing before any block heading; not kept",
		},
		{
			"bad-voicing",
			"---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- C: zzz\n",
			"bad-voicing", 4,
			"not a fret string: 'zzz'",
		},
		{
			"bad-fingering",
			"---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- A: x02220 (zz)\n",
			"bad-fingering", 4,
			"not a fingering",
		},
		{
			"notes-outside-block",
			"---\n\njust some text\n",
			"notes-outside-block", 3,
			"text in the voicings part before any block; not kept",
		},
		{
			"unclosed-fence",
			"## S\n```\nC\n",
			"unclosed-fence", 2,
			"a fence was opened and never closed; it runs to the end of the document",
		},
		{
			"unfenced-music",
			"G C D\n",
			"unfenced-music", 1,
			"this reads as a line of chords, but it is outside a fence, so it is notes; put the music between ``` lines (or ~~~)",
		},
		{
			"stray-mark",
			"## S\n```\nDm )\n```\n",
			"stray-mark", 3,
			"a closing mark with no open repeat group",
		},
		{
			"ending-outside-group",
			"## S\n```\nDm 1. G7\n```\n",
			"ending-outside-group", 3,
			"1. outside a repeat group is not an ending",
		},
		{
			"count-out-of-place",
			"## S\n```\nx3 Dm | G7\n```\n",
			"count-out-of-place", 3,
			"a count that follows neither a repeat group nor ends a line",
		},
		{
			"unclosed-group",
			"## S\n```\n( Dm | G7\n```\n",
			"unclosed-group", 3,
			"a repeat group was opened and never closed",
		},
		{
			"bad-ending-sequence",
			"## S\n```\n( 2. Dm | 1. G7 )\n```\n",
			"bad-ending-sequence", 3,
			"endings must be 1. to n. in order, got [2, 1]",
		},
		{
			"count-with-endings",
			"## S\n```\n( 1. Dm | 2. G7 ) x3\n```\n",
			"count-with-endings", 3,
			"a group with endings takes its count from them",
		},
		{
			"repeat-without-previous",
			"## S\n```\n%\n```\n",
			"repeat-without-previous", 3,
			"a % with no measure before it",
		},
		{
			"repeat-beside-items",
			"## S\n```\nG7 | Dm %\n```\n",
			"repeat-beside-items", 3,
			"a % beside other items has no defined meaning",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			m := parseSong(t, c.src)
			msg, line, ok := diagMessageAt(m, c.code)
			if !ok {
				t.Fatalf("no %q diagnostic; got %v", c.code, allDiagCodes(m))
			}
			if line != c.line {
				t.Errorf("%s line = %d, want %d", c.code, line, c.line)
			}
			if msg != c.message {
				t.Errorf("%s message =\n  %q\nwant\n  %q", c.code, msg, c.message)
			}
		})
	}
}

func allDiagCodes(m Model) []string {
	out := []string{}
	for _, d := range diagObjs(m) {
		out = append(out, objString(d, "code"))
	}
	return out
}
