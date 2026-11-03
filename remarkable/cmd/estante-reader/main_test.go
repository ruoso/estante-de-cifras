package main

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	gosync "sync"
	"testing"
	"time"

	"estantedecifras.app/remarkable/internal/pair"
	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
	"estantedecifras.app/remarkable/internal/update"
)

// TestVersion pins reader.module's --version: exactly
// "estante-reader <version>\n" on stdout, exit 0.
func TestVersion(t *testing.T) {
	for _, flag := range []string{"--version", "-version"} {
		var stdout, stderr bytes.Buffer
		if code := run([]string{flag}, &stdout, &stderr); code != 0 {
			t.Errorf("%s: exit %d, want 0", flag, code)
		}
		if got := stdout.String(); got != "estante-reader dev\n" {
			t.Errorf("%s: stdout %q, want %q", flag, got, "estante-reader dev\n")
		}
		if stderr.Len() != 0 {
			t.Errorf("%s: stderr %q, want empty", flag, stderr.String())
		}
	}
}

// TestUsage pins the usage path: no argument or an unknown one (a relative
// path is not AppLoad's socket) prints the usage line, which names run
// (reader.app_folder), to stderr and exits 2.
func TestUsage(t *testing.T) {
	for _, cmd := range []string{"--version", "sheet --bundle DIR", "bench --bundle DIR", "run [--root DIR] [--origin URL] [--app DIR] SOCKET"} {
		if !strings.Contains(usage, cmd) {
			t.Errorf("usage %q does not name %q", usage, cmd)
		}
	}
	for _, args := range [][]string{nil, {"frobnicate"}, {"--version", "extra"},
		{"estante.sock"}, {"/tmp/a.sock", "/tmp/b.sock"}, {"run"}, {"run", "--root", "/tmp/x"}} {
		var stdout, stderr bytes.Buffer
		if code := run(args, &stdout, &stderr); code != 2 {
			t.Errorf("%q: exit %d, want 2", args, code)
		}
		if got := stderr.String(); got != usage+"\n" {
			t.Errorf("%q: stderr %q, want %q", args, got, usage+"\n")
		}
		if !strings.Contains(stderr.String(), "--version") {
			t.Errorf("%q: usage does not name --version", args)
		}
		if stdout.Len() != 0 {
			t.Errorf("%q: stdout %q, want empty", args, stdout.String())
		}
	}
}

// TestBuiltBinaryAnswersVersion pins that the command links CGO-free and
// that the link-time version stamp reader.payload relies on works.
func TestBuiltBinaryAnswersVersion(t *testing.T) {
	gobin, err := exec.LookPath("go")
	if err != nil {
		t.Fatalf("go not found: %v", err)
	}
	bin := filepath.Join(t.TempDir(), "estante-reader")
	build := exec.Command(gobin, "build", "-ldflags", "-X main.version=test", "-o", bin, ".")
	build.Env = append(os.Environ(), "CGO_ENABLED=0")
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("go build: %v\n%s", err, out)
	}
	out, err := exec.Command(bin, "--version").Output()
	if err != nil {
		t.Fatalf("run --version: %v", err)
	}
	if got := string(out); got != "estante-reader test\n" {
		t.Errorf("stdout %q, want %q", got, "estante-reader test\n")
	}
}

// TestSelfUpdateOff pins install.sh's ESTANTE_FROM_SOURCE build: linked with
// -X main.selfUpdate=off, the backend has no updater (no pass checks the
// site) and --version says so; otherwise the updater is the store's.
func TestSelfUpdateOff(t *testing.T) {
	st, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if u := newUpdater(st, "/app"); u == nil || u.Store != st || u.AppDir != "/app" {
		t.Errorf("newUpdater = %+v, want the store's with the app folder", u)
	}
	saved := selfUpdate
	t.Cleanup(func() { selfUpdate = saved })
	selfUpdate = "off"
	if u := newUpdater(st, "/app"); u != nil {
		t.Errorf("newUpdater = %+v with selfUpdate off, want nil", u)
	}

	bin := filepath.Join(t.TempDir(), "estante-reader")
	build := exec.Command("go", "build", "-ldflags", "-X main.version=test -X main.selfUpdate=off", "-o", bin, ".")
	build.Env = append(os.Environ(), "CGO_ENABLED=0")
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("go build: %v\n%s", err, out)
	}
	out, err := exec.Command(bin, "--version").Output()
	if err != nil {
		t.Fatalf("run --version: %v", err)
	}
	if want := "estante-reader test (self-update off)\n"; string(out) != want {
		t.Errorf("stdout %q, want %q", out, want)
	}
}

// TestModuleSharesNoCode pins design §3.1 and DIRECTION §3.6: the reader's
// module neither requires the service nor replaces into service/ or app/.
func TestModuleSharesNoCode(t *testing.T) {
	f, err := os.Open("../../go.mod")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	inBlock := ""
	sc := bufio.NewScanner(f)
	for n := 1; sc.Scan(); n++ {
		line := strings.TrimSpace(sc.Text())
		if i := strings.Index(line, "//"); i >= 0 {
			line = strings.TrimSpace(line[:i])
		}
		directive := inBlock
		switch {
		case line == ")":
			inBlock = ""
			continue
		case strings.HasPrefix(line, "require ("), strings.HasPrefix(line, "replace ("):
			inBlock = strings.Fields(line)[0]
			continue
		case strings.HasPrefix(line, "require "), strings.HasPrefix(line, "replace "):
			directive = strings.Fields(line)[0]
		}
		if directive == "" {
			continue
		}
		if forbidden(line) {
			t.Errorf("go.mod:%d: %s shares code with the service or the app: %q", n, directive, line)
		}
	}
	if err := sc.Err(); err != nil {
		t.Fatal(err)
	}
}

// forbidden reports a directive line naming the service's module, or a
// filesystem path (relative, climbing out of remarkable/, or absolute) with a
// service/ or app/ directory in it.
func forbidden(line string) bool {
	if strings.Contains(line, "estantedecifras.app/service") {
		return true
	}
	for _, field := range strings.Fields(line) {
		p := filepath.ToSlash(filepath.Clean(field))
		if !strings.HasPrefix(p, "../") && !strings.HasPrefix(p, "/") {
			continue
		}
		for _, seg := range strings.Split(p, "/") {
			if seg == "service" || seg == "app" {
				return true
			}
		}
	}
	return false
}

// The built bundle and its example-book fixture, which `npm run build` in
// app/ writes; the gate builds the app before the reader.
const (
	builtBundle   = "../../../app/dist/device"
	exampleShapes = "../../../app/dist-test/device/example-book.default-shapes.json"
	exampleBook   = "../../../app/example-book"
)

func needBuild(t *testing.T) {
	t.Helper()
	for _, p := range []string{filepath.Join(builtBundle, "manifest.json"), exampleShapes} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("%v — run npm run build in app/", err)
		}
	}
}

// exampleTitles are the example book's song titles, which neither the bench
// nor an error line may print.
func exampleTitles(t *testing.T) []string {
	t.Helper()
	names, err := filepath.Glob(filepath.Join(exampleBook, "*.cifra.md"))
	if err != nil || len(names) == 0 {
		t.Fatalf("example book: %v", err)
	}
	var titles []string
	for _, n := range names {
		raw, err := os.ReadFile(n)
		if err != nil {
			t.Fatal(err)
		}
		first, _, _ := strings.Cut(string(raw), "\n")
		titles = append(titles, strings.TrimPrefix(first, "# "))
	}
	return titles
}

// TestSheetCommand pins `estante-reader sheet`: the sheet as JSON on stdout,
// exit 0, nothing on stderr.
func TestSheetCommand(t *testing.T) {
	needBuild(t)
	var stdout, stderr bytes.Buffer
	args := []string{"sheet", "--bundle", builtBundle, "--shapes", exampleShapes, "--key", "2",
		filepath.Join(exampleBook, "the-ferry-line.cifra.md")}
	if code := run(args, &stdout, &stderr); code != 0 {
		t.Fatalf("exit %d, stderr %q", code, stderr.String())
	}
	if stderr.Len() != 0 {
		t.Errorf("stderr %q, want empty", stderr.String())
	}
	var sheet struct {
		Title  string            `json:"title"`
		Offset int               `json:"offset"`
		Shapes []json.RawMessage `json:"shapes"`
	}
	if err := json.Unmarshal(stdout.Bytes(), &sheet); err != nil {
		t.Fatalf("stdout is not JSON: %v", err)
	}
	if sheet.Title != "The Ferry Line" || sheet.Offset != 2 || len(sheet.Shapes) == 0 {
		t.Errorf("sheet title %q, offset %d, %d shapes", sheet.Title, sheet.Offset, len(sheet.Shapes))
	}
}

// TestSheetCommandErrors pins the error paths: an I/O or engine error exits
// 1 with one stderr line carrying no song text; a bad invocation exits 2
// with the usage line.
func TestSheetCommandErrors(t *testing.T) {
	needBuild(t)
	titles := exampleTitles(t)
	song := filepath.Join(exampleBook, "the-ferry-line.cifra.md")
	for name, args := range map[string][]string{
		"missing song":             {"sheet", "--bundle", builtBundle, "--shapes", exampleShapes, filepath.Join(t.TempDir(), "absent.cifra.md")},
		"missing bundle":           {"sheet", "--bundle", t.TempDir(), "--shapes", exampleShapes, song},
		"shapes not a shapes file": {"sheet", "--bundle", builtBundle, "--shapes", song, song},
	} {
		var stdout, stderr bytes.Buffer
		if code := run(args, &stdout, &stderr); code != 1 {
			t.Errorf("%s: exit %d, want 1", name, code)
		}
		lines := strings.Split(strings.TrimSuffix(stderr.String(), "\n"), "\n")
		if len(lines) != 1 || lines[0] == "" {
			t.Errorf("%s: stderr %q, want one line", name, stderr.String())
		}
		for _, title := range titles {
			if strings.Contains(stderr.String(), title) {
				t.Errorf("%s: stderr %q carries song text", name, stderr.String())
			}
		}
		if stdout.Len() != 0 {
			t.Errorf("%s: stdout %q, want empty", name, stdout.String())
		}
	}
	for _, args := range [][]string{
		{"sheet"},
		{"sheet", "--bundle", builtBundle},
		{"sheet", "--bundle", builtBundle, "--key", "two", song},
		{"sheet", "--bundle", builtBundle, "--key", "12", song},
		{"sheet", "--frobnicate", song},
		{"sheet", "--bundle", builtBundle, song, song},
		{"bench", "--bundle", builtBundle},
		{"bench", "--bundle", builtBundle, "--rounds", "0", song},
	} {
		var stdout, stderr bytes.Buffer
		if code := run(args, &stdout, &stderr); code != 2 {
			t.Errorf("%q: exit %d, want 2", args, code)
		}
		if stderr.String() != usage+"\n" {
			t.Errorf("%q: stderr %q, want the usage line", args, stderr.String())
		}
	}
}

// TestBenchCommand pins `estante-reader bench`: the six §4.2 rows on stdout,
// and no song's title anywhere.
func TestBenchCommand(t *testing.T) {
	needBuild(t)
	songs, _ := filepath.Glob(filepath.Join(exampleBook, "*.cifra.md"))
	var stdout, stderr bytes.Buffer
	args := append([]string{"bench", "--bundle", builtBundle, "--shapes", exampleShapes, "--rounds", "1"}, songs...)
	if code := run(args, &stdout, &stderr); code != 0 {
		t.Fatalf("exit %d, stderr %q", code, stderr.String())
	}
	out := stdout.String()
	for _, label := range []string{"load bundle", "open song", "change key, first", "change key, again", "heap", "held"} {
		if !strings.Contains(out, label) {
			t.Errorf("stdout lacks %q:\n%s", label, out)
		}
	}
	if !strings.Contains(out, "misses 0") {
		t.Errorf("the example book's table should leave no misses:\n%s", out)
	}
	for _, title := range exampleTitles(t) {
		if strings.Contains(out, title) || strings.Contains(stderr.String(), title) {
			t.Errorf("bench printed the title %q", title)
		}
	}
}

// TestSyncUsage pins the pair, signout and sync invocations: the usage line
// names them (and no session stand-in, reader.pairing Decision 3); a bad one
// exits 2 with it; sync with no session exits 1 saying so.
func TestSyncUsage(t *testing.T) {
	if strings.Contains(usage, "session") {
		t.Errorf("usage %q still names the session stand-in", usage)
	}
	// reader.self_update: sync's bundle is optional (the store's current, or
	// the one its update brings), and it takes the app folder.
	for _, cmd := range []string{"pair --root DIR [--origin URL]", "signout --root DIR", "sync --root DIR [--bundle DIR] [--app DIR]"} {
		if !strings.Contains(usage, cmd) {
			t.Errorf("usage %q does not name %q", usage, cmd)
		}
	}
	for _, args := range [][]string{
		{"session", "--root", "r", "--origin", "https://estante.test"},
		{"pair"},
		{"pair", "--origin", "https://estante.test"},
		{"pair", "--root", "r", "extra"},
		{"signout"},
		{"signout", "--root", "r", "extra"},
		{"sync"},
		{"sync", "--bundle", "b"},
		{"sync", "--app", "a"},
		{"sync", "--root", "r", "--bundle", "b", "extra"},
	} {
		var stdout, stderr bytes.Buffer
		if code := run(args, &stdout, &stderr); code != 2 {
			t.Errorf("%q: exit %d, want 2", args, code)
		}
		if stderr.String() != usage+"\n" {
			t.Errorf("%q: stderr %q, want the usage line", args, stderr.String())
		}
	}
	needBuild(t)
	var stdout, stderr bytes.Buffer
	if code := run([]string{"sync", "--root", t.TempDir(), "--bundle", builtBundle}, &stdout, &stderr); code != 1 {
		t.Errorf("unpaired sync: exit %d, want 1", code)
	}
	if !strings.Contains(stderr.String(), "not paired") || stdout.Len() != 0 {
		t.Errorf("unpaired sync: stdout %q stderr %q", stdout.String(), stderr.String())
	}
}

// appLoad is AppLoad's side of the socket: the accepted connection, read
// through a protocol.Conn and written raw (the system types −1…−3 are
// AppLoad's to send, which protocol.Conn refuses).
type appLoad struct {
	t    *testing.T
	uc   *net.UnixConn
	conn *protocol.Conn
}

// send writes a header record, then the payload record, as AppLoad's
// management.cpp does.
func (a *appLoad) send(typ int32, payload string) {
	a.t.Helper()
	hdr := make([]byte, 8)
	binary.NativeEndian.PutUint32(hdr[0:4], uint32(typ))
	binary.NativeEndian.PutUint32(hdr[4:8], uint32(len(payload)))
	if _, err := a.uc.Write(hdr); err != nil {
		a.t.Fatalf("send %d header: %v", typ, err)
	}
	if _, err := a.uc.Write([]byte(payload)); err != nil {
		a.t.Fatalf("send %d payload: %v", typ, err)
	}
}

// listen listens on a unixpacket socket in a temporary directory, as AppLoad
// does at /tmp/<id>.sock, and returns its path and the accepted side.
func listen(t *testing.T) (string, <-chan *appLoad) {
	t.Helper()
	sock := filepath.Join(t.TempDir(), "estante.sock")
	ln, err := net.ListenUnix("unixpacket", &net.UnixAddr{Name: sock, Net: "unixpacket"})
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { ln.Close() })
	accepted := make(chan *appLoad, 1)
	go func() {
		defer close(accepted)
		ln.SetDeadline(time.Now().Add(10 * time.Second))
		uc, err := ln.AcceptUnix()
		if err != nil {
			return
		}
		c, err := protocol.NewConn(uc)
		if err != nil {
			uc.Close()
			return
		}
		accepted <- &appLoad{t: t, uc: uc, conn: c}
	}()
	return sock, accepted
}

// servesHelloAndTerminate drives one run: the backend dials, answers a hello
// with a state, and returns 0 on AppLoad's terminate (−1 close).
func servesHelloAndTerminate(t *testing.T, args []string, accepted <-chan *appLoad, then ...func(*appLoad)) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	code := make(chan int, 1)
	go func() { code <- run(args, &stdout, &stderr) }()
	var a *appLoad
	select {
	case a = <-accepted:
	case got := <-code:
		t.Fatalf("run returned %d before dialling; stderr %q", got, stderr.String())
	case <-time.After(10 * time.Second):
		t.Fatal("run did not dial")
	}
	if a == nil {
		t.Fatal("accept failed")
	}
	defer a.conn.Close()
	a.send(protocol.TypeHello, "{}")
	m, err := a.conn.Next()
	if err != nil {
		t.Fatalf("receive: %v", err)
	}
	if _, ok := m.(protocol.State); !ok {
		t.Fatalf("got %T, want protocol.State", m)
	}
	for _, f := range then {
		f(a)
	}
	a.send(protocol.TypeTerminate, "close")
	select {
	case got := <-code:
		if got != 0 {
			t.Errorf("exit %d, want 0; stderr %q", got, stderr.String())
		}
	case <-time.After(10 * time.Second):
		t.Fatal("run did not return after terminate")
	}
	if stdout.Len() != 0 || stderr.Len() != 0 {
		t.Errorf("stdout %q, stderr %q; want both empty", stdout.String(), stderr.String())
	}
}

// TestRunServesTheSocket pins reader.app_folder's run: it dials the socket,
// answers hello with a state (design §6), and exits 0 on terminate; and
// reader.backend_views': open{settings} is answered with 107 settings naming
// the binary's version (workflow 19 §The shelf, Settings).
func TestRunServesTheSocket(t *testing.T) {
	root := t.TempDir()
	// Paired (with a service that is not there): unpaired, an open is
	// answered with the empty shelf (reader.pairing).
	st, err := store.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := st.SetSession(store.Session{Origin: "http://127.0.0.1:1", Token: "t"}); err != nil {
		t.Fatal(err)
	}
	sock, accepted := listen(t)
	servesHelloAndTerminate(t, []string{"run", "--root", root, sock}, accepted, func(a *appLoad) {
		a.send(protocol.TypeOpen, `{"view":"settings"}`)
		for {
			m, err := a.conn.Next()
			if err != nil {
				t.Fatalf("receive: %v", err)
			}
			if _, ok := m.(protocol.State); ok {
				continue // a sync status may come first
			}
			s, ok := m.(protocol.Settings)
			if !ok {
				t.Fatalf("got %T, want protocol.Settings", m)
			}
			if s.Version != version {
				t.Errorf("settings version %q, want the binary's %q", s.Version, version)
			}
			if s.HiddenShapes != 0 || s.Account != "" {
				t.Errorf("settings %+v, want no account and nothing hidden", s)
			}
			return
		}
	})
	if _, err := os.Stat(filepath.Join(root, "bundle")); err != nil {
		t.Errorf("the store was not opened at --root: %v", err)
	}
}

// TestBareSocketPathIsRun pins backend/entry as AppLoad starts it: a sole
// absolute path is run against the default store (rm-appload
// src/library.cpp L24–41, argv[1] the socket path; design §3.1).
func TestBareSocketPathIsRun(t *testing.T) {
	root := t.TempDir()
	saved := defaultRoot
	defaultRoot = root
	t.Cleanup(func() { defaultRoot = saved })
	sock, accepted := listen(t)
	servesHelloAndTerminate(t, []string{sock}, accepted)
	if _, err := os.Stat(filepath.Join(root, "bundle")); err != nil {
		t.Errorf("the store was not opened at the default root: %v", err)
	}
}

// TestRunDialFails: no socket, exit 1, and the error line names the dial's
// class — not the socket's path, nor anything read from it (design §10).
func TestRunDialFails(t *testing.T) {
	sock := filepath.Join(t.TempDir(), "secret-name", "missing.sock")
	var stdout, stderr bytes.Buffer
	if code := run([]string{"run", "--root", t.TempDir(), sock}, &stdout, &stderr); code != 1 {
		t.Errorf("exit %d, want 1", code)
	}
	got := stderr.String()
	if !strings.HasPrefix(got, "estante-reader run: could not dial") {
		t.Errorf("stderr %q, want the dial's error line", got)
	}
	if strings.Contains(got, "secret-name") || strings.Contains(got, "missing.sock") {
		t.Errorf("stderr %q names the socket's path", got)
	}
	if stdout.Len() != 0 {
		t.Errorf("stdout %q, want empty", stdout.String())
	}
}

// --- pairing (reader.pairing) ---

// TestRunOriginDefault pins Constraint 1: run pairs with
// https://www.estantedecifras.app unless --origin says otherwise — also when
// AppLoad starts it with the socket's path alone.
func TestRunOriginDefault(t *testing.T) {
	for _, tc := range []struct {
		args []string
		want string
	}{
		{[]string{"/tmp/estante.sock"}, "https://www.estantedecifras.app"},
		{[]string{"--root", defaultRoot, "/tmp/estante.sock"}, "https://www.estantedecifras.app"},
		{[]string{"--origin", "http://localhost:8080", "/tmp/estante.sock"}, "http://localhost:8080"},
		{[]string{"--origin", "https://stack.test/", "/tmp/estante.sock"}, "https://stack.test"},
	} {
		root, origin, _, socket, err := runFlags(tc.args)
		if err != nil {
			t.Errorf("%q: %v", tc.args, err)
			continue
		}
		if got := pair.OriginString(origin); got != tc.want {
			t.Errorf("%q: origin %s, want %s", tc.args, got, tc.want)
		}
		if root != defaultRoot || socket != "/tmp/estante.sock" {
			t.Errorf("%q: root %q socket %q", tc.args, root, socket)
		}
	}
}

// TestOriginMustBeHTTP pins Constraint 1: an --origin that is not
// http(s)://host[:port] is a usage error, for run and pair alike.
func TestOriginMustBeHTTP(t *testing.T) {
	for _, origin := range []string{"estantedecifras.app", "ftp://estante.test", "https://estante.test/pair",
		"https://user@estante.test", "https://", ""} {
		for _, args := range [][]string{
			{"run", "--root", t.TempDir(), "--origin", origin, "/tmp/estante.sock"},
			{"pair", "--root", t.TempDir(), "--origin", origin},
		} {
			var stdout, stderr bytes.Buffer
			if code := run(args, &stdout, &stderr); code != 2 {
				t.Errorf("%q: exit %d, want 2", args, code)
			}
			if stderr.String() != usage+"\n" {
				t.Errorf("%q: stderr %q, want the usage line", args, stderr.String())
			}
		}
	}
}

const (
	cmdPollToken = "poll-token-cmd-0123456789"
	cmdSession   = "session-cmd-0123456789-secret"
)

// pairService answers begin, then poll: pending, then the status given.
func pairService(t *testing.T, end string) *httptest.Server {
	t.Helper()
	var mu gosync.Mutex
	polls := 0
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/devices/pair/begin", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"code": "KQ7-4TM", "url": "https://estantedecifras.app/pair",
			"pollToken": cmdPollToken, "expiresAt": "2026-11-02T14:42:00Z",
		})
	})
	mux.HandleFunc("POST /api/devices/pair/poll", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		polls++
		n := polls
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		switch {
		case n < 3:
			w.Write([]byte(`{"status":"pending"}`))
		case end == "approved":
			w.Write([]byte(`{"status":"approved","session":"` + cmdSession + `"}`))
		default:
			w.Write([]byte(`{"status":"expired"}`))
		}
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func fastPolls(t *testing.T) {
	saved := pollInterval
	pollInterval = 5 * time.Millisecond
	t.Cleanup(func() { pollInterval = saved })
}

// TestPairPrintsTheCodeNotTheToken pins the pair subcommand (Constraints 2,
// 11): one JSON line {code, url, expiresAt} on stdout, exit 0 once approved
// with the session in session.json (0600) for the origin; neither the poll
// token nor the session printed. Expired: exit 1, nothing kept.
func TestPairPrintsTheCodeNotTheToken(t *testing.T) {
	fastPolls(t)
	srv := pairService(t, "approved")
	root := filepath.Join(t.TempDir(), "estante")
	var stdout, stderr bytes.Buffer
	if code := run([]string{"pair", "--root", root, "--origin", srv.URL}, &stdout, &stderr); code != 0 {
		t.Fatalf("exit %d, stderr %q", code, stderr.String())
	}
	lines := strings.Split(strings.TrimSuffix(stdout.String(), "\n"), "\n")
	if len(lines) != 1 {
		t.Fatalf("stdout %d lines, want one", len(lines))
	}
	var line map[string]string
	if err := json.Unmarshal([]byte(lines[0]), &line); err != nil {
		t.Fatalf("stdout is not one JSON line: %v", err)
	}
	want := map[string]string{"code": "KQ7-4TM", "url": "https://estantedecifras.app/pair", "expiresAt": "2026-11-02T14:42:00Z"}
	if len(line) != len(want) || line["code"] != want["code"] || line["url"] != want["url"] || line["expiresAt"] != want["expiresAt"] {
		t.Errorf("stdout %v, want %v", line, want)
	}
	for _, secret := range []string{cmdPollToken, cmdSession} {
		if strings.Contains(stdout.String(), secret) || strings.Contains(stderr.String(), secret) {
			t.Errorf("a secret was printed")
		}
	}
	if stderr.Len() != 0 {
		t.Errorf("stderr %q, want empty", stderr.String())
	}
	info, err := os.Stat(filepath.Join(root, "session.json"))
	if err != nil {
		t.Fatal(err)
	}
	if mode := info.Mode().Perm(); mode != 0o600 {
		t.Errorf("session.json mode %o, want 600", mode)
	}
	st, err := store.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	sess, ok := st.Session()
	if !ok || sess.Token != cmdSession || sess.Origin != srv.URL {
		t.Errorf("session kept %v, origin %q, the token kept %v", ok, sess.Origin, sess.Token == cmdSession)
	}

	// Expired: exit 1, no session, no secret.
	expired := pairService(t, "expired")
	root2 := filepath.Join(t.TempDir(), "estante")
	stdout.Reset()
	stderr.Reset()
	if code := run([]string{"pair", "--root", root2, "--origin", expired.URL}, &stdout, &stderr); code != 1 {
		t.Errorf("expired: exit %d, want 1", code)
	}
	if !strings.Contains(stderr.String(), "expired") || strings.Contains(stderr.String(), cmdPollToken) ||
		strings.Contains(stderr.String(), "KQ7-4TM") {
		t.Errorf("expired: stderr %q", stderr.String())
	}
	if _, err := os.Stat(filepath.Join(root2, "session.json")); err == nil {
		t.Error("expired: a session was kept")
	}
}

// TestSignOutCommandClears pins the signout subcommand (workflow 19 §The
// shelf, Sign out): the service asked to end the session with its cookie;
// the session, home book, books and state gone, the bundle kept.
func TestSignOutCommandClears(t *testing.T) {
	var mu gosync.Mutex
	var cookies []string
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/auth/signout", func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie("estante_session")
		mu.Lock()
		if err == nil {
			cookies = append(cookies, c.Value)
		}
		mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	root := t.TempDir()
	st, err := store.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := st.SetSession(store.Session{Origin: srv.URL, Token: cmdSession}); err != nil {
		t.Fatal(err)
	}
	dir, _ := st.BookDir("b1")
	if err := os.MkdirAll(filepath.Join(dir, "objects"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := st.StageBundle(map[string][]byte{"manifest.json": []byte("{}")}); err != nil {
		t.Fatal(err)
	}
	if err := st.PromoteBundle(); err != nil {
		t.Fatal(err)
	}

	var stdout, stderr bytes.Buffer
	if code := run([]string{"signout", "--root", root}, &stdout, &stderr); code != 0 {
		t.Fatalf("exit %d, stderr %q", code, stderr.String())
	}
	if stdout.Len() != 0 || stderr.Len() != 0 {
		t.Errorf("stdout %q stderr %q, want both empty", stdout.String(), stderr.String())
	}
	mu.Lock()
	got := append([]string(nil), cookies...)
	mu.Unlock()
	if len(got) != 1 || got[0] != cmdSession {
		t.Errorf("signout called %d times with the session's cookie %v", len(got), len(got) == 1 && got[0] == cmdSession)
	}
	again, err := store.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := again.Session(); ok {
		t.Error("still paired")
	}
	if ids, _ := again.BookIDs(); len(ids) != 0 {
		t.Errorf("books kept: %v", ids)
	}
	if _, ok := again.BundleDir(); !ok {
		t.Error("the bundle was removed")
	}
}

// --- the self-update at start (reader.self_update) ---

// bundleFiles is a bundle directory's files: the manifest naming code by its
// hashed name and SHA-256, under the built bundle's hostApi and salt.
func bundleFiles(t *testing.T, code []byte) (map[string][]byte, string) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(builtBundle, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(code)
	sha := hex.EncodeToString(sum[:])
	name := "bundle." + sha[:8] + ".js"
	m["bundle"] = map[string]any{"path": name, "sha256": sha}
	mraw, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	return map[string][]byte{"manifest.json": mraw, name: code}, sha
}

// builtCode is the built bundle's code.
func builtCode(t *testing.T) []byte {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(builtBundle, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var m struct {
		Bundle struct{ Path string } `json:"bundle"`
	}
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	code, err := os.ReadFile(filepath.Join(builtBundle, m.Bundle.Path))
	if err != nil {
		t.Fatal(err)
	}
	return code
}

// TestRunRollsBackABundleThatDoesNotOpen pins reader.self_update constraint
// 10 (design §8): a bundle/current that does not evaluate, with a good
// previous, starts with the previous current and the bad one refused.
func TestRunRollsBackABundleThatDoesNotOpen(t *testing.T) {
	needBuild(t)
	root := t.TempDir()
	st, err := store.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	good, goodSHA := bundleFiles(t, builtCode(t))
	bad, badSHA := bundleFiles(t, []byte(`throw new Error("broken");`))
	for _, files := range []map[string][]byte{good, bad} {
		if err := st.StageBundle(files); err != nil {
			t.Fatal(err)
		}
		if err := st.PromoteBundle(); err != nil {
			t.Fatal(err)
		}
	}
	sock, accepted := listen(t)
	servesHelloAndTerminate(t, []string{"run", "--root", root, sock}, accepted)

	st, err = store.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	dir, ok := st.BundleDir()
	if !ok {
		t.Fatal("no current bundle after the start")
	}
	if got := update.BundleSHA(dir); got != goodSHA {
		t.Errorf("current bundle %s, want the good previous %s", got, goodSHA)
	}
	if got := st.Refused(); len(got) != 1 || got[0] != badSHA {
		t.Errorf("refused %v, want [%s]", got, badSHA)
	}
}

// TestBareSocketPathAppIsTheWorkingDirectory pins reader.self_update
// constraint 12: run reached by AppLoad's bare socket path places the QML in
// its working directory, the app folder; an explicit run has none.
func TestBareSocketPathAppIsTheWorkingDirectory(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	_, _, app, socket, err := runFlags(bareRunArgs("/tmp/estante.sock"))
	if err != nil {
		t.Fatal(err)
	}
	if app != wd || socket != "/tmp/estante.sock" {
		t.Errorf("bare socket path: app %q socket %q, want %q and the socket", app, socket, wd)
	}
	if _, _, app, _, err := runFlags([]string{"/tmp/estante.sock"}); err != nil || app != "" {
		t.Errorf("explicit run: app %q (%v), want none", app, err)
	}
}
