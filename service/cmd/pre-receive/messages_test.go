package main

// messages_test.go is the emission contract for the binary's single refusal
// sink: refuseTo writes exactly one "pre-receive: "-prefixed, LF-terminated
// line per reason and returns the non-zero exit that refuses the whole push,
// and the fail-closed path emits the shared grammar for each aspect it cannot
// verify with no raw git error spliced into the client channel. Pins DIRECTION
// §3.6 L341 (a refusal reaches the client on git's own channel) and the "name
// only what failed" rule for fail-closed (hook.messages Decision).
//
// No git, no push — the real relay (git framing the stderr, both clients
// reading it) is the e2e level (e2e/api/messages.test.js); here it is the pure
// emission shape.

import (
	"bytes"
	"strings"
	"testing"

	"estantedecifras.app/service/internal/hook"
)

// TestRefuseToEmission: one prefixed, LF-terminated line per reason, non-zero
// exit, nothing else.
func TestRefuseToEmission(t *testing.T) {
	reasons := []string{
		"refs/heads/main: notas.txt is not an allowed path for a songbook; refused",
		"refs/heads/main: deleting the branch is not allowed; refused",
	}

	var buf bytes.Buffer
	code := refuseTo(&buf, reasons)
	if code == 0 {
		t.Errorf("refuseTo returned exit 0; a refusal must exit non-zero")
	}

	out := buf.String()
	if n := strings.Count(out, "\n"); n != len(reasons) {
		t.Errorf("want exactly %d LF-terminated lines, got %d in %q", len(reasons), n, out)
	}
	lines := strings.Split(strings.TrimSuffix(out, "\n"), "\n")
	if len(lines) != len(reasons) {
		t.Fatalf("want %d lines, got %d: %q", len(reasons), len(lines), out)
	}
	for i, reason := range reasons {
		want := "pre-receive: " + reason
		if lines[i] != want {
			t.Errorf("line %d = %q, want %q", i, lines[i], want)
		}
	}
}

// TestRefuseToEmpty: no reasons still exits non-zero and writes nothing (the
// caller only reaches refuse with at least one reason, but the sink must not
// leak a bare prefix).
func TestRefuseToEmpty(t *testing.T) {
	var buf bytes.Buffer
	if code := refuseTo(&buf, nil); code == 0 {
		t.Errorf("refuseTo(nil) exit 0; a refusal must exit non-zero")
	}
	if buf.Len() != 0 {
		t.Errorf("refuseTo(nil) wrote %q, want nothing", buf.String())
	}
}

// TestFailClosedEmission: every aspect the binary can fail to verify — the five
// checks plus the stdin parse — emits the shared grammar and carries no raw git
// error. The aspects are exactly those run() passes to hook.FailClosed.
func TestFailClosedEmission(t *testing.T) {
	aspects := []string{
		"the pushed ref updates", // ParseUpdates (stdin parse)
		"push history",           // Refs
		"pushed objects",         // Stowaways
		"book contents",          // Contents
		"canonical form",         // Canonical
		"push limits",            // Limits
	}

	for _, aspect := range aspects {
		reason := hook.FailClosed(aspect)
		wantReason := "refs/heads/main: could not verify " + aspect + "; refused"
		if reason != wantReason {
			t.Errorf("FailClosed(%q) = %q, want %q", aspect, reason, wantReason)
		}

		var buf bytes.Buffer
		if code := refuseTo(&buf, []string{reason}); code == 0 {
			t.Errorf("fail-closed for %q exited 0; must refuse non-zero", aspect)
		}
		line := strings.TrimSuffix(buf.String(), "\n")
		wantLine := "pre-receive: " + wantReason
		if line != wantLine {
			t.Errorf("fail-closed for %q emitted %q, want %q", aspect, line, wantLine)
		}
		// No raw git error: the message is exactly the aspect form — no "%v"
		// placeholder, no trailing ": <error>" spliced after the aspect.
		if strings.Contains(reason, "%") || strings.Count(reason, ": ") != 1 {
			t.Errorf("fail-closed for %q spliced extra detail: %q", aspect, reason)
		}
	}
}
