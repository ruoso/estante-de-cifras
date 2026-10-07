// Package book is the service's volume/git seam: one bare git repository per
// book under a configured root (/data/books/<id>.git — DIRECTION §3.3), created
// empty, forked as a full copy, read for its title, and removed, all by
// exec'ing the host git binary with argument arrays (never a shell). The
// handlers in internal/server own the HTTP and the registry rows; this package
// owns only the filesystem and git, so its pure parts — the path builder and
// the README-title parser — are unit-testable without a database or a volume
// (service.books Decision: a package, not git calls inline in the handler).
//
// A book's title is not stored in Postgres (DIRECTION §2.1): it is the level-1
// heading of the book's README.md, read here from refs/heads/main. A book with
// no first commit yet, or a README with no heading, has no derivable title, so
// callers fall back to PlaceholderTitle to keep the contract's required field
// non-empty.
package book

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

// PlaceholderTitle stands in when a book has no derivable title — its first
// commit has not landed, or its README has no level-1 heading. It is only ever
// seen for a foreign account's empty, unpushed book: the creating device shows
// its own shelf-local title (workflow 7 lines 16-18; service.books Decision).
const PlaceholderTitle = "Untitled book"

// Store is the books volume: one bare repository per book under Root. Root
// comes from configuration (ESTANTE_BOOKS_ROOT), never a request, and every id
// is validated as a UUID before it is joined into a path, so a request can
// never escape the volume root (service.books: random, opaque ids).
type Store struct {
	Root string
}

// repoPath joins Root and <id>.git, refusing an id that is not a canonical
// UUID. The id is opaque and random (the row's gen_random_uuid()); validating
// it as a UUID before it is ever joined into a path is what keeps a crafted id
// from escaping the volume root (DIRECTION §3.3 lines 186-187; task note).
func repoPath(root, id string) (string, error) {
	if _, err := uuid.Parse(id); err != nil {
		return "", fmt.Errorf("book: invalid id %q: %w", id, err)
	}
	return filepath.Join(root, id+".git"), nil
}

// Path is repoPath against the store's root, exported for callers that need the
// on-disk location of a book (none outside tests today).
func (s Store) Path(id string) (string, error) {
	return repoPath(s.Root, id)
}

// InitBare creates an empty bare repository for the book at <Root>/<id>.git with
// main as its initial branch. The service creates only the empty repository;
// the app pushes the first commit — the README and .gitattributes — once git
// over HTTP exists (service.books Decision; workflow 14 lines 174-178).
func (s Store) InitBare(ctx context.Context, id string) error {
	path, err := repoPath(s.Root, id)
	if err != nil {
		return err
	}
	_, err = runGit(ctx, "init", "--bare", "-b", "main", path)
	return err
}

// Fork copies the source book's repository, with all its history, to a new id
// on the same volume. --no-hardlinks forces a full, independent copy so the
// fork survives the source's later deletion and directory removal (workflow 11
// lines 19, 51-54; service.books Decision).
func (s Store) Fork(ctx context.Context, srcID, dstID string) error {
	src, err := repoPath(s.Root, srcID)
	if err != nil {
		return err
	}
	dst, err := repoPath(s.Root, dstID)
	if err != nil {
		return err
	}
	_, err = runGit(ctx, "clone", "--bare", "--no-hardlinks", src, dst)
	return err
}

// ReadTitle returns the book's title — the trimmed first level-1 heading of its
// README.md at refs/heads/main — and whether it could be read at all. ok is
// false when the repository has no first commit, no README, or is otherwise
// unreadable (a gone or inaccessible book); the title is then empty. When ok is
// true the title is non-empty (PlaceholderTitle when the README has no heading).
func (s Store) ReadTitle(ctx context.Context, id string) (string, bool) {
	path, err := repoPath(s.Root, id)
	if err != nil {
		return "", false
	}
	out, err := runGit(ctx, "--git-dir", path, "cat-file", "-p", "refs/heads/main:README.md")
	if err != nil {
		return "", false
	}
	return titleFromREADME(out), true
}

// Remove deletes the book's bare repository from the volume. A missing
// directory is not an error (delete is idempotent; deleted_at is the
// authoritative gate — service.books Decision).
func (s Store) Remove(id string) error {
	path, err := repoPath(s.Root, id)
	if err != nil {
		return err
	}
	return os.RemoveAll(path)
}

// titleFromREADME returns the trimmed text of the first level-1 ATX heading in
// the README bytes, or PlaceholderTitle when there is none — so a title is
// always non-empty (DIRECTION §2.1 line 74). Only `# Heading` counts; `## Sub`
// and deeper are not level-1.
func titleFromREADME(data []byte) string {
	sc := bufio.NewScanner(bytes.NewReader(data))
	// A README line can be long; raise the scanner's cap well above the default
	// 64 KB so a long first line does not truncate the heading search.
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if strings.HasPrefix(line, "# ") {
			if title := strings.TrimSpace(line[len("# "):]); title != "" {
				return title
			}
		}
	}
	return PlaceholderTitle
}

// runGit execs the host git binary with an argument array (never a shell) and a
// hardened environment: GIT_CONFIG_NOSYSTEM keeps system config out, and
// GIT_TERMINAL_PROMPT=0 makes git fail rather than block on a prompt
// (service.books: git by os/exec, standard library). stdout is returned;
// stderr is folded into the error, never logged as content.
func runGit(ctx context.Context, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("git %s: %w: %s", args[0], err, strings.TrimSpace(stderr.String()))
	}
	return stdout.Bytes(), nil
}
