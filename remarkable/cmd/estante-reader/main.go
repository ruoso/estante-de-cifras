// Command estante-reader is the reMarkable reader's backend: the binary
// AppLoad runs as the app folder's backend/entry (docs/remarkable-reader.md
// §3). Its subcommands are cases of run's dispatch:
//
//   - --version prints the version;
//   - sheet prints one song's sheet at a key as JSON, from the engine
//     (reader.engine), for development and for the screens' fixtures;
//   - bench re-measures the reading path rows of the design's §4.2;
//   - session keeps a session, its token read from stdin (never argv, which
//     every process on the device can read), for development until pairing
//     lands (design §12 step 3; reader.sync);
//   - sync runs one sync pass and prints what it did: ids, statuses and
//     heads (reader.sync, and the e2e-api's driver).
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"runtime"
	"strings"
	"time"

	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/sync"
)

// version is stamped at link time with -ldflags "-X main.version=<v>".
var version = "dev"

const usage = "usage: estante-reader --version | " +
	"sheet --bundle DIR [--shapes FILE] [--key N] [--variation V] SONG | " +
	"bench --bundle DIR [--shapes FILE] [--rounds N] SONG... | " +
	"session --root DIR --origin URL (token on stdin) | " +
	"sync --root DIR --bundle DIR"

// errUsage is a bad invocation: the usage line, exit 2.
var errUsage = errors.New("usage")

// stdin is what session reads the token from; a test replaces it.
var stdin io.Reader = os.Stdin

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

// run dispatches on args and returns the process exit status. It never
// prints song text or secrets to stderr: only the version, the usage line and
// error lines that name the error, never a song's words.
func run(args []string, stdout, stderr io.Writer) int {
	var err error
	switch {
	case len(args) == 1 && (args[0] == "--version" || args[0] == "-version"):
		fmt.Fprintf(stdout, "estante-reader %s\n", version)
		return 0
	case len(args) > 0 && args[0] == "sheet":
		err = sheetCommand(args[1:], stdout)
	case len(args) > 0 && args[0] == "bench":
		err = benchCommand(args[1:], stdout)
	case len(args) > 0 && args[0] == "session":
		err = sessionCommand(args[1:], stdin)
	case len(args) > 0 && args[0] == "sync":
		err = syncCommand(args[1:], stdout)
	default:
		err = errUsage
	}
	switch {
	case err == nil:
		return 0
	case errors.Is(err, errUsage):
		fmt.Fprintln(stderr, usage)
		return 2
	default:
		fmt.Fprintf(stderr, "estante-reader %s: %v\n", args[0], err)
		return 1
	}
}

// shapesFile is what --shapes reads: an instrument entry and its §4.6
// table, as the build's fixtures carry them.
type shapesFile struct {
	Entry json.RawMessage `json:"entry"`
	Table json.RawMessage `json:"table"`
}

func readShapes(path string) (shapesFile, error) {
	var s shapesFile
	if path == "" {
		return s, nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return s, err
	}
	if err := json.Unmarshal(raw, &s); err != nil {
		return s, fmt.Errorf("%s: not a shapes file", path)
	}
	return s, nil
}

func newFlags(name string) *flag.FlagSet {
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	return fs
}

// sheetCommand: estante-reader sheet --bundle DIR [--shapes FILE] [--key N]
// [--variation V] SONG. stdout is the sheet — the output asked for, not a log.
func sheetCommand(args []string, stdout io.Writer) error {
	fs := newFlags("sheet")
	bundle := fs.String("bundle", "", "")
	shapes := fs.String("shapes", "", "")
	key := fs.Int("key", 0, "")
	variation := fs.String("variation", "", "")
	if fs.Parse(args) != nil || *bundle == "" || fs.NArg() != 1 || *key > 11 {
		return errUsage
	}
	s, err := readShapes(*shapes)
	if err != nil {
		return err
	}
	text, err := os.ReadFile(fs.Arg(0))
	if err != nil {
		return err
	}
	e, err := engine.Open(*bundle)
	if err != nil {
		return err
	}
	defer e.Close()
	ctx := context.Background()
	if _, err := e.Load(ctx, s.Entry, s.Table); err != nil {
		return err
	}
	sheet, err := e.Sheet(ctx, string(text), *key, engine.SheetOptions{Variation: *variation})
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(sheet, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(stdout, "%s\n", out)
	return err
}

// benchCommand: estante-reader bench --bundle DIR [--shapes FILE]
// [--rounds N] SONG... — the §4.2 rows, each a mean over the rounds (and the
// songs). Each round opens the bundle afresh, so "first" is first each time.
// It prints timings and counts only; a song is named by its index.
func benchCommand(args []string, stdout io.Writer) error {
	fs := newFlags("bench")
	bundle := fs.String("bundle", "", "")
	shapes := fs.String("shapes", "", "")
	rounds := fs.Int("rounds", 3, "")
	if fs.Parse(args) != nil || *bundle == "" || fs.NArg() == 0 || *rounds < 1 {
		return errUsage
	}
	s, err := readShapes(*shapes)
	if err != nil {
		return err
	}
	texts := make([]string, fs.NArg())
	for i, path := range fs.Args() {
		raw, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("song %d: %w", i, err)
		}
		texts[i] = string(raw)
	}

	ctx := context.Background()
	var load, open, first, again mean
	var heap uint64
	var held engine.Held
	for r := range *rounds {
		start := time.Now()
		e, err := engine.Open(*bundle)
		if err != nil {
			return err
		}
		load.add(time.Since(start))
		err = benchRound(ctx, e, s, texts, &open, &first, &again)
		if err == nil && r == *rounds-1 {
			var ms runtime.MemStats
			runtime.ReadMemStats(&ms)
			heap = ms.HeapAlloc
			held, err = e.Held(ctx)
		}
		e.Close()
		if err != nil {
			return err
		}
	}
	fmt.Fprintf(stdout, "load bundle        %s\n", load)
	fmt.Fprintf(stdout, "open song          %s\n", open)
	fmt.Fprintf(stdout, "change key, first  %s\n", first)
	fmt.Fprintf(stdout, "change key, again  %s\n", again)
	fmt.Fprintf(stdout, "heap               %.1f MiB\n", float64(heap)/(1<<20))
	fmt.Fprintf(stdout, "held               songs %d, shapes %d, rebuilt %d, misses %d\n",
		held.Songs, held.Shapes, held.Rebuilt, held.Misses)
	return nil
}

func benchRound(ctx context.Context, e *engine.Engine, s shapesFile, texts []string, open, first, again *mean) error {
	if _, err := e.Load(ctx, s.Entry, s.Table); err != nil {
		return err
	}
	for i, text := range texts {
		timed := func(m *mean, offset int) error {
			start := time.Now()
			_, err := e.Sheet(ctx, text, offset, engine.SheetOptions{})
			m.add(time.Since(start))
			if err != nil {
				return fmt.Errorf("song %d: %w", i, err)
			}
			return nil
		}
		if err := timed(open, 0); err != nil {
			return err
		}
		for k := 1; k < 12; k++ {
			if err := timed(first, k); err != nil {
				return err
			}
		}
		for k := 1; k < 12; k++ {
			if err := timed(again, k); err != nil {
				return err
			}
		}
	}
	return nil
}

// mean is a running mean of durations.
type mean struct {
	total time.Duration
	n     int
}

func (m *mean) add(d time.Duration) { m.total += d; m.n++ }

func (m mean) String() string {
	if m.n == 0 {
		return "-"
	}
	return fmt.Sprintf("%.2f ms (n=%d)", float64(m.total)/float64(time.Millisecond)/float64(m.n), m.n)
}

// maxToken bounds what session reads from stdin.
const maxToken = 4096

// sessionCommand: estante-reader session --root DIR --origin URL, the token
// on stdin. It keeps the session in the store (session.json, 0600) and
// prints nothing: the token is never echoed, never in an error.
func sessionCommand(args []string, in io.Reader) error {
	fs := newFlags("session")
	root := fs.String("root", "", "")
	origin := fs.String("origin", "", "")
	if fs.Parse(args) != nil || *root == "" || *origin == "" || fs.NArg() != 0 {
		return errUsage
	}
	u, err := url.Parse(*origin)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil {
		return errors.New("--origin is not an http(s) origin")
	}
	raw, err := io.ReadAll(io.LimitReader(in, maxToken+1))
	if err != nil {
		return errors.New("reading the token from stdin failed")
	}
	token := strings.TrimSpace(string(raw))
	if token == "" || len(raw) > maxToken || strings.ContainsAny(token, " \t\r\n;") {
		return errors.New("stdin holds no token")
	}
	st, err := store.Open(*root)
	if err != nil {
		return err
	}
	return st.SetSession(store.Session{
		Origin:   u.Scheme + "://" + u.Host,
		Token:    token,
		PairedAt: time.Now().UTC(),
	})
}

// syncCommand: estante-reader sync --root DIR --bundle DIR — one pass, its
// Result on stdout as JSON: ids, statuses and heads, nothing else.
func syncCommand(args []string, stdout io.Writer) error {
	fs := newFlags("sync")
	root := fs.String("root", "", "")
	bundle := fs.String("bundle", "", "")
	if fs.Parse(args) != nil || *root == "" || *bundle == "" || fs.NArg() != 0 {
		return errUsage
	}
	st, err := store.Open(*root)
	if err != nil {
		return err
	}
	e, err := engine.Open(*bundle)
	if err != nil {
		return err
	}
	defer e.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	res, err := sync.New(st, e, sync.Options{}).Pass(ctx)
	if err != nil {
		return err
	}
	out, err := json.MarshalIndent(res, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(stdout, "%s\n", out)
	return err
}
