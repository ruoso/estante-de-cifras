package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"estantedecifras.app/remarkable/internal/protocol"
	"estantedecifras.app/remarkable/internal/store"
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
	for _, cmd := range []string{"--version", "sheet --bundle DIR", "bench --bundle DIR", "run [--root DIR] SOCKET"} {
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

// TestSessionReadsTokenFromStdin pins reader.sync Decision 11: session takes
// the token on stdin, never argv, keeps it in session.json at 0600, and
// prints it nowhere.
func TestSessionReadsTokenFromStdin(t *testing.T) {
	const token = "tok-stdin-0123456789-secret"
	root := filepath.Join(t.TempDir(), "estante")
	defer func(r io.Reader) { stdin = r }(stdin)
	stdin = strings.NewReader(token + "\n")
	var stdout, stderr bytes.Buffer
	if code := run([]string{"session", "--root", root, "--origin", "https://estante.test/"}, &stdout, &stderr); code != 0 {
		t.Fatalf("exit %d, stderr %q", code, stderr.String())
	}
	if strings.Contains(stdout.String(), token) || strings.Contains(stderr.String(), token) {
		t.Error("the token was printed")
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
	if !ok || sess.Token != token || sess.Origin != "https://estante.test" {
		t.Errorf("session kept %v, origin %q, token kept %v", ok, sess.Origin, sess.Token == token)
	}

	// No token on stdin, or a bad origin: exit 1, nothing kept, no token.
	for name, tc := range map[string]struct {
		in   string
		args []string
	}{
		"empty stdin": {"", []string{"session", "--root", filepath.Join(t.TempDir(), "r"), "--origin", "https://estante.test"}},
		"bad origin":  {token, []string{"session", "--root", filepath.Join(t.TempDir(), "r"), "--origin", "estante.test"}},
	} {
		stdin = strings.NewReader(tc.in)
		var stdout, stderr bytes.Buffer
		if code := run(tc.args, &stdout, &stderr); code != 1 {
			t.Errorf("%s: exit %d, want 1", name, code)
		}
		if strings.Contains(stderr.String(), token) {
			t.Errorf("%s: stderr carries the token", name)
		}
		if _, err := os.Stat(filepath.Join(tc.args[2], "session.json")); err == nil {
			t.Errorf("%s: a session was kept", name)
		}
	}
}

// TestSyncUsage pins the session and sync invocations: the usage line names
// both; a bad one exits 2 with it; sync with no session exits 1 saying so.
func TestSyncUsage(t *testing.T) {
	for _, cmd := range []string{"session --root DIR --origin URL", "sync --root DIR --bundle DIR"} {
		if !strings.Contains(usage, cmd) {
			t.Errorf("usage %q does not name %q", usage, cmd)
		}
	}
	for _, args := range [][]string{
		{"session"},
		{"session", "--root", "r"},
		{"session", "--origin", "https://estante.test"},
		{"session", "--root", "r", "--origin", "https://estante.test", "the-token"},
		{"sync"},
		{"sync", "--root", "r"},
		{"sync", "--bundle", "b"},
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
func servesHelloAndTerminate(t *testing.T, args []string, accepted <-chan *appLoad) {
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
// answers hello with a state (design §6), and exits 0 on terminate.
func TestRunServesTheSocket(t *testing.T) {
	root := t.TempDir()
	sock, accepted := listen(t)
	servesHelloAndTerminate(t, []string{"run", "--root", root, sock}, accepted)
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
