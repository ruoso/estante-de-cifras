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
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

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

// ResolveHead resolves the book's main branch to its commit SHA — the single
// ref read the change check is sized on (DIRECTION §3.3/§3.4: "a ref read for
// the change check"; service.change_check Constraint 2). It runs one
// `git rev-parse --verify refs/heads/main` over the same hardened runGit seam
// as ReadTitle — argument arrays, GIT_CONFIG_NOSYSTEM, never a shell — and walks
// no history and reads no object. ok is false, with a nil error, when the book
// has no refs/heads/main yet (an empty book whose first commit has not landed)
// or the repository is otherwise unreadable; the sha is then empty. A non-nil
// error is reserved for an id that is not a canonical UUID (a path that could
// escape the volume root), which the caller resolves from the registry before
// ever reaching here.
func (s Store) ResolveHead(ctx context.Context, id string) (string, bool, error) {
	path, err := repoPath(s.Root, id)
	if err != nil {
		return "", false, err
	}
	out, err := runGit(ctx, "--git-dir", path, "rev-parse", "--verify", "refs/heads/main")
	if err != nil {
		// No refs/heads/main yet (an empty book) or an unreadable repository:
		// nothing to report, not an error — the book simply has no head.
		return "", false, nil
	}
	return strings.TrimSpace(string(out)), true, nil
}

// CountNewSaves counts the saves on the original's main that the fork's main
// does not have yet — the number a fork's shelf entry shows as "Ana's Choros has
// 3 new saves" (workflow 11 lines 42-46; sync.fork_follow AC2). A save is a
// non-merge commit (workflow 4: one save, one commit; merges are sync's), so the
// original's own sync merges never inflate it. It runs
//
//	git --git-dir <original> rev-list --count --no-merges <origHead> --not <forkHead>
//
// with the fork's object directory lent as an alternate, read-only: the two
// repositories are independent copies on one volume (Fork's --no-hardlinks), so
// the fork's own commits are only reachable through its objects, and an
// alternate set through the environment is never written to either repository's
// config. Nothing is written to either repository. It answers 0, with a nil
// error, when either main is absent (an empty book has no saves to bring in) or
// the repositories cannot be read; a non-nil error is reserved for an id that is
// not a canonical UUID.
func (s Store) CountNewSaves(ctx context.Context, originalID, forkID string) (int, error) {
	origPath, err := repoPath(s.Root, originalID)
	if err != nil {
		return 0, err
	}
	forkPath, err := repoPath(s.Root, forkID)
	if err != nil {
		return 0, err
	}
	origHead, ok, err := s.ResolveHead(ctx, originalID)
	if err != nil || !ok {
		return 0, err
	}
	forkHead, ok, err := s.ResolveHead(ctx, forkID)
	if err != nil || !ok {
		return 0, err
	}
	if origHead == forkHead {
		return 0, nil
	}
	cmd := exec.CommandContext(ctx, "git", "--git-dir", origPath,
		"rev-list", "--count", "--no-merges", origHead, "--not", forkHead)
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0",
		"GIT_ALTERNATE_OBJECT_DIRECTORIES="+filepath.Join(forkPath, "objects"))
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		// An unreadable pair has nothing truthful to count: no new saves.
		return 0, nil
	}
	n, err := strconv.Atoi(strings.TrimSpace(stdout.String()))
	if err != nil {
		return 0, nil
	}
	return n, nil
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

// GitStream describes one git smart-HTTP stateless-rpc invocation against a
// book's bare repository (service.git_http): which service to run
// ("upload-pack" or "receive-pack"), whether it only advertises refs (the
// info/refs GET), the request body piped to git's stdin and the writer git's
// stdout is streamed to, plus the extra process environment and hooks path the
// service layers on — GIT_PROTOCOL for protocol v2, and core.hooksPath and the
// ESTANTE_* push environment on a receive-pack. The handler in internal/server
// owns the HTTP framing and the service header; Serve owns only spawning git
// and streaming to and from it, beside the buffered runGit.
type GitStream struct {
	Service       string    // "upload-pack" or "receive-pack"
	AdvertiseRefs bool      // the info/refs GET: add --advertise-refs, no stdin
	Stdin         io.Reader // the request body; nil for an advertisement
	Stdout        io.Writer // where git's stdout is streamed as it is produced
	Env           []string  // extra KEY=VALUE pairs (GIT_PROTOCOL, ESTANTE_*)
	HooksDir      string    // core.hooksPath, set only for a push; "" runs no hook
	MaxInputSize  int64     // receive.maxInputSize on a push (bytes); 0 leaves git's default
}

// Serve spawns git for one stateless-rpc invocation against the book's bare
// repository and streams to and from it, never buffering stdout (a large fetch
// result or advertisement must not be held whole in memory — service.git_http
// Constraint 10). git runs in its own process group so a cancel of ctx (the
// per-request deadline or a client disconnect) kills git and any child with it,
// leaving no process behind and — git's quarantine and ref-lock model — the
// bare repository intact. stderr is folded into the returned error, never
// streamed or logged as content (no song text in logs). The hardened
// environment runGit uses (GIT_CONFIG_NOSYSTEM, GIT_TERMINAL_PROMPT=0) is kept.
func (s Store) Serve(ctx context.Context, id string, st GitStream) error {
	path, err := repoPath(s.Root, id)
	if err != nil {
		return err
	}
	args := make([]string, 0, 10)
	// core.hooksPath points git at the one hooks directory (a push only); when
	// that directory holds no hook, git simply runs none and accepts the push.
	if st.HooksDir != "" {
		args = append(args, "-c", "core.hooksPath="+st.HooksDir)
	}
	// Git's own push guards on a receive-pack: fsckObjects refuses a malformed
	// object during index-pack, and maxInputSize caps the incoming pack — both
	// enforced by git before the pre-receive hook runs. They ride the spawn, not
	// each repo's config, so every repository and every push carries them
	// uniformly, with no drift and no migration of repos created earlier
	// (hook.limits Decision).
	if st.Service == "receive-pack" {
		args = append(args, "-c", "receive.fsckObjects=true")
		if st.MaxInputSize > 0 {
			args = append(args, "-c", "receive.maxInputSize="+strconv.FormatInt(st.MaxInputSize, 10))
		}
	}
	args = append(args, st.Service, "--stateless-rpc")
	if st.AdvertiseRefs {
		args = append(args, "--advertise-refs")
	}
	args = append(args, path)

	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0")
	cmd.Env = append(cmd.Env, st.Env...)
	cmd.Stdin = st.Stdin
	cmd.Stdout = st.Stdout
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	// A new process group (Setpgid) so the kill below reaches git and any child
	// it spawned, not just the leader — no child outlives the request.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		// Signal the whole group (negative pid); the group id is the leader's pid
		// because of Setpgid.
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	// Bound the wait after a cancel so a wedged stdout copy cannot hold the
	// request open indefinitely.
	cmd.WaitDelay = 2 * time.Second
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git %s: %w: %s", st.Service, err, strings.TrimSpace(stderr.String()))
	}
	return nil
}

// Size is the book's full on-disk footprint — the sum of the regular-file bytes
// under its bare repository, history included (workflow 14 line 41) — the value
// the push path writes to books.size_bytes so the account quota stays live
// (service.git_http Decision). A missing repository is size 0, not an error
// (a just-deleted book counts against no quota). It is the directory walk the
// Decision chose over git count-objects, which misses the full footprint.
func (s Store) Size(id string) (int64, error) {
	path, err := repoPath(s.Root, id)
	if err != nil {
		return 0, err
	}
	var total int64
	walkErr := filepath.WalkDir(path, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if d.Type().IsRegular() {
			info, err := d.Info()
			if err != nil {
				return err
			}
			total += info.Size()
		}
		return nil
	})
	if walkErr != nil {
		return 0, walkErr
	}
	return total, nil
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
