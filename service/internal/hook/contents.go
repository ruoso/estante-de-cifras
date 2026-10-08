package hook

// contents.go is the "what a book may hold" layer the binary composes after the
// refs-and-history layer and the object-reachability layer accept (hook.contents
// Decision; DIRECTION §3.6). By the time it runs there is exactly one accepted,
// non-deletion refs/heads/main new head to reach from, and the pack carries no
// object that head does not reach, so "every blob reachable from a new commit"
// is a well-defined, fully-present set.
//
// For that new head it examines every blob the introduced history reaches — not
// only the tip — and refuses the whole push unless each blob satisfies the
// songbook's rules (workflow 14 §"What a book may hold", L16–47, enforced by
// §"What the service checks" L102–108):
//
//   - its path is an allowed kind (*.cifra.md / *.setlist.md in any folder, a
//     root README.md, a root .gitattributes);
//   - its tree-entry mode is a regular file (100644): no symlinks, submodules or
//     executables;
//   - its bytes are valid UTF-8 (the stricter text rules and canonical form are
//     hook.canonical's — this layer takes no cifra.md-for-Go dependency);
//   - it is at most 256 KB;
//   - and, for a root .gitattributes, its bytes are exactly what the app writes.
//
// Alongside the blobs it holds the carrier objects to a reasonable size — every
// tree and commit — "so that commit messages are not the storage instead"
// (L105–108), and every path component to a reasonable length.
//
// It delegates all object knowledge to git, execed in the bare repo exactly as
// the stowaways layer execs it (revListObjects/quarantineObjects,
// stowaways.go:206,:220): reachability with `git rev-list`, tree entries with
// `git ls-tree -r`, type and size with `git cat-file --batch-check`, content
// with `git cat-file blob`. It parses no pack files, walks no objects/ directory
// by hand, and keeps no database connection (hook.contents Constraints;
// DIRECTION §3.6 L342-346). A real git failure (distinct from a clean refusal)
// is returned as an error, which main maps to a refusal — never accept something
// it could not verify.

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

// The per-file size cap (workflow 14 L31, L40: "at most 256 KB"). KB here is
// 1024 bytes: a blob of exactly this many bytes is accepted, one byte more is
// refused.
const maxBlobBytes = 256 * 1024

// Reasonable-size guard rails for the carrier objects (workflow 14 L105–108).
// These are not the per-file rule; they stop a commit message or a tree being
// used as storage instead. The hard per-push cap is git's receive.maxInputSize
// (a hook.limits concern). The bounds are generous — a real commit message is a
// few hundred bytes, a real folder's tree a few kilobytes — so only abuse trips
// them.
const (
	maxCommitBytes = 100 * 1024      // a message and author of reasonable size
	maxTreeBytes   = 1 * 1024 * 1024 // a folder listing of reasonable size
	maxNameBytes   = 255             // one path component, the common filesystem limit
)

// expectedGitattributes is the hook's own copy of the songbook .gitattributes
// bytes the app scaffolds (app/src/worker/books.js:33-35 GITATTRIBUTES_BYTES:
// the cifra merge driver for songs and setlists, UTF-8/LF/one trailing newline).
// The app and the service share no code (DIRECTION §3.6 L288-291), so the
// agreement is held by a test (contents_test.go pins this constant) and by the
// end-to-end flow where an app-created book's .gitattributes is pushed through
// the real hook — not by importing the JS constant (hook.contents Decision).
const expectedGitattributes = "*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n"

// gitattributesName / readmeName are the two fixed-name files a songbook may
// hold, each only at the root.
const (
	gitattributesName = ".gitattributes"
	readmeName        = "README.md"
)

// songSuffix / setlistSuffix are the two glob kinds a songbook may hold in any
// folder. A name must have a non-empty stem before the suffix (a bare
// ".cifra.md" with no stem is not a song).
const (
	songSuffix    = ".cifra.md"
	setlistSuffix = ".setlist.md"
)

// regularFileMode is the only tree-entry mode a blob may have (workflow 14 L30:
// "no symlinks, no submodules, nothing executable").
const regularFileMode = "100644"

// blobKind is the classification of a tree-entry path against what a book may
// hold. kindDisallowed is any path the songbook rules reject.
type blobKind int

const (
	kindDisallowed blobKind = iota
	kindSong
	kindSetlist
	kindReadme
	kindGitattributes
)

// treeEntry is one line of `git ls-tree -r` output: a blob or gitlink reachable
// from a commit, with the tree-entry mode it is held at and the path it is held
// under.
type treeEntry struct {
	Mode string
	Type string
	SHA  string
	Path string
}

// objectInfo is one line of `git cat-file --batch-check='%(objectname)
// %(objecttype) %(objectsize)'` output: an introduced object's name, type
// (blob / tree / commit) and byte size.
type objectInfo struct {
	SHA  string
	Type string
	Size int64
}

// classifyPath decides a path against the allowed kinds (workflow 14 L24–28,
// L34–36). A path with an empty, "." or ".." component is disallowed (defensive
// — git's own trees never hold these). *.cifra.md / *.setlist.md are allowed in
// any folder (with a non-empty stem); README.md and .gitattributes only at the
// root; anything else (a LICENSE, a notes.txt, a bare cifra.md, a *.cifra.md.bak,
// a subfolder README.md/.gitattributes) is disallowed.
func classifyPath(path string) blobKind {
	if path == "" {
		return kindDisallowed
	}
	comps := strings.Split(path, "/")
	for _, c := range comps {
		if c == "" || c == "." || c == ".." {
			return kindDisallowed
		}
	}
	name := comps[len(comps)-1]
	atRoot := len(comps) == 1
	switch {
	case strings.HasSuffix(name, songSuffix) && len(name) > len(songSuffix):
		return kindSong
	case strings.HasSuffix(name, setlistSuffix) && len(name) > len(setlistSuffix):
		return kindSetlist
	case atRoot && name == readmeName:
		return kindReadme
	case atRoot && name == gitattributesName:
		return kindGitattributes
	default:
		return kindDisallowed
	}
}

// modeAllowed reports whether a tree-entry mode is a regular file. An executable
// (100755), a symlink (120000) and a gitlink/submodule (160000) are each
// refused (workflow 14 L30).
func modeAllowed(mode string) bool {
	return mode == regularFileMode
}

// modeDescription names a non-regular mode for the refusal reason, without
// exposing anything but the structural fault.
func modeDescription(mode string) string {
	switch mode {
	case "100755":
		return "an executable file"
	case "120000":
		return "a symlink"
	case "160000":
		return "a submodule"
	default:
		return "mode " + mode
	}
}

// withinSizeLimit reports whether an object of the given type is within its
// size guard rail: the 256 KB per-file cap for a blob, the reasonable-size
// bound for a tree or a commit. An unrecognised type is not size-guarded here.
func withinSizeLimit(typ string, size int64) bool {
	switch typ {
	case "blob":
		return size <= maxBlobBytes
	case "tree":
		return size <= maxTreeBytes
	case "commit":
		return size <= maxCommitBytes
	default:
		return true
	}
}

// overLongComponent returns the first path component over the length limit and
// whether one was found (workflow 14 L105–106: "names of reasonable length").
func overLongComponent(path string) (string, bool) {
	for _, c := range strings.Split(path, "/") {
		if len(c) > maxNameBytes {
			return c, true
		}
	}
	return "", false
}

// validUTF8 reports whether a blob's bytes are valid UTF-8 (workflow 14 L30–31).
// Only the encoding — the stricter text rules (no BOM, LF, one final newline,
// NFC, no tabs) and the song/setlist canonical form are hook.canonical's.
func validUTF8(b []byte) bool {
	return utf8.Valid(b)
}

// gitattributesMatch reports whether a root .gitattributes blob's bytes are
// exactly the songbook bytes the app writes (workflow 14 L28, L73).
func gitattributesMatch(b []byte) bool {
	return bytes.Equal(b, []byte(expectedGitattributes))
}

// parseLsTree parses `git ls-tree -r` output — one "<mode> SP <type> SP <sha>
// TAB <path>" line per entry — into typed entries. A line without a TAB or
// without three space-separated fields before it is a malformed-input error
// (mirroring ParseUpdates/parseFirstField; the hook is run with
// core.quotePath=false so a normal UTF-8 path is literal, and git still C-quotes
// a path with a control byte, so no literal TAB or newline ever splits a line).
func parseLsTree(r io.Reader) ([]treeEntry, error) {
	var entries []treeEntry
	sc := bufio.NewScanner(r)
	// A book's file listing can be large; raise the token cap well above a
	// single line's worst case (as parseFirstField does, stowaways.go:62).
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := sc.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}
		tab := strings.IndexByte(line, '\t')
		if tab < 0 {
			return nil, fmt.Errorf("malformed ls-tree line %q", line)
		}
		meta := strings.Fields(line[:tab])
		path := line[tab+1:]
		if len(meta) != 3 || path == "" {
			return nil, fmt.Errorf("malformed ls-tree line %q", line)
		}
		entries = append(entries, treeEntry{Mode: meta[0], Type: meta[1], SHA: meta[2], Path: path})
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("reading ls-tree output: %w", err)
	}
	return entries, nil
}

// parseBatchCheck parses `git cat-file --batch-check='%(objectname)
// %(objecttype) %(objectsize)'` output — one "<sha> SP <type> SP <size>" line
// per object — into typed object infos. A "<sha> missing" line (two fields) or
// any other shape is a malformed-input error, which the caller maps to a
// refusal (never accept an object it could not classify).
func parseBatchCheck(r io.Reader) ([]objectInfo, error) {
	var infos []objectInfo
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) != 3 {
			return nil, fmt.Errorf("malformed cat-file --batch-check line %q", line)
		}
		size, err := strconv.ParseInt(fields[2], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("malformed cat-file --batch-check line %q: %w", line, err)
		}
		infos = append(infos, objectInfo{SHA: fields[0], Type: fields[1], Size: size})
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("reading cat-file --batch-check output: %w", err)
	}
	return infos, nil
}

// Contents is the "what a book may hold" layer the binary composes: for the one
// accepted, non-deletion refs/heads/main update it reaches from the new head and
// refuses the push if any blob the introduced history reaches breaks a songbook
// rule (path, mode, UTF-8, size, .gitattributes bytes) or if any carrier object
// is unreasonably large. It returns one refusal reason per fault (an empty slice
// accepts) or an error for a real git failure, which main maps to a refusal.
// repoDir is the bare repository the git commands run in (empty = inherit the
// hook's cwd, which git sets to the bare repo).
func Contents(updates []RefUpdate, repoDir string) (reasons []string, err error) {
	newHead, ok := acceptedMainHead(updates)
	if !ok {
		// No accepted non-deletion refs/heads/main update to reach from. main runs
		// this layer only after the refs and stowaways layers accepted exactly
		// such an update, so this is a defensive no-op (Decision: run only after
		// stowaways accepts).
		return nil, nil
	}

	// Pass 1 — the introduced blob paths and modes. Walk the introduced commits
	// and ls-tree -r each, de-duplicating identical (mode, sha, path) tuples, so
	// every path a blob is introduced at is seen with its mode (not the one path
	// `rev-list --objects` would annotate — hook.contents Decision). Each entry's
	// mode, path and component lengths are checked here; the .gitattributes
	// entries are remembered for the byte check in pass 3.
	commits, err := introducedCommits(repoDir, newHead)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{})
	sha2path := make(map[string]string)
	var gitattrEntries []treeEntry
	for _, commit := range commits {
		entries, err := lsTree(repoDir, commit)
		if err != nil {
			return nil, err
		}
		for _, e := range entries {
			key := e.Mode + " " + e.SHA + " " + e.Path
			if _, done := seen[key]; done {
				continue
			}
			seen[key] = struct{}{}
			if _, had := sha2path[e.SHA]; !had {
				sha2path[e.SHA] = e.Path
			}
			if !modeAllowed(e.Mode) {
				reasons = append(reasons, reasonBadMode(e.Path, modeDescription(e.Mode)))
				continue
			}
			if classifyPath(e.Path) == kindDisallowed {
				reasons = append(reasons, reasonDisallowedPath(e.Path))
				continue
			}
			if _, tooLong := overLongComponent(e.Path); tooLong {
				reasons = append(reasons, reasonOverLongComponent(e.Path))
				continue
			}
			if classifyPath(e.Path) == kindGitattributes {
				gitattrEntries = append(gitattrEntries, e)
			}
		}
	}

	// Pass 2 — the introduced objects' type and size, in one batch-check over
	// `rev-list --objects <new> --not --all`. This sizes the blob cap and the
	// tree/commit reasonable-size guard, and collects the unique blob shas whose
	// content pass 3 reads.
	objs, err := introducedObjects(repoDir, newHead)
	if err != nil {
		return nil, err
	}
	blobSHAs := make(map[string]struct{})
	for _, o := range objs {
		if o.Type == "blob" {
			blobSHAs[o.SHA] = struct{}{}
		}
		if !withinSizeLimit(o.Type, o.Size) {
			switch o.Type {
			case "blob":
				reasons = append(reasons, reasonOverSizeBlob(blobLabel(o.SHA, sha2path), o.Size))
			default:
				reasons = append(reasons, reasonOverSizeObject(o.Type, o.Size))
			}
		}
	}

	// Pass 3 — blob content. Read each unique introduced blob once and validate
	// UTF-8; read each root .gitattributes entry (even if its blob is unchanged
	// from a prior push) and require the exact app bytes. Content is read with
	// `git cat-file blob`, never parsed by hand.
	for sha := range blobSHAs {
		content, err := catFileBlob(repoDir, sha)
		if err != nil {
			return nil, err
		}
		if !validUTF8(content) {
			reasons = append(reasons, reasonNonUTF8(blobLabel(sha, sha2path)))
		}
	}
	for _, e := range gitattrEntries {
		content, err := catFileBlob(repoDir, e.SHA)
		if err != nil {
			return nil, err
		}
		// Name only the path — never the mismatching bytes (no song text or file
		// content in logs).
		if !gitattributesMatch(content) {
			reasons = append(reasons, reasonWrongGitattributes(e.Path))
		}
	}

	// Deterministic, de-duplicated output (reasons are gathered from map walks).
	sort.Strings(reasons)
	return dedupe(reasons), nil
}

// blobLabel is the path a blob is introduced at when known, else its object id
// (a content-addressed SHA, never song text) — so a refusal names where the
// fault is without ever logging the blob's bytes.
func blobLabel(sha string, sha2path map[string]string) string {
	if path, ok := sha2path[sha]; ok {
		return path
	}
	return sha
}

// The contents layer's refusal formatters, lifted out of the walk so the unit
// catalogue (messages_test.go) can enumerate every contents message
// deterministically (hook.messages). Each routes through refusal for the shared
// "<subject>: <fault>; refused" grammar; none carries blob bytes — only the
// pusher's path or the blob's SHA (blobLabel), its mode, and byte figures.

// reasonBadMode: a tree entry that is not a regular file (symlink, submodule,
// executable).
func reasonBadMode(path, modeDesc string) string {
	return refusal(MainRef, fmt.Sprintf(
		"%s is %s (only regular files are allowed — no symlinks, submodules, or executables)",
		path, modeDesc))
}

// reasonDisallowedPath: a path that is not an allowed songbook path.
func reasonDisallowedPath(path string) string {
	return refusal(MainRef, fmt.Sprintf(
		"%s is not an allowed path for a songbook (only *.cifra.md / *.setlist.md in any folder, a root README.md, and a root .gitattributes)",
		path))
}

// reasonOverLongComponent: a path with a component past maxNameBytes.
func reasonOverLongComponent(path string) string {
	return refusal(MainRef, fmt.Sprintf(
		"%s has a path component longer than %d bytes", path, maxNameBytes))
}

// reasonOverSizeBlob: a blob over the 256 KB per-file cap. label is the path or,
// if unknown, the blob SHA (blobLabel).
func reasonOverSizeBlob(label string, size int64) string {
	return refusal(MainRef, fmt.Sprintf(
		"%s is %d bytes, over the %d-byte (256 KB) per-file limit", label, size, maxBlobBytes))
}

// reasonOverSizeObject: a carrier object (tree or commit) over its
// reasonable-size guard rail.
func reasonOverSizeObject(objType string, size int64) string {
	return refusal(MainRef, fmt.Sprintf(
		"a %s object is %d bytes, over its reasonable-size limit", objType, size))
}

// reasonNonUTF8: a blob that is not valid UTF-8 text. label is the path or blob
// SHA (blobLabel) — never the bytes.
func reasonNonUTF8(label string) string {
	return refusal(MainRef, fmt.Sprintf("%s is not valid UTF-8 text", label))
}

// reasonWrongGitattributes: a root .gitattributes whose bytes are not exactly
// what the app writes. Names only the path, never the mismatching bytes.
func reasonWrongGitattributes(path string) string {
	return refusal(MainRef, fmt.Sprintf(
		"%s does not hold exactly the songbook .gitattributes the app writes", path))
}

// dedupe returns xs with adjacent duplicates removed (xs must be sorted).
func dedupe(xs []string) []string {
	if len(xs) == 0 {
		return nil
	}
	out := xs[:1]
	for _, x := range xs[1:] {
		if x != out[len(out)-1] {
			out = append(out, x)
		}
	}
	return out
}

// introducedCommits lists the commits reachable from newHead the repository did
// not already have, via `git rev-list newHead --not --all`, run with the
// inherited environment (the quarantine and the real store both visible).
func introducedCommits(repoDir, newHead string) ([]string, error) {
	out, err := runGit(repoDir, nil, "rev-list", newHead, "--not", "--all")
	if err != nil {
		return nil, fmt.Errorf("git rev-list %s --not --all: %w", newHead, err)
	}
	var commits []string
	sc := bufio.NewScanner(bytes.NewReader(out))
	for sc.Scan() {
		if line := strings.TrimSpace(sc.Text()); line != "" {
			commits = append(commits, line)
		}
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("reading rev-list output: %w", err)
	}
	return commits, nil
}

// lsTree lists every blob and gitlink reachable from commit with its tree-entry
// mode and path, via `git ls-tree -r`. core.quotePath=false keeps a normal
// UTF-8 path literal (git still C-quotes a path with a control byte, so line
// parsing stays safe). Do not reimplement tree walking (Constraint: delegate
// object knowledge to git).
func lsTree(repoDir, commit string) ([]treeEntry, error) {
	out, err := runGit(repoDir, nil, "-c", "core.quotePath=false", "ls-tree", "-r", commit)
	if err != nil {
		return nil, fmt.Errorf("git ls-tree -r %s: %w", commit, err)
	}
	return parseLsTree(bytes.NewReader(out))
}

// introducedObjects classifies and sizes every object reachable from newHead the
// repository did not already have: `git rev-list --objects <new> --not --all`
// gives the names, `git cat-file --batch-check` (fed that list on stdin) gives
// each object's type and byte size in one pass.
func introducedObjects(repoDir, newHead string) ([]objectInfo, error) {
	revOut, err := runGit(repoDir, nil, "rev-list", "--objects", newHead, "--not", "--all")
	if err != nil {
		return nil, fmt.Errorf("git rev-list --objects %s --not --all: %w", newHead, err)
	}
	names, err := ParseRevListObjects(bytes.NewReader(revOut))
	if err != nil {
		return nil, err
	}
	if len(names) == 0 {
		return nil, nil
	}
	var in strings.Builder
	for name := range names {
		in.WriteString(name)
		in.WriteByte('\n')
	}
	out, err := runGitStdin(repoDir, nil, []byte(in.String()),
		"cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)")
	if err != nil {
		return nil, fmt.Errorf("git cat-file --batch-check over the introduced objects: %w", err)
	}
	return parseBatchCheck(bytes.NewReader(out))
}

// catFileBlob returns a blob's raw bytes via `git cat-file blob`, run with the
// inherited environment so the quarantine is visible. The bytes are read into
// memory to validate UTF-8 / compare .gitattributes; the per-file cap (checked
// first from batch-check sizes) bounds how much.
func catFileBlob(repoDir, sha string) ([]byte, error) {
	out, err := runGit(repoDir, nil, "cat-file", "blob", sha)
	if err != nil {
		return nil, fmt.Errorf("git cat-file blob: %w", err)
	}
	return out, nil
}

// runGitStdin runs a git command in repoDir (empty = inherit cwd) with env (nil
// = inherit the process environment) and stdin, returning its stdout. A non-zero
// exit is an error carrying git's stderr but never the pushed object contents.
// It mirrors runGit (stowaways.go:257) for the one command that needs stdin.
func runGitStdin(repoDir string, env []string, stdin []byte, args ...string) ([]byte, error) {
	cmd := exec.Command("git", args...)
	if repoDir != "" {
		cmd.Dir = repoDir
	}
	if env != nil {
		cmd.Env = env
	}
	cmd.Stdin = bytes.NewReader(stdin)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if stderr.Len() > 0 {
			return nil, fmt.Errorf("%w: %s", err, strings.TrimSpace(stderr.String()))
		}
		return nil, err
	}
	return stdout.Bytes(), nil
}
