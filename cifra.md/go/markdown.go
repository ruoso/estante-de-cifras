package cifra

// The two block-level Markdown primitives chapter 10 borrows from the song
// chapters: the §1.4.1 level-1 title and the §1.9 fences. A port of the
// reference's reference/cifra_md/parse.py (md_heading, fence_open, closes_fence
// and the helpers they use) — never imported from it: agreement is by the
// corpus, not shared code (DIRECTION §3.6).
//
// These live in a small, neutral file so the setlist reader uses them now and
// the later cifra_go.reader stands on the same one correct copy, without either
// reader depending on the other's internals (cifra_go.setlists refinement
// §Decisions). Pure functions of one line, built on regular expressions alone.

import (
	"regexp"
	"strings"
)

// mdHeadingRE: up to three leading spaces, 1–6 `#`, then — only if more follows
// — one space and the content (§1.7.1, §1.4.1). `#` with no space and no content
// is still a heading; `#x` is not.
var mdHeadingRE = regexp.MustCompile(`^ {0,3}(#{1,6})(?: (.*))?$`)

// fenceRE: up to three leading spaces, a run of three or more backticks or
// tildes, then the info string (§1.9).
var fenceRE = regexp.MustCompile("^ {0,3}(`{3,}|~{3,})(.*)$")

// fenceCloseRE: only the fence character, nothing after (§1.9).
var fenceCloseRE = regexp.MustCompile("^ {0,3}(`+|~+)$")

// closingSequenceRE: a closing `#` sequence of a heading, at the end, alone or
// after a space (§1.7.1).
var closingSequenceRE = regexp.MustCompile(`(?:^| )#+$`)

var innerSpacesRE = regexp.MustCompile(` +`)

// asciiLower lowercases only ASCII A–Z, as the reference's ascii_lower does — a
// title or an info string is compared and held with the document's own casing
// elsewhere.
func asciiLower(text string) string {
	var b strings.Builder
	for _, c := range text {
		if c >= 'A' && c <= 'Z' {
			b.WriteRune(c + 32)
		} else {
			b.WriteRune(c)
		}
	}
	return b.String()
}

// headingText is the text of a Markdown heading (§1.7.1): trimmed of spaces, the
// closing `#` sequence removed, runs of spaces collapsed to one.
func headingText(content string) string {
	t := strings.Trim(content, " ")
	t = strings.Trim(closingSequenceRE.ReplaceAllString(t, ""), " ")
	return innerSpacesRE.ReplaceAllString(t, " ")
}

// mdHeading returns (level, text, true) for a Markdown heading line, else
// ("", false) (§1.4.1). text is the heading's text, which may be empty
// (`#` alone).
func mdHeading(line string) (level int, text string, ok bool) {
	m := mdHeadingRE.FindStringSubmatch(line)
	if m == nil {
		return 0, "", false
	}
	return len(m[1]), headingText(m[2]), true
}

// fence is an open fence: its character and run length, and the 1-based line it
// opened on (the line is used only for the unclosed-fence diagnostic).
type fence struct {
	char   byte
	length int
	line   int
}

// fenceOpen returns (char, length, info, true) for a line that opens a fence,
// else false (§1.9). char is the fence character, length the run length, info
// the info string (ASCII-lowercased, trimmed). CommonMark: a backtick fence's
// info string may hold no backtick, so such a line opens no fence. The setlist
// reader ignores info; the later cifra_go.reader uses it.
func fenceOpen(line string) (char byte, length int, info string, ok bool) {
	m := fenceRE.FindStringSubmatch(line)
	if m == nil {
		return 0, 0, "", false
	}
	run := m[1]
	raw := m[2]
	if run[0] == '`' && strings.Contains(raw, "`") {
		return 0, 0, "", false
	}
	return run[0], len(run), asciiLower(strings.Trim(raw, " ")), true
}

// closesFence reports whether a line closes the given open fence (§1.9): the
// same fence character, a run at least as long as the opener's, and nothing
// after it.
func closesFence(line string, f fence) bool {
	m := fenceCloseRE.FindStringSubmatch(line)
	return m != nil && m[1][0] == f.char && len(m[1]) >= f.length
}
