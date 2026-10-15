package book

import (
	"context"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
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

// git runs the host git in dir for the CountNewSaves fixture, failing the test
// on error, and returns its trimmed stdout.
func git(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0",
		"GIT_AUTHOR_NAME=Seed Author", "GIT_AUTHOR_EMAIL=seed@estante.test",
		"GIT_COMMITTER_NAME=Seed Author", "GIT_COMMITTER_EMAIL=seed@estante.test")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v: %s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}

// commitFile writes one file in the work tree and commits it.
func commitFile(t *testing.T, work, name, body, msg string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(work, name), []byte(body), 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
	git(t, work, "add", name)
	git(t, work, "-c", "commit.gpgsign=false", "commit", "-q", "-m", msg)
}

// repoSnapshot lists a bare repository's refs and every file under objects/, the
// state CountNewSaves must leave exactly as it found it.
func repoSnapshot(t *testing.T, bare string) string {
	t.Helper()
	refs := git(t, bare, "for-each-ref")
	var files []string
	if err := filepath.WalkDir(filepath.Join(bare, "objects"), func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			files = append(files, p)
		}
		return nil
	}); err != nil {
		t.Fatalf("walk objects: %v", err)
	}
	sort.Strings(files)
	return refs + "\n" + strings.Join(files, "\n")
}

// TestCountNewSaves pins sync.fork_follow AC2, workflow 11 line 46 ("Ana's
// Choros has 3 new saves") and Constraint 3: on a fork made by Store.Fork, two
// saves and one merge commit landing on the original count 2 (a save is a
// non-merge commit); once the fork has merged them the count is 0; an empty
// original counts 0; and counting changes neither repository's refs or objects.
func TestCountNewSaves(t *testing.T) {
	ctx := context.Background()
	s := Store{Root: t.TempDir()}
	const origID = "4f8c0b2e-1a3d-4c5e-8b7a-9d0e1f2a3b4c"
	const forkID = "5a9d1c3f-2b4e-4d6f-9c8b-0e1f2a3b4c5d"
	const emptyID = "6b0e2d4a-3c5f-4e7a-8d9c-1f2a3b4c5d6e"
	origPath := filepath.Join(s.Root, origID+".git")
	forkPath := filepath.Join(s.Root, forkID+".git")

	if err := s.InitBare(ctx, origID); err != nil {
		t.Fatalf("init original: %v", err)
	}
	work := filepath.Join(t.TempDir(), "wc")
	git(t, filepath.Dir(work), "clone", "-q", origPath, work)
	git(t, work, "checkout", "-q", "-b", "main")
	commitFile(t, work, "README.md", "# Choros de Teste\n", "seed")
	git(t, work, "push", "-q", "origin", "main")

	if err := s.Fork(ctx, origID, forkID); err != nil {
		t.Fatalf("fork: %v", err)
	}
	if n, err := s.CountNewSaves(ctx, origID, forkID); err != nil || n != 0 {
		t.Fatalf("fresh fork: CountNewSaves = %d, %v; want 0", n, err)
	}

	// Two saves on the original, joined by one merge commit (as the original's
	// own sync between two members makes): A on main, B on a side line, M merges.
	git(t, work, "checkout", "-q", "-b", "side")
	commitFile(t, work, "valsa.cifra.md", "# Valsa\n", "save B")
	git(t, work, "checkout", "-q", "main")
	commitFile(t, work, "choro.cifra.md", "# Choro\n", "save A")
	git(t, work, "-c", "commit.gpgsign=false", "merge", "-q", "--no-ff", "-m", "sync merge", "side")
	git(t, work, "push", "-q", "origin", "main")

	before := repoSnapshot(t, origPath) + repoSnapshot(t, forkPath)
	n, err := s.CountNewSaves(ctx, origID, forkID)
	if err != nil {
		t.Fatalf("CountNewSaves: %v", err)
	}
	if n != 2 {
		t.Errorf("two saves and a merge on the original: CountNewSaves = %d, want 2 (merges are not saves)", n)
	}
	if after := repoSnapshot(t, origPath) + repoSnapshot(t, forkPath); after != before {
		t.Errorf("CountNewSaves changed a repository's refs or objects")
	}

	// The fork saves on its own, then brings the original in with a merge.
	fwork := filepath.Join(t.TempDir(), "fwc")
	git(t, filepath.Dir(fwork), "clone", "-q", forkPath, fwork)
	commitFile(t, fwork, "minha.cifra.md", "# Minha\n", "fork's own save")
	git(t, fwork, "fetch", "-q", origPath, "main:refs/remotes/original/main")
	git(t, fwork, "-c", "commit.gpgsign=false", "merge", "-q", "--no-ff", "-m", "Bring in", "refs/remotes/original/main")
	git(t, fwork, "push", "-q", "origin", "main")
	if n, err := s.CountNewSaves(ctx, origID, forkID); err != nil || n != 0 {
		t.Errorf("after the fork merged them: CountNewSaves = %d, %v; want 0", n, err)
	}

	// An original with no main yet has nothing to bring in.
	if err := s.InitBare(ctx, emptyID); err != nil {
		t.Fatalf("init empty: %v", err)
	}
	if n, err := s.CountNewSaves(ctx, emptyID, forkID); err != nil || n != 0 {
		t.Errorf("empty original: CountNewSaves = %d, %v; want 0", n, err)
	}
}

// TestReadAuthorName pins books.owner_name's read of the owner's name from a
// home book (docs/home-book-format.md §4.1 authorName, §5.3 tombstones), against
// real bare repositories: a set authorName gives the name; a tombstone, an
// absent key, no main, no preferences.json and malformed JSON each mean "no
// name" (ok=false), never an error.
func TestReadAuthorName(t *testing.T) {
	ctx := context.Background()
	s := Store{Root: t.TempDir()}

	// seed makes a bare home book whose main holds the given files.
	seed := func(id string, files map[string]string) {
		t.Helper()
		if err := s.InitBare(ctx, id); err != nil {
			t.Fatalf("init %s: %v", id, err)
		}
		if len(files) == 0 {
			return
		}
		work := filepath.Join(t.TempDir(), "wc")
		git(t, filepath.Dir(work), "clone", "-q", filepath.Join(s.Root, id+".git"), work)
		git(t, work, "checkout", "-q", "-b", "main")
		for name, body := range files {
			commitFile(t, work, name, body, "seed "+name)
		}
		git(t, work, "push", "-q", "origin", "main")
	}
	const readme = "# Home\n"
	const at = `"at": "2026-10-05T14:29:12.500Z"`

	cases := []struct {
		name   string
		id     string
		files  map[string]string
		want   string
		wantOK bool
	}{
		{"a set authorName gives the name", "1a2b3c4d-0000-4000-8000-000000000001",
			map[string]string{"README.md": readme, "preferences.json": `{"authorName": {"value": "Marina Souza", ` + at + `}, "theme": {"value": "palco", ` + at + `}}` + "\n"},
			"Marina Souza", true},
		{"a tombstoned authorName is no name", "1a2b3c4d-0000-4000-8000-000000000002",
			map[string]string{"README.md": readme, "preferences.json": `{"authorName": {"value": null, ` + at + `}}` + "\n"},
			"", false},
		{"an absent authorName is no name", "1a2b3c4d-0000-4000-8000-000000000003",
			map[string]string{"README.md": readme, "preferences.json": `{"theme": {"value": "palco", ` + at + `}}` + "\n"},
			"", false},
		{"no main is no name", "1a2b3c4d-0000-4000-8000-000000000004", nil, "", false},
		{"no preferences.json is no name", "1a2b3c4d-0000-4000-8000-000000000005",
			map[string]string{"README.md": readme}, "", false},
		{"malformed JSON is no name", "1a2b3c4d-0000-4000-8000-000000000006",
			map[string]string{"README.md": readme, "preferences.json": `{"authorName": {"value": "Ana"`}, "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			seed(tc.id, tc.files)
			got, ok := s.ReadAuthorName(ctx, tc.id)
			if got != tc.want || ok != tc.wantOK {
				t.Errorf("ReadAuthorName = %q, %v; want %q, %v", got, ok, tc.want, tc.wantOK)
			}
		})
	}
}
