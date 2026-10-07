package book

import (
	"path/filepath"
	"strings"
	"testing"
)

// TestRepoPathJoinsRootAndID pins the /data/books/<id>.git convention
// (task note; DIRECTION §3.3 lines 186-187): a valid UUID id joins onto the
// root as <id>.git.
func TestRepoPathJoinsRootAndID(t *testing.T) {
	const root = "/data/books"
	const id = "4f8c0b2e-1a3d-4c5e-8b7a-9d0e1f2a3b4c"
	got, err := repoPath(root, id)
	if err != nil {
		t.Fatalf("repoPath(%q, %q): unexpected error: %v", root, id, err)
	}
	want := filepath.Join(root, id+".git")
	if got != want {
		t.Errorf("repoPath = %q, want %q", got, want)
	}
}

// TestRepoPathRefusesNonUUID pins the opaque-random-id rule and the no-path-
// escape guarantee (DIRECTION §3.3): an id that is not a canonical UUID is
// refused before it can be joined into a path, so a crafted id — a traversal, a
// subpath, empty — never reaches the filesystem.
func TestRepoPathRefusesNonUUID(t *testing.T) {
	const root = "/data/books"
	for _, id := range []string{
		"",
		"../../etc/passwd",
		"not-a-uuid",
		"4f8c0b2e-1a3d-4c5e-8b7a-9d0e1f2a3b4c/../../escape",
		"4f8c0b2e1a3d4c5e8b7a9d0e1f2a3b4c.git",
		".",
	} {
		if _, err := repoPath(root, id); err == nil {
			t.Errorf("repoPath(%q, %q): want error for a non-UUID id, got nil", root, id)
		}
	}
}

// TestTitleFromREADMEReadsFirstHeading pins DIRECTION §2.1 line 74: the title is
// the level-1 heading of the README, trimmed, and the first one wins.
func TestTitleFromREADMEReadsFirstHeading(t *testing.T) {
	for _, tc := range []struct {
		name string
		in   string
		want string
	}{
		{"simple", "# Choros de Pixinguinha\n\nsome songs\n", "Choros de Pixinguinha"},
		{"trims surrounding space", "#   Spaced Out   \n", "Spaced Out"},
		{"first of several", "# First\n# Second\n", "First"},
		{"skips leading blank lines", "\n\n# After Blanks\n", "After Blanks"},
		{"skips non-heading lines", "intro paragraph\n\n# The Heading\n", "The Heading"},
		{"ignores deeper headings before a level-1", "## Subsection\n# Real Title\n", "Real Title"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := titleFromREADME([]byte(tc.in)); got != tc.want {
				t.Errorf("titleFromREADME(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// TestTitleFromREADMEFallsBackToPlaceholder pins the non-empty-placeholder
// fallback (service.books Decision; DIRECTION §2.1): a README with no level-1
// heading — empty, only deeper headings, or an empty heading — yields the
// placeholder so the contract's required title is never empty.
func TestTitleFromREADMEFallsBackToPlaceholder(t *testing.T) {
	for _, tc := range []struct {
		name string
		in   string
	}{
		{"empty", ""},
		{"no heading at all", "just a paragraph of prose\nand another line\n"},
		{"only a deeper heading", "## Not Level One\n### Deeper\n"},
		{"hash with no text", "#\n#    \n"},
		{"hash without a space is not a heading", "#NoSpace\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := titleFromREADME([]byte(tc.in))
			if got != PlaceholderTitle {
				t.Errorf("titleFromREADME(%q) = %q, want placeholder %q", tc.in, got, PlaceholderTitle)
			}
			if strings.TrimSpace(got) == "" {
				t.Errorf("titleFromREADME placeholder is empty, want non-empty")
			}
		})
	}
}
