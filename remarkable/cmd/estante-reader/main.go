// Command estante-reader is the reMarkable reader's backend: the binary
// AppLoad runs as the app folder's backend/entry (docs/remarkable-reader.md
// §3). Its subcommands are cases of run's dispatch:
//
//   - --version prints the version;
//   - sheet prints one song's sheet at a key as JSON, from the engine
//     (reader.engine), for development and for the screens' fixtures;
//   - bench re-measures the reading path rows of the design's §4.2;
//   - pair pairs the device with an account (reader.pairing): it begins,
//     prints the code as one JSON line, polls, and keeps the session once
//     approved — the backend's pairing, for development and the e2e-api;
//   - signout signs the device out as Settings' Sign out does;
//   - sync runs one sync pass and prints what it did: ids, statuses and
//     heads (reader.sync, and the e2e-api's driver);
//   - run is the backend proper (reader.app_folder): it dials AppLoad's
//     socket and serves the frontend (internal/backend) while the sync
//     schedule runs, pairing with --origin. AppLoad starts backend/entry with
//     the socket's path as its only argument (rm-appload src/library.cpp), so
//     a sole absolute path is run against the default store and origin
//     (design §3.1).
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
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"estantedecifras.app/remarkable/internal/backend"
	"estantedecifras.app/remarkable/internal/engine"
	"estantedecifras.app/remarkable/internal/pair"
	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/sync"
)

// version is stamped at link time with -ldflags "-X main.version=<v>".
var version = "dev"

const usage = "usage: estante-reader --version | " +
	"sheet --bundle DIR [--shapes FILE] [--key N] [--variation V] SONG | " +
	"bench --bundle DIR [--shapes FILE] [--rounds N] SONG... | " +
	"pair --root DIR [--origin URL] | " +
	"signout --root DIR | " +
	"sync --root DIR --bundle DIR | " +
	"run [--root DIR] [--origin URL] SOCKET"

// errUsage is a bad invocation: the usage line, exit 2.
var errUsage = errors.New("usage")

// pollInterval is how often pair polls (pair.DefaultInterval); a test
// replaces it.
var pollInterval = pair.DefaultInterval

// defaultRoot is the store run uses without --root: the device's
// (store.DefaultRoot); a test replaces it.
var defaultRoot = store.DefaultRoot

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
	case len(args) > 0 && args[0] == "pair":
		err = pairCommand(args[1:], stdout)
	case len(args) > 0 && args[0] == "signout":
		err = signOutCommand(args[1:])
	case len(args) > 0 && args[0] == "sync":
		err = syncCommand(args[1:], stdout)
	case len(args) > 0 && args[0] == "run":
		err = runCommand(args[1:])
	case len(args) == 1 && strings.HasPrefix(args[0], "/"):
		// AppLoad's backend/entry /tmp/estante.sock: no subcommand starts
		// with "/".
		err = runCommand([]string{"--root", defaultRoot, args[0]})
		args = []string{"run"}
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

// originFlag reads --origin: http(s)://host[:port], or a usage error (the
// value never echoed).
func originFlag(value string) (*url.URL, error) {
	u, err := pair.ParseOrigin(value)
	if err != nil {
		return nil, errUsage
	}
	return u, nil
}

// pairCommand: estante-reader pair --root DIR [--origin URL] — begins a
// pairing with the origin (pair.DefaultOrigin by default), prints the code as
// one JSON line {code, url, expiresAt}, polls, and once approved keeps the
// session in the store (session.json, 0600) and exits 0; expired, 1. Nothing
// else is printed: never the poll token, never the session.
func pairCommand(args []string, stdout io.Writer) error {
	fs := newFlags("pair")
	root := fs.String("root", "", "")
	originArg := fs.String("origin", pair.DefaultOrigin, "")
	if fs.Parse(args) != nil || *root == "" || fs.NArg() != 0 {
		return errUsage
	}
	origin, err := originFlag(*originArg)
	if err != nil {
		return err
	}
	st, err := store.Open(*root)
	if err != nil {
		return err
	}
	if _, paired := st.Session(); paired {
		return errors.New("already paired; sign out first")
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()
	c := &pair.Client{Origin: origin, Interval: pollInterval}
	p, err := c.Begin(ctx)
	if err != nil {
		return err
	}
	line, err := json.Marshal(p.Code())
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(stdout, "%s\n", line); err != nil {
		return err
	}
	session, err := c.Wait(ctx, p)
	if err != nil {
		return err
	}
	return st.SetSession(store.Session{
		Origin:   pair.OriginString(origin),
		Token:    session,
		PairedAt: time.Now().UTC(),
	})
}

// signOutCommand: estante-reader signout --root DIR — signs the device out
// as Settings' Sign out does: the service asked to end the session (a few
// seconds at most), then the session, the home book, the books and the state
// removed, the bundle kept.
func signOutCommand(args []string) error {
	fs := newFlags("signout")
	root := fs.String("root", "", "")
	if fs.Parse(args) != nil || *root == "" || fs.NArg() != 0 {
		return errUsage
	}
	st, err := store.Open(*root)
	if err != nil {
		return err
	}
	return sync.New(st, nil, sync.Options{}).SignOut(context.Background())
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

// runFlags reads run's arguments: the root, the origin pairing begins with,
// and the socket.
func runFlags(args []string) (root string, origin *url.URL, socket string, err error) {
	fs := newFlags("run")
	rootArg := fs.String("root", defaultRoot, "")
	originArg := fs.String("origin", pair.DefaultOrigin, "")
	if fs.Parse(args) != nil || *rootArg == "" || fs.NArg() != 1 || fs.Arg(0) == "" {
		return "", nil, "", errUsage
	}
	origin, err = originFlag(*originArg)
	if err != nil {
		return "", nil, "", err
	}
	return *rootArg, origin, fs.Arg(0), nil
}

// runCommand: estante-reader run [--root DIR] [--origin URL] SOCKET — the
// backend AppLoad runs. It opens the store and, when a bundle is installed
// and opens, the engine; builds the sync schedule with its statuses relayed
// to the frontend; dials SOCKET; and serves until AppLoad's terminate or the
// socket's close, pairing with the origin (pair.DefaultOrigin by default).
// It logs nothing: an error names its class, never a payload, a song or a
// token.
func runCommand(args []string) error {
	root, origin, socket, err := runFlags(args)
	if err != nil {
		return err
	}
	st, err := store.Open(root)
	if err != nil {
		return err
	}
	// The engine is optional: without a bundle (reader.self_update brings it)
	// sync runs and loads no instrument, and the views answer no music. A
	// bundle that fails to open is none. Each side is handed a nil interface
	// then, never a nil *engine.Engine inside one (which would not be nil).
	var syncEng sync.Engine
	var viewEng backend.Engine
	if dir, ok := st.BundleDir(); ok {
		if e, err := engine.Open(dir); err == nil {
			defer e.Close()
			syncEng, viewEng = e, e
		}
	}
	relay := backend.NewRelay()
	syncer := sync.New(st, syncEng, sync.Options{OnStatus: relay.StatusFunc()})

	conn, err := protocol.Dial(socket)
	if err != nil {
		return dialError(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()
	err = backend.Serve(ctx, conn, backend.Deps{
		Store: st, Syncer: syncer, Relay: relay, Now: time.Now,
		Engine: viewEng, Version: version,
		Pair: &pair.Client{Origin: origin},
	})
	if err != nil && ctx.Err() != nil {
		// A signal is an ending like terminate.
		return nil
	}
	return err
}

// dialError names a failed dial by its errno, not by the socket's path.
func dialError(err error) error {
	var errno syscall.Errno
	if errors.As(err, &errno) {
		return fmt.Errorf("could not dial AppLoad's socket: %s", errno.Error())
	}
	return errors.New("could not dial AppLoad's socket")
}
