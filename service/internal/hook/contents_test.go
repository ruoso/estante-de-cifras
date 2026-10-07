package hook

// Unit test for the "what a book may hold" layer's pure parts — no git, no DB.
// Pins workflow 14 §"What a book may hold" (docs/workflows/14-file-view.md:24–32)
// and §"What the service checks" (L102–108) as pure logic: the path/kind, mode,
// UTF-8, size and .gitattributes-byte rules, the tree/commit reasonable-size and
// path-component guards, and the two output parsers (ls-tree and
// cat-file --batch-check). The reachability walk and the object reads themselves
// need real git, real objects and a real quarantine, so they live at the
// behavior level (cmd/pre-receive/contents_test.go).

import (
	"reflect"
	"strings"
	"testing"
)

// TestClassifyPath pins workflow 14 L24–28, L34–36: the allowed kinds and
// everything else.
func TestClassifyPath(t *testing.T) {
	cases := []struct {
		path string
		want blobKind
	}{
		// *.cifra.md / *.setlist.md songs and setlists in any folder.
		{"a-cancao.cifra.md", kindSong},
		{"folder/nested.cifra.md", kindSong},
		{"a/b/c/deep.cifra.md", kindSong},
		{"lista.setlist.md", kindSetlist},
		{"shows/2026.setlist.md", kindSetlist},
		// README.md and .gitattributes at the root only.
		{"README.md", kindReadme},
		{".gitattributes", kindGitattributes},
		// Disallowed: README.md / .gitattributes in a subfolder.
		{"sub/README.md", kindDisallowed},
		{"sub/.gitattributes", kindDisallowed},
		// Disallowed: the terms-of-sharing file and any other plain file.
		{"LICENSE", kindDisallowed},
		{"notes.txt", kindDisallowed},
		// Disallowed: a bare cifra.md (no stem) and a .cifra.md with no stem.
		{"cifra.md", kindDisallowed},
		{".cifra.md", kindDisallowed},
		{".setlist.md", kindDisallowed},
		// Disallowed: a backup that only looks like a song.
		{"a-cancao.cifra.md.bak", kindDisallowed},
		// Disallowed: an empty or traversal-bearing path.
		{"", kindDisallowed},
		{"../escape.cifra.md", kindDisallowed},
		{"a/../b.cifra.md", kindDisallowed},
		{"a//b.cifra.md", kindDisallowed},
	}
	for _, c := range cases {
		if got := classifyPath(c.path); got != c.want {
			t.Errorf("classifyPath(%q) = %d, want %d", c.path, got, c.want)
		}
	}
}

// TestModeAllowed pins workflow 14 L30: only a regular file (100644); an
// executable, a symlink and a submodule are refused.
func TestModeAllowed(t *testing.T) {
	if !modeAllowed("100644") {
		t.Error("100644 (regular file) should be allowed")
	}
	for _, mode := range []string{"100755", "120000", "160000", "040000"} {
		if modeAllowed(mode) {
			t.Errorf("mode %s should be refused", mode)
		}
	}
}

// TestValidUTF8 pins workflow 14 L30–31: the bytes decode as UTF-8.
func TestValidUTF8(t *testing.T) {
	if !validUTF8([]byte("# A song\n[C]uma linha com acento ç\n")) {
		t.Error("valid UTF-8 text should be accepted")
	}
	// 0xC3 0x28 is an invalid continuation byte sequence.
	if validUTF8([]byte{'#', ' ', 0xc3, 0x28, '\n'}) {
		t.Error("an invalid UTF-8 byte sequence should be refused")
	}
}

// TestWithinSizeLimit pins workflow 14 L31, L40 (the blob cap) and L105–108 (the
// tree/commit reasonable-size guard): a blob at the cap is accepted, one byte
// over refused; likewise a tree and a commit at their bound.
func TestWithinSizeLimit(t *testing.T) {
	if !withinSizeLimit("blob", maxBlobBytes) {
		t.Errorf("a blob of exactly %d bytes (the 256 KB cap) should be accepted", maxBlobBytes)
	}
	if withinSizeLimit("blob", maxBlobBytes+1) {
		t.Error("a blob one byte over the cap should be refused")
	}
	if !withinSizeLimit("tree", maxTreeBytes) {
		t.Error("a tree at its reasonable-size bound should be accepted")
	}
	if withinSizeLimit("tree", maxTreeBytes+1) {
		t.Error("a tree over its bound should be refused")
	}
	if !withinSizeLimit("commit", maxCommitBytes) {
		t.Error("a commit at its reasonable-size bound should be accepted")
	}
	if withinSizeLimit("commit", maxCommitBytes+1) {
		t.Error("a commit over its bound should be refused")
	}
}

// TestOverLongComponent pins workflow 14 L105–106: a path component of
// reasonable length is accepted, an over-long one refused.
func TestOverLongComponent(t *testing.T) {
	atBound := strings.Repeat("a", maxNameBytes)
	if _, tooLong := overLongComponent("folder/" + atBound); tooLong {
		t.Error("a component of exactly the limit should be accepted")
	}
	over := strings.Repeat("a", maxNameBytes+1)
	comp, tooLong := overLongComponent("folder/" + over + "/song.cifra.md")
	if !tooLong {
		t.Fatal("a component over the limit should be refused")
	}
	if comp != over {
		t.Errorf("overLongComponent returned %q, want the %d-byte component", comp, len(over))
	}
}

// TestGitattributesMatch pins workflow 14 L28, L73: the exact songbook bytes are
// accepted, any byte difference refused.
func TestGitattributesMatch(t *testing.T) {
	// The exact bytes the app scaffolds (app/src/worker/books.js:33-35
	// GITATTRIBUTES_BYTES) — the hook holds its own copy (DIRECTION §3.6
	// L288-291: the app and the service share no code), so this test is the
	// agreement between them.
	const appBytes = "*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n"
	if expectedGitattributes != appBytes {
		t.Fatalf("expectedGitattributes drifted from app/src/worker/books.js GITATTRIBUTES_BYTES:\n got %q\nwant %q", expectedGitattributes, appBytes)
	}
	if !gitattributesMatch([]byte(appBytes)) {
		t.Error("the exact app .gitattributes bytes should be accepted")
	}
	for _, bad := range []string{
		"*.cifra.md merge=cifra\n",                                   // missing the setlist line
		"*.cifra.md merge=cifra\n*.setlist.md merge=cifra",           // no trailing newline
		"*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n\n",       // an extra blank line
		"*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n# note\n", // an extra comment
		"*.json merge=binary\n",                                      // the home book's bytes
	} {
		if gitattributesMatch([]byte(bad)) {
			t.Errorf("a byte-different .gitattributes should be refused: %q", bad)
		}
	}
}

// TestParseLsTree pins the ls-tree parser: "<mode> SP <type> SP <sha> TAB <path>"
// lines (including a path with spaces) parse into typed entries; a malformed
// line is an error.
func TestParseLsTree(t *testing.T) {
	const blob = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"
	const link = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	in := "100644 blob " + blob + "\tREADME.md\n" +
		"100644 blob " + blob + "\tfolder/a song.cifra.md\n" + // a path with a space
		"120000 blob " + link + "\tatalho.cifra.md\n" +
		"\n" // a trailing blank line is ignored
	got, err := parseLsTree(strings.NewReader(in))
	if err != nil {
		t.Fatalf("parseLsTree: %v", err)
	}
	want := []treeEntry{
		{Mode: "100644", Type: "blob", SHA: blob, Path: "README.md"},
		{Mode: "100644", Type: "blob", SHA: blob, Path: "folder/a song.cifra.md"},
		{Mode: "120000", Type: "blob", SHA: link, Path: "atalho.cifra.md"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("parseLsTree = %+v, want %+v", got, want)
	}

	for _, bad := range []string{
		"100644 blob " + blob + " README.md\n", // no TAB before the path
		"100644 blob\tREADME.md\n",             // only two space-separated fields
		"100644 blob " + blob + "\t\n",         // an empty path
	} {
		if _, err := parseLsTree(strings.NewReader(bad)); err == nil {
			t.Errorf("parseLsTree(%q) should be a malformed-line error", bad)
		}
	}
}

// TestParseBatchCheck pins the cat-file --batch-check parser: "<sha> SP <type>
// SP <size>" lines parse into typed object infos; a "<sha> missing" line or any
// other shape is an error.
func TestParseBatchCheck(t *testing.T) {
	const commit = "1111111111111111111111111111111111111111"
	const tree = "2222222222222222222222222222222222222222"
	const blob = "3333333333333333333333333333333333333333"
	in := commit + " commit 231\n" +
		tree + " tree 92\n" +
		blob + " blob 4096\n" +
		"\n"
	got, err := parseBatchCheck(strings.NewReader(in))
	if err != nil {
		t.Fatalf("parseBatchCheck: %v", err)
	}
	want := []objectInfo{
		{SHA: commit, Type: "commit", Size: 231},
		{SHA: tree, Type: "tree", Size: 92},
		{SHA: blob, Type: "blob", Size: 4096},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("parseBatchCheck = %+v, want %+v", got, want)
	}

	for _, bad := range []string{
		blob + " missing\n",         // an object git could not find
		blob + " blob\n",            // no size
		blob + " blob notanumber\n", // a non-numeric size
	} {
		if _, err := parseBatchCheck(strings.NewReader(bad)); err == nil {
			t.Errorf("parseBatchCheck(%q) should be a malformed-line error", bad)
		}
	}
}
