package main

import (
	"bufio"
	"bytes"
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
// usage line to stderr and exits 2.
func TestUsage(t *testing.T) {
	for _, args := range [][]string{nil, {"frobnicate"}} {
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
