package engine

// unit — the engine against small synthetic bundles written into a temporary
// directory (reader.engine; docs/remarkable-reader.md §3.2, §4, §8, §10).

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

const testSalt = "test-salt"

// host is a minimal estante, with hostApi and salt filled in by bundleJS.
const host = `
globalThis.estante = {
  hostApi: %API%,
  salt: "%SALT%",
  load: function (entry, table) { return { fingerprint: null, tuningId: "", held: 0 }; },
  sheet: function (text, offset) {
    return { title: "T", artist: null, key: { written: null, named: null, status: null },
      offset: offset, transposed: offset !== 0, rows: [], shapes: [], unvoiced: [], notes: [], keyNote: null };
  },
  setlist: function () { return { title: null, items: [], missing: 0 }; },
  misses: function () { return []; },
  held: function () { return { songs: 0, shapes: 0, rebuilt: 0, misses: 0 }; },
};
`

func bundleJS(api, salt, extra string) string {
	return strings.NewReplacer("%API%", api, "%SALT%", salt).Replace(host) + extra
}

// writeBundle writes code and a correct manifest into a new directory, then
// lets edit change the manifest before it is written.
func writeBundle(t *testing.T, code string, edit func(m map[string]any)) string {
	t.Helper()
	dir := t.TempDir()
	sum := sha256.Sum256([]byte(code))
	hash := hex.EncodeToString(sum[:])
	name := "bundle." + hash[:8] + ".js"
	if err := os.WriteFile(filepath.Join(dir, name), []byte(code), 0o644); err != nil {
		t.Fatal(err)
	}
	m := map[string]any{
		"version": hash[:12],
		"hostApi": 1,
		"salt":    testSalt,
		"bundle":  map[string]any{"path": name, "sha256": hash},
	}
	if edit != nil {
		edit(m)
	}
	raw, _ := json.Marshal(m)
	if err := os.WriteFile(filepath.Join(dir, ManifestFile), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func open(t *testing.T, code string) *Engine {
	t.Helper()
	e, err := Open(writeBundle(t, code, nil))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { e.Close() })
	return e
}

// TestOpenRefusesOtherHostAPI pins the note's "a bundle of another hostApi
// refused": by the manifest, and by the evaluated estante.hostApi.
func TestOpenRefusesOtherHostAPI(t *testing.T) {
	dir := writeBundle(t, bundleJS("2", testSalt, ""), func(m map[string]any) { m["hostApi"] = 2 })
	if _, err := Open(dir); !errors.Is(err, ErrHostAPI) {
		t.Errorf("manifest hostApi 2: %v, want ErrHostAPI", err)
	}
	dir = writeBundle(t, bundleJS("2", testSalt, ""), nil)
	if _, err := Open(dir); !errors.Is(err, ErrHostAPI) {
		t.Errorf("estante.hostApi 2 under a manifest saying 1: %v, want ErrHostAPI", err)
	}
	dir = writeBundle(t, bundleJS(`"1"`, testSalt, ""), nil)
	if _, err := Open(dir); !errors.Is(err, ErrHostAPI) {
		t.Errorf("estante.hostApi \"1\": %v, want ErrHostAPI", err)
	}
}

// TestOpenRefusesBadBundle pins each refusal of Open as its own error, so
// reader.self_update can keep the last good bundle (§8).
func TestOpenRefusesBadBundle(t *testing.T) {
	good := bundleJS("1", testSalt, "")
	cases := []struct {
		name string
		dir  func(t *testing.T) string
		want error
	}{
		{"checksum mismatch", func(t *testing.T) string {
			return writeBundle(t, good, func(m map[string]any) {
				m["bundle"].(map[string]any)["sha256"] = strings.Repeat("0", 64)
			})
		}, ErrChecksum},
		{"missing manifest", func(t *testing.T) string {
			dir := writeBundle(t, good, nil)
			os.Remove(filepath.Join(dir, ManifestFile))
			return dir
		}, ErrManifest},
		{"manifest not JSON", func(t *testing.T) string {
			dir := writeBundle(t, good, nil)
			os.WriteFile(filepath.Join(dir, ManifestFile), []byte("{not json"), 0o644)
			return dir
		}, ErrManifest},
		{"missing bundle file", func(t *testing.T) string {
			return writeBundle(t, good, func(m map[string]any) {
				m["bundle"].(map[string]any)["path"] = "bundle.absent.js"
			})
		}, ErrBundleMissing},
		{"no globalThis.estante", func(t *testing.T) string {
			return writeBundle(t, "var x = 1;", nil)
		}, ErrNoHost},
		{"salt mismatch", func(t *testing.T) string {
			return writeBundle(t, bundleJS("1", "another-salt", ""), nil)
		}, ErrSalt},
		{"throws on evaluation", func(t *testing.T) string {
			return writeBundle(t, good+`throw new TypeError("broken bundle");`, nil)
		}, ErrEvaluate},
	}
	all := []error{ErrManifest, ErrBundleMissing, ErrChecksum, ErrHostAPI, ErrNoHost, ErrSalt, ErrEvaluate}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			e, err := Open(c.dir(t))
			if e != nil {
				e.Close()
				t.Fatal("Open returned an engine")
			}
			if !errors.Is(err, c.want) {
				t.Fatalf("Open: %v, want %v", err, c.want)
			}
			for _, other := range all {
				if other != c.want && errors.Is(err, other) {
					t.Errorf("Open: %v is also %v", err, other)
				}
			}
		})
	}
}

// TestRuntimeHasNoHostGlobals pins that the engine adds nothing beyond goja
// and the bundle's own polyfills (§4): no console, require, timers, fetch or
// process.
func TestRuntimeHasNoHostGlobals(t *testing.T) {
	e := open(t, bundleJS("1", testSalt, `
estante.setlist = function () {
  return { title: [typeof console, typeof require, typeof setTimeout, typeof fetch, typeof process].join(","),
    items: [], missing: 0 };
};`))
	got, err := e.Setlist(context.Background(), "", "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if want := "undefined,undefined,undefined,undefined,undefined"; got.Title == nil || *got.Title != want {
		t.Errorf("globals %v, want %s", got.Title, want)
	}
}

// TestCallErrorCarriesNoArguments pins §10: a call that throws names the call
// and the exception, never the text it was handed.
func TestCallErrorCarriesNoArguments(t *testing.T) {
	e := open(t, bundleJS("1", testSalt, `
estante.sheet = function (text) { throw new RangeError("cannot read this"); };`))
	const marker = "SONG-TEXT-MARKER-7f3a"
	_, err := e.Sheet(context.Background(), "# "+marker+"\n", 0, SheetOptions{})
	if err == nil {
		t.Fatal("no error")
	}
	var ce *CallError
	if !errors.As(err, &ce) {
		t.Fatalf("%v is not a CallError", err)
	}
	msg := err.Error()
	for _, want := range []string{"sheet", "RangeError", "cannot read this"} {
		if !strings.Contains(msg, want) {
			t.Errorf("error %q does not name %q", msg, want)
		}
	}
	if strings.Contains(msg, marker) {
		t.Errorf("error %q carries the song text", msg)
	}
}

// TestCancelInterrupts pins cancellation: a call that never returns is
// interrupted when its context ends, and the next call is answered.
func TestCancelInterrupts(t *testing.T) {
	e := open(t, bundleJS("1", testSalt, `
var plain = estante.sheet;
estante.sheet = function (text, offset) { if (text === "forever") { for (;;) {} } return plain(text, offset); };`))
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, err := e.Sheet(ctx, "forever", 0, SheetOptions{}); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Sheet: %v, want DeadlineExceeded", err)
	}
	got, err := e.Sheet(context.Background(), "fine", 4, SheetOptions{})
	if err != nil || got.Offset != 4 {
		t.Fatalf("next call: %+v, %v", got, err)
	}
	// A context already done runs nothing.
	done, stop := context.WithCancel(context.Background())
	stop()
	if _, err := e.Sheet(done, "fine", 0, SheetOptions{}); !errors.Is(err, context.Canceled) {
		t.Errorf("done context: %v, want Canceled", err)
	}
}

// TestCallsAreSerialised pins §3.2: one goroutine owns the runtime, so calls
// from many goroutines never overlap in it.
func TestCallsAreSerialised(t *testing.T) {
	e := open(t, bundleJS("1", testSalt, `
var busy = false, calls = 0, overlaps = 0;
estante.held = function () {
  if (busy) overlaps += 1;
  busy = true;
  calls += 1;
  for (var i = 0; i < 20000; i += 1) {}
  busy = false;
  return { songs: calls, shapes: overlaps, rebuilt: 0, misses: 0 };
};`))
	const n = 32
	var wg sync.WaitGroup
	errs := make(chan error, n)
	for range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := e.Held(context.Background()); err != nil {
				errs <- err
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Errorf("Held: %v", err)
	}
	got, err := e.Held(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got.Songs != n+1 || got.Shapes != 0 {
		t.Errorf("calls %d (want %d), overlaps %d (want 0)", got.Songs, n+1, got.Shapes)
	}
}

// TestClose pins Close: later calls return ErrClosed, and Close is
// idempotent.
func TestClose(t *testing.T) {
	e, err := Open(writeBundle(t, bundleJS("1", testSalt, ""), nil))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.Held(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := e.Close(); err != nil {
		t.Fatal(err)
	}
	if err := e.Close(); err != nil {
		t.Errorf("second Close: %v", err)
	}
	ctx := context.Background()
	if _, err := e.Held(ctx); !errors.Is(err, ErrClosed) {
		t.Errorf("Held: %v", err)
	}
	if _, err := e.Sheet(ctx, "x", 0, SheetOptions{}); !errors.Is(err, ErrClosed) {
		t.Errorf("Sheet: %v", err)
	}
	if _, err := e.Load(ctx, nil, nil); !errors.Is(err, ErrClosed) {
		t.Errorf("Load: %v", err)
	}
	if _, err := e.Misses(ctx); !errors.Is(err, ErrClosed) {
		t.Errorf("Misses: %v", err)
	}
	if _, err := e.Setlist(ctx, "", "", nil); !errors.Is(err, ErrClosed) {
		t.Errorf("Setlist: %v", err)
	}
}

// TestLoadSameIsNoop pins Decision 3: the bundle's load clears its memos, so
// the same entry and table again never reaches it; a changed table does.
func TestLoadSameIsNoop(t *testing.T) {
	e := open(t, bundleJS("1", testSalt, `
var loads = 0;
estante.load = function (entry, table) {
  loads += 1;
  return { fingerprint: table ? table.fingerprint : null, tuningId: entry ? entry.id : "", held: loads };
};`))
	ctx := context.Background()
	entry := json.RawMessage(`{"id": "standard"}`)
	first, err := e.Load(ctx, entry, json.RawMessage(`{"fingerprint":"a","shapes":{}}`))
	if err != nil {
		t.Fatal(err)
	}
	// The same JSON, spaced differently, is the same table.
	again, err := e.Load(ctx, json.RawMessage(`{"id":"standard"}`), json.RawMessage(`{ "fingerprint": "a", "shapes": {} }`))
	if err != nil {
		t.Fatal(err)
	}
	if first.Held != 1 || again.Held != 1 || *again.Fingerprint != "a" || again.TuningID != first.TuningID {
		t.Errorf("same load: %+v then %+v, want one JS load answered twice", first, again)
	}
	changed, err := e.Load(ctx, entry, json.RawMessage(`{"fingerprint":"b","shapes":{}}`))
	if err != nil {
		t.Fatal(err)
	}
	if changed.Held != 2 || changed.Fingerprint == nil || *changed.Fingerprint != "b" {
		t.Errorf("changed table: %+v, want the second JS load", changed)
	}
}

// TestSheetUnreadable pins {error:"unreadable"} becoming ErrUnreadable.
func TestSheetUnreadable(t *testing.T) {
	e := open(t, bundleJS("1", testSalt, `
estante.sheet = function () { return { error: "unreadable" }; };`))
	if _, err := e.Sheet(context.Background(), "x", 0, SheetOptions{}); !errors.Is(err, ErrUnreadable) {
		t.Errorf("Sheet: %v, want ErrUnreadable", err)
	}
}

// TestCloseInterruptsACallInFlight pins that Close does not wait forever on a
// call that never returns.
func TestCloseInterruptsACallInFlight(t *testing.T) {
	e, err := Open(writeBundle(t, bundleJS("1", testSalt, `
estante.misses = function () { for (;;) {} };`), nil))
	if err != nil {
		t.Fatal(err)
	}
	got := make(chan error, 1)
	go func() {
		_, err := e.Misses(context.Background())
		got <- err
	}()
	time.Sleep(20 * time.Millisecond)
	e.Close()
	select {
	case err := <-got:
		if !errors.Is(err, ErrClosed) {
			t.Errorf("Misses: %v, want ErrClosed", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the call in flight was never interrupted")
	}
}
