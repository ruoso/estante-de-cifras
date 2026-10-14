package cifra

// Unit tests for the two shared block primitives on purpose-written lines,
// ported from the reference's parse.py: the §1.4.1 level-1 title and the §1.9
// fences. Pins §1.4.1 and §1.9 (cifra_go.setlists refinement, unit level).

import "testing"

func TestMdHeading(t *testing.T) {
	cases := []struct {
		line      string
		wantOK    bool
		wantLevel int
		wantText  string
	}{
		{"# Title", true, 1, "Title"},           // a level-1 heading
		{"#", true, 1, ""},                      // `#` alone is a heading with no text
		{"###### Six", true, 6, "Six"},          // up to six levels
		{"   ## Indented", true, 2, "Indented"}, // up to three leading spaces
		{"#x", false, 0, ""},                    // `#` must be followed by a space or nothing
		{"    # Four spaces", false, 0, ""},     // four leading spaces is not a heading
		{"####### Seven", false, 0, ""},         // seven `#` is not a heading
		{"not a heading", false, 0, ""},
		{"# Trailing #", true, 1, "Trailing"},         // closing `#` sequence removed (§1.7.1)
		{"# Trailing ###", true, 1, "Trailing"},       // a run of closing `#`
		{"#    Spaced    Out", true, 1, "Spaced Out"}, // runs of spaces collapsed
	}
	for _, c := range cases {
		level, text, ok := mdHeading(c.line)
		if ok != c.wantOK || level != c.wantLevel || text != c.wantText {
			t.Errorf("mdHeading(%q) = (%d, %q, %v), want (%d, %q, %v)",
				c.line, level, text, ok, c.wantLevel, c.wantText, c.wantOK)
		}
	}
}

func TestFenceOpen(t *testing.T) {
	cases := []struct {
		line       string
		wantOK     bool
		wantChar   byte
		wantLength int
		wantInfo   string
	}{
		{"```", true, '`', 3, ""},           // a bare backtick fence
		{"~~~", true, '~', 3, ""},           // a tilde fence
		{"````", true, '`', 4, ""},          // a longer run
		{"   ```", true, '`', 3, ""},        // up to three leading spaces
		{"```cifra", true, '`', 3, "cifra"}, // an info string is kept, lowercased
		{"~~~ Verbatim ", true, '~', 3, "verbatim"},
		{"``", false, 0, 0, ""},              // fewer than three
		{"```has`backtick", false, 0, 0, ""}, // a backtick fence's info holds no backtick
		{"not a fence", false, 0, 0, ""},
	}
	for _, c := range cases {
		char, length, info, ok := fenceOpen(c.line)
		if ok != c.wantOK || char != c.wantChar || length != c.wantLength || info != c.wantInfo {
			t.Errorf("fenceOpen(%q) = (%q, %d, %q, %v), want (%q, %d, %q, %v)",
				c.line, char, length, info, ok, c.wantChar, c.wantLength, c.wantInfo, c.wantOK)
		}
	}
}

func TestClosesFence(t *testing.T) {
	open := fence{char: '`', length: 3}
	cases := []struct {
		line string
		want bool
	}{
		{"```", true},    // same character, same length, nothing after
		{"````", true},   // a longer run closes
		{"``", false},    // a shorter run does not
		{"~~~", false},   // the wrong character does not
		{"``` x", false}, // nothing may follow
		{"   ```", true}, // up to three leading spaces
	}
	for _, c := range cases {
		if got := closesFence(c.line, open); got != c.want {
			t.Errorf("closesFence(%q) = %v, want %v", c.line, got, c.want)
		}
	}
	// A tilde fence of length 4 needs four or more tildes to close.
	tildes := fence{char: '~', length: 4}
	if closesFence("~~~", tildes) {
		t.Errorf("a 3-tilde line should not close a 4-tilde fence")
	}
	if !closesFence("~~~~", tildes) {
		t.Errorf("a 4-tilde line should close a 4-tilde fence")
	}
}
