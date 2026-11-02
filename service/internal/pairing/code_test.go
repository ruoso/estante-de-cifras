package pairing

import (
	"regexp"
	"strings"
	"testing"
)

// These unit tests pin the pairing code (reader.device_pairing Constraint 2;
// workflow 13 L387–392): six characters of a 31-character alphabet without
// look-alikes, shown three-dash-three, read back in any spelling.

// TestAlphabetLeavesOutLookAlikes pins workflow 13 L387–390: no 0, O, 1, I, L.
func TestAlphabetLeavesOutLookAlikes(t *testing.T) {
	if len(Alphabet) != 31 {
		t.Fatalf("alphabet has %d characters, want 31", len(Alphabet))
	}
	for _, c := range "0O1IL" {
		if strings.ContainsRune(Alphabet, c) {
			t.Errorf("alphabet holds the look-alike %q", c)
		}
	}
	seen := map[rune]bool{}
	for _, c := range Alphabet {
		if seen[c] {
			t.Errorf("alphabet repeats %q", c)
		}
		seen[c] = true
	}
}

// TestGeneratedCodeShape: six alphabet characters, shown XXX-XXX.
func TestGeneratedCodeShape(t *testing.T) {
	shown := regexp.MustCompile(`^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$`)
	for i := 0; i < 200; i++ {
		raw, err := Generate()
		if err != nil {
			t.Fatalf("Generate: %v", err)
		}
		if len(raw) != Length {
			t.Fatalf("code %q has %d characters, want %d", raw, len(raw), Length)
		}
		for _, c := range raw {
			if !strings.ContainsRune(Alphabet, c) {
				t.Fatalf("code %q holds %q, outside the alphabet", raw, c)
			}
		}
		if s := Format(raw); !shown.MatchString(s) {
			t.Fatalf("Format(%q) = %q, want XXX-XXX", raw, s)
		}
	}
}

// TestNormalizeAcceptsAnySpelling pins workflow 13 L387–388 and rejects what is
// not six alphabet characters, with no look-alike mapping (Constraint 2).
func TestNormalizeAcceptsAnySpelling(t *testing.T) {
	for _, in := range []string{"KQ7-4TM", "kq7-4tm", "KQ74TM", "kq74tm", " kq7 4tm ", "Kq7 - 4tM"} {
		raw, ok := Normalize(in)
		if !ok || raw != "KQ74TM" {
			t.Errorf("Normalize(%q) = %q, %v; want KQ74TM, true", in, raw, ok)
		}
	}
	for _, in := range []string{"", "KQ74T", "KQ7-4T", "KQ74TMX", "KQ7-4TMX", "KQ74TO", "KQ74T1", "KQ74T0", "KQ74TI", "KQ74TL", "KQ7_4TM", "KQ7·4TM"} {
		if raw, ok := Normalize(in); ok {
			t.Errorf("Normalize(%q) = %q, true; want a refusal", in, raw)
		}
	}
}

// TestGenerateTouchesEveryCharacter: a large draw uses the whole alphabet, so
// no character is left out by a sampling bug.
func TestGenerateTouchesEveryCharacter(t *testing.T) {
	seen := map[rune]int{}
	for i := 0; i < 2000; i++ {
		raw, err := Generate()
		if err != nil {
			t.Fatalf("Generate: %v", err)
		}
		for _, c := range raw {
			seen[c]++
		}
	}
	for _, c := range Alphabet {
		if seen[c] == 0 {
			t.Errorf("character %q never drawn in 12000 draws", c)
		}
	}
}
