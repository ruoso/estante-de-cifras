package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
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

// TestUsage pins the usage path: no argument or an unknown one prints the
// three-command usage line to stderr and exits 2.
func TestUsage(t *testing.T) {
	for _, cmd := range []string{"--version", "sheet --bundle DIR", "bench --bundle DIR"} {
		if !strings.Contains(usage, cmd) {
			t.Errorf("usage %q does not name %q", usage, cmd)
		}
	}
	for _, args := range [][]string{nil, {"frobnicate"}, {"--version", "extra"}} {
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
