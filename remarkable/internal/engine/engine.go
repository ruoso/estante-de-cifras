// Package engine is the reader's Go host for the web app's own music code
// (docs/remarkable-reader.md §3.2, §4): it opens a device bundle (the
// manifest and the bundle it names), checks it, evaluates it in one goja
// runtime owned by one goroutine for the engine's lifetime, and exposes the
// bundle's host API to Go as typed, goroutine-safe methods.
//
// Values cross the boundary as JSON: Go marshals the arguments, the runtime
// JSON.parses them, calls estante.<name> and JSON.stringifies the answer, and
// Go unmarshals it. Rows and diagram models stay raw, for the protocol to
// forward untouched. No goja value ever leaves the owner goroutine.
//
// The engine adds nothing to the runtime — no console, no require, no timers,
// no Go function — so a global the bundle needs and its own polyfills do not
// install fails a call rather than hiding behind a host shim.
//
// The runtime lives as long as the engine, so the bundle's memos (each song's
// parsed model, each shape rebuilt from the table) hold for as long as the
// backend runs; and Load is a no-op for the instrument and table already
// loaded, since the bundle's load clears them. Nothing here searches: a chord
// the table does not hold comes back pending (§4.1).
//
// The package logs nothing, and its errors name the call and the JavaScript
// exception, never the arguments: no song text in an error (§10).
package engine

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"unicode/utf8"

	"github.com/dop251/goja"
)

// HostAPI is the one version of the bundle's host API this engine speaks
// (app/src/device/host-api.js).
const HostAPI = 1

// ManifestFile is the manifest's name inside a bundle directory (§8).
const ManifestFile = "manifest.json"

// The refusals of Open, each its own so reader.self_update can tell "this
// bundle is not for me" from "this bundle is broken" and keep the last good
// one. The errors Open returns wrap them (errors.Is).
var (
	// ErrManifest: the manifest is absent, not JSON, or names no bundle file
	// inside the directory.
	ErrManifest = errors.New("engine: manifest missing or unreadable")
	// ErrBundleMissing: the bundle file the manifest names is absent.
	ErrBundleMissing = errors.New("engine: bundle file missing")
	// ErrChecksum: the bundle's SHA-256 differs from the manifest's.
	ErrChecksum = errors.New("engine: bundle checksum mismatch")
	// ErrHostAPI: the manifest's hostApi, or the evaluated estante.hostApi,
	// is not HostAPI, or they disagree.
	ErrHostAPI = errors.New("engine: host API not spoken")
	// ErrNoHost: after evaluation there is no globalThis.estante.
	ErrNoHost = errors.New("engine: bundle defines no estante")
	// ErrSalt: estante.salt disagrees with the manifest's salt.
	ErrSalt = errors.New("engine: salt mismatch")
	// ErrEvaluate: evaluating the bundle threw.
	ErrEvaluate = errors.New("engine: bundle evaluation failed")
)

var (
	// ErrClosed is returned by every call after Close.
	ErrClosed = errors.New("engine: closed")
	// ErrUnreadable is Sheet's answer for a text that does not parse.
	ErrUnreadable = errors.New("engine: song unreadable")
)

// CallError is a host call that threw in the runtime. It carries the call's
// name and the exception's class and message, never the arguments.
type CallError struct {
	Call    string
	Class   string
	Message string
}

func (e *CallError) Error() string {
	return fmt.Sprintf("engine: %s: %s: %s", e.Call, e.Class, e.Message)
}

// Manifest is the bundle directory's manifest.json (§8).
type Manifest struct {
	Version string `json:"version"`
	HostAPI int    `json:"hostApi"`
	Salt    string `json:"salt"`
	Bundle  struct {
		Path   string `json:"path"`
		SHA256 string `json:"sha256"`
	} `json:"bundle"`
}

// Loaded is load's answer: the table's fingerprint (null without a usable
// table), the instrument's tuning id, and how many shapes the table holds.
type Loaded struct {
	Fingerprint *string `json:"fingerprint"`
	TuningID    string  `json:"tuningId"`
	Held        int     `json:"held"`
}

// SheetOptions are sheet's options: the voicing variation (for the session's
// tuning), the song's songs.json variations by tuning id (which win over
// Variation when given: the bundle picks its own session's tuning from them),
// the preferences register model (raw), a setlist's target key, and the
// account's saved transposition (nil when none), named as Key.Saved.
type SheetOptions struct {
	Variation   string
	Variations  map[string]string
	Preferences json.RawMessage
	TargetKey   string
	SavedOffset *int
}

// SheetKey is the song's key as written, as named now, as named at the saved
// transposition (nil without one), the key grid's twelve choices (empty for a
// song with no chords), and its status.
type SheetKey struct {
	Written *string         `json:"written"`
	Named   *string         `json:"named"`
	Saved   *string         `json:"saved"`
	Choices []KeyChoice     `json:"choices"`
	Status  json.RawMessage `json:"status"`
}

// KeyChoice is one key of the key grid (workflow 19 §A song): its name, in the
// song's own spelling as the bundle gives it, and the offset that reads the
// song in it.
type KeyChoice struct {
	Name   string `json:"name"`
	Offset int    `json:"offset"`
}

// Shape is one chord's shape on the strip: resolved, with its source, its
// frets (the fret shorthand) and its diagram model (raw), or pending (its
// place kept, queued for the search).
type Shape struct {
	Key     string          `json:"key"`
	Symbol  string          `json:"symbol"`
	Source  string          `json:"source,omitempty"`
	Pending bool            `json:"pending,omitempty"`
	Frets   string          `json:"frets,omitempty"`
	Diagram json.RawMessage `json:"diagram,omitempty"`
}

// Sheet is one song read at one key.
type Sheet struct {
	Title      *string         `json:"title"`
	Artist     *string         `json:"artist"`
	Key        SheetKey        `json:"key"`
	Offset     int             `json:"offset"`
	Transposed bool            `json:"transposed"`
	Rows       json.RawMessage `json:"rows"`
	Shapes     []Shape         `json:"shapes"`
	Unvoiced   []string        `json:"unvoiced"`
	Notes      json.RawMessage `json:"notes"`
	KeyNote    *string         `json:"keyNote"`
	TuningID   string          `json:"tuningId"`
}

// SetlistItem is one playable item of a setlist.
type SetlistItem struct {
	At     int     `json:"at"`
	Number int     `json:"number"`
	Title  string  `json:"title"`
	Path   string  `json:"path"`
	Key    *string `json:"key"`
	Note   *string `json:"note"`
}

// SetlistRow is one item of a setlist as the setlist screen lists it: a song
// link (Path its book-root path) or an unlinked item (Path nil), its key and
// note as written, and whether it cannot be played.
type SetlistRow struct {
	At      int     `json:"at"`
	Number  int     `json:"number"`
	Title   string  `json:"title"`
	Path    *string `json:"path"`
	Key     *string `json:"key"`
	Note    *string `json:"note"`
	Missing bool    `json:"missing"`
}

// Setlist is a setlist's playable items, how many cannot be played, and every
// item in order (Rows), each marked missing or not.
type Setlist struct {
	Title   *string       `json:"title"`
	Items   []SetlistItem `json:"items"`
	Missing int           `json:"missing"`
	Rows    []SetlistRow  `json:"rows"`
}

// Miss is a chord the table did not hold, queued for the background search.
type Miss struct {
	Chord   string `json:"chord"`
	Symbol  string `json:"symbol"`
	Dialect string `json:"dialect"`
}

// Held is what the session keeps (§4): songs parsed, shapes held rebuilt,
// rebuilds since the last load, misses queued.
type Held struct {
	Songs   int `json:"songs"`
	Shapes  int `json:"shapes"`
	Rebuilt int `json:"rebuilt"`
	Misses  int `json:"misses"`
}

// Engine is an open bundle in its runtime. Its methods are safe from any
// goroutine and run in arrival order.
type Engine struct {
	manifest Manifest
	reqs     chan request
	quit     chan struct{}
	stopped  chan struct{}
	once     sync.Once
	// interrupt is the runtime's Interrupt, safe from any goroutine; Close
	// uses it to stop a call that would otherwise never return.
	interrupt func(any)
}

type request struct {
	ctx   context.Context
	run   func(o *owner) ([]byte, error)
	reply chan reply
}

type reply struct {
	out []byte
	err error
}

// owner is the state only the owner goroutine touches.
type owner struct {
	rt        *goja.Runtime
	estante   *goja.Object
	json      *goja.Object
	parse     goja.Callable
	stringify goja.Callable
	// The last Load's digest and answer (Decision 3).
	loadDigest string
	loaded     []byte
}

// Open reads and checks the bundle directory and starts its engine. It
// returns an error wrapping one of the refusals, and starts nothing, when the
// bundle is not one this engine can speak.
func Open(dir string) (*Engine, error) {
	raw, err := os.ReadFile(filepath.Join(dir, ManifestFile))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrManifest, err)
	}
	var m Manifest
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrManifest, err)
	}
	if m.HostAPI != HostAPI {
		return nil, fmt.Errorf("%w: manifest says %d, engine speaks %d", ErrHostAPI, m.HostAPI, HostAPI)
	}
	if m.Bundle.Path == "" || !filepath.IsLocal(m.Bundle.Path) {
		return nil, fmt.Errorf("%w: bundle path %q", ErrManifest, m.Bundle.Path)
	}
	code, err := os.ReadFile(filepath.Join(dir, m.Bundle.Path))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrBundleMissing, err)
	}
	sum := sha256.Sum256(code)
	if got := hex.EncodeToString(sum[:]); got != m.Bundle.SHA256 {
		return nil, fmt.Errorf("%w: %s", ErrChecksum, m.Bundle.Path)
	}

	e := &Engine{
		manifest: m,
		reqs:     make(chan request),
		quit:     make(chan struct{}),
		stopped:  make(chan struct{}),
	}
	started := make(chan error, 1)
	go e.loop(m, m.Bundle.Path, string(code), started)
	if err := <-started; err != nil {
		<-e.stopped
		return nil, err
	}
	return e, nil
}

// Manifest is the manifest the engine was opened with.
func (e *Engine) Manifest() Manifest { return e.manifest }

// loop is the owner goroutine: it makes the runtime, evaluates the bundle,
// checks what it defined, and then serves every call until Close.
func (e *Engine) loop(m Manifest, name, code string, started chan<- error) {
	defer close(e.stopped)
	o, err := evaluate(m, name, code)
	if err != nil {
		started <- err
		return
	}
	e.interrupt = o.rt.Interrupt
	started <- nil
	for {
		select {
		case <-e.quit:
			return
		case req := <-e.reqs:
			req.reply <- e.serve(o, req)
		}
	}
}

func evaluate(m Manifest, name, code string) (*owner, error) {
	rt := goja.New()
	o := &owner{rt: rt}
	// JSON is goja's own, taken before the bundle runs, so what the bundle
	// does to the global cannot change how values cross.
	o.json = rt.GlobalObject().Get("JSON").ToObject(rt)
	var ok bool
	if o.parse, ok = goja.AssertFunction(o.json.Get("parse")); !ok {
		return nil, fmt.Errorf("%w: no JSON.parse", ErrEvaluate)
	}
	if o.stringify, ok = goja.AssertFunction(o.json.Get("stringify")); !ok {
		return nil, fmt.Errorf("%w: no JSON.stringify", ErrEvaluate)
	}

	if _, err := rt.RunString(code); err != nil {
		class, msg := describe(err)
		return nil, fmt.Errorf("%w: %s: %s: %s", ErrEvaluate, name, class, msg)
	}

	v := rt.GlobalObject().Get("estante")
	if !present(v) {
		return nil, ErrNoHost
	}
	est, isObj := v.(*goja.Object)
	if !isObj {
		return nil, ErrNoHost
	}
	o.estante = est
	if api, ok := integer(est.Get("hostApi")); !ok || api != int64(m.HostAPI) {
		return nil, fmt.Errorf("%w: estante.hostApi disagrees with the manifest's %d", ErrHostAPI, m.HostAPI)
	}
	if salt, ok := exported[string](est.Get("salt")); !ok || salt != m.Salt {
		return nil, fmt.Errorf("%w: estante.salt disagrees with the manifest", ErrSalt)
	}
	return o, nil
}

func present(v goja.Value) bool {
	return v != nil && !goja.IsUndefined(v) && !goja.IsNull(v)
}

func exported[T any](v goja.Value) (T, bool) {
	var zero T
	if !present(v) {
		return zero, false
	}
	t, ok := v.Export().(T)
	return t, ok
}

func integer(v goja.Value) (int64, bool) {
	if !present(v) {
		return 0, false
	}
	switch n := v.Export().(type) {
	case int64:
		return n, true
	case float64:
		if n == float64(int64(n)) {
			return int64(n), true
		}
	}
	return 0, false
}

// describe names an exception by its class and message — never its stack,
// never the arguments of the call that threw.
func describe(err error) (class, message string) {
	var exc *goja.Exception
	if !errors.As(err, &exc) {
		return "Error", err.Error()
	}
	val := exc.Value()
	if obj, ok := val.(*goja.Object); ok {
		class = "Error"
		if n := obj.Get("name"); present(n) {
			class = n.String()
		}
		if msg := obj.Get("message"); present(msg) {
			message = msg.String()
		}
		return class, message
	}
	if val == nil {
		return "Error", ""
	}
	return "Thrown", val.String()
}

// serve runs one request on the owner goroutine: not at all when its context
// is already done, and interrupted when its context ends while it runs.
func (e *Engine) serve(o *owner, req request) reply {
	if err := req.ctx.Err(); err != nil {
		return reply{err: err}
	}
	done := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		select {
		case <-req.ctx.Done():
			o.rt.Interrupt(req.ctx.Err())
		case <-done:
		}
	}()
	out, err := req.run(o)
	close(done)
	wg.Wait()
	o.rt.ClearInterrupt()
	var interrupted *goja.InterruptedError
	if errors.As(err, &interrupted) {
		if cerr := req.ctx.Err(); cerr != nil {
			return reply{err: cerr}
		}
		return reply{err: ErrClosed}
	}
	return reply{out: out, err: err}
}

// do hands run to the owner goroutine and waits for its answer.
func (e *Engine) do(ctx context.Context, run func(o *owner) ([]byte, error)) ([]byte, error) {
	select {
	case <-e.quit:
		return nil, ErrClosed
	default:
	}
	req := request{ctx: ctx, run: run, reply: make(chan reply, 1)}
	select {
	case e.reqs <- req:
	case <-e.quit:
		return nil, ErrClosed
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	r := <-req.reply
	return r.out, r.err
}

// call runs estante.<name>(...args) in the runtime, the arguments a JSON
// array, and returns the answer as JSON ("null" for undefined).
func (o *owner) call(name string, args []byte) ([]byte, error) {
	fn, ok := goja.AssertFunction(o.estante.Get(name))
	if !ok {
		return nil, &CallError{Call: name, Class: "TypeError", Message: "estante." + name + " is not a function"}
	}
	parsed, err := o.parse(o.json, o.rt.ToValue(string(args)))
	if err != nil {
		return nil, o.callError(name, err)
	}
	list, ok := parsed.(*goja.Object)
	if !ok {
		return nil, &CallError{Call: name, Class: "TypeError", Message: "arguments are not a list"}
	}
	n := int(list.Get("length").ToInteger())
	argv := make([]goja.Value, n)
	for i := range argv {
		argv[i] = list.Get(strconv.Itoa(i))
	}
	res, err := fn(o.estante, argv...)
	if err != nil {
		return nil, o.callError(name, err)
	}
	str, err := o.stringify(o.json, res)
	if err != nil {
		return nil, o.callError(name, err)
	}
	if !present(str) {
		return []byte("null"), nil
	}
	return []byte(str.String()), nil
}

func (o *owner) callError(name string, err error) error {
	var interrupted *goja.InterruptedError
	if errors.As(err, &interrupted) {
		return err
	}
	class, msg := describe(err)
	return &CallError{Call: name, Class: class, Message: msg}
}

// invoke marshals args, runs estante.<name> and unmarshals into out.
func (e *Engine) invoke(ctx context.Context, name string, out any, args ...any) error {
	if args == nil {
		args = []any{}
	}
	argv, err := json.Marshal(args)
	if err != nil {
		return fmt.Errorf("engine: %s: arguments: %w", name, err)
	}
	res, err := e.do(ctx, func(o *owner) ([]byte, error) { return o.call(name, argv) })
	if err != nil {
		return err
	}
	return decode(name, res, out)
}

func decode(name string, res []byte, out any) error {
	if err := json.Unmarshal(res, out); err != nil {
		return fmt.Errorf("engine: %s: answer is not the expected shape", name)
	}
	return nil
}

// orNull is raw JSON, or null when empty.
func orNull(raw json.RawMessage) json.RawMessage {
	if len(bytes.TrimSpace(raw)) == 0 {
		return json.RawMessage("null")
	}
	return raw
}

// InstrumentFiles are the home book's four instrument files as their bytes:
// instruments.json, preferences.json, shapes.json and
// shapes-default-cache.json. Each crosses as parsed JSON; an absent or empty
// one crosses as {} (home-book format §2.1).
type InstrumentFiles struct {
	Instruments   json.RawMessage
	Preferences   json.RawMessage
	Shapes        json.RawMessage
	DefaultShapes json.RawMessage
}

// Instrument is instrument's answer: the entry in use as the Worker surfaces
// it, the default-shape table chosen for it (null when none), and the salt
// that table was written under (nil when none) — what Load takes.
type Instrument struct {
	Entry json.RawMessage `json:"entry"`
	Table json.RawMessage `json:"table"`
	Salt  *string         `json:"salt"`
}

// orEmpty is raw JSON, or {} when empty.
func orEmpty(raw json.RawMessage) json.RawMessage {
	if len(bytes.TrimSpace(raw)) == 0 {
		return json.RawMessage("{}")
	}
	return raw
}

// Instrument asks the bundle for the instrument in use and its table, from
// the home book's files (reader.sync; design §4 `instrument(files)`, §4.1):
// the choice — the roster, the fingerprint, the salts — is the music core's,
// so the host keeps no copy of it. A file that is not JSON is refused, naming
// none of its bytes.
func (e *Engine) Instrument(ctx context.Context, files InstrumentFiles) (Instrument, error) {
	arg := struct {
		Instruments   json.RawMessage `json:"instruments"`
		Preferences   json.RawMessage `json:"preferences"`
		Shapes        json.RawMessage `json:"shapes"`
		DefaultShapes json.RawMessage `json:"defaultShapes"`
	}{orEmpty(files.Instruments), orEmpty(files.Preferences), orEmpty(files.Shapes), orEmpty(files.DefaultShapes)}
	for _, raw := range []json.RawMessage{arg.Instruments, arg.Preferences, arg.Shapes, arg.DefaultShapes} {
		if !json.Valid(raw) {
			return Instrument{}, errors.New("engine: instrument: a file is not JSON")
		}
	}
	var in Instrument
	if err := e.invoke(ctx, "instrument", &in, arg); err != nil {
		return Instrument{}, err
	}
	in.Entry, in.Table = orNull(in.Entry), orNull(in.Table)
	return in, nil
}

// Load begins a session on an instrument: its entry as the Worker surfaces
// it, and its §4.6 table (either may be null). The same entry and table as
// the last Load is a no-op that answers as that Load did, so the bundle's
// memos survive a re-load of what is already loaded.
func (e *Engine) Load(ctx context.Context, entry, table json.RawMessage) (Loaded, error) {
	entry, table = orNull(entry), orNull(table)
	var ce, ct bytes.Buffer
	if err := json.Compact(&ce, entry); err != nil {
		return Loaded{}, errors.New("engine: load: entry is not JSON")
	}
	if err := json.Compact(&ct, table); err != nil {
		return Loaded{}, errors.New("engine: load: table is not JSON")
	}
	h := sha256.New()
	h.Write(ce.Bytes())
	h.Write([]byte{0})
	h.Write(ct.Bytes())
	digest := hex.EncodeToString(h.Sum(nil))
	argv := []byte("[" + ce.String() + "," + ct.String() + "]")

	res, err := e.do(ctx, func(o *owner) ([]byte, error) {
		if o.loaded != nil && o.loadDigest == digest {
			return o.loaded, nil
		}
		out, err := o.call("load", argv)
		if err != nil {
			return nil, err
		}
		o.loadDigest, o.loaded = digest, out
		return out, nil
	})
	if err != nil {
		return Loaded{}, err
	}
	var l Loaded
	return l, decode("load", res, &l)
}

// Sheet reads one song at offset (or at opts.TargetKey), with the shapes of
// the loaded instrument; the answer names the tuning it was read on. A text that is not
// UTF-8 crosses as null, which the bundle answers as unreadable (cifra.md
// §1.3 step 1) — JSON would otherwise replace its bad bytes with U+FFFD and
// read it anyway.
func (e *Engine) Sheet(ctx context.Context, text string, offset int, opts SheetOptions) (Sheet, error) {
	var song *string
	if utf8.ValidString(text) {
		song = &text
	}
	o := struct {
		Variation   string            `json:"variation"`
		Variations  map[string]string `json:"variations,omitempty"`
		Preferences json.RawMessage   `json:"preferences"`
		TargetKey   *string           `json:"targetKey"`
		SavedOffset *int              `json:"savedOffset"`
	}{Variation: opts.Variation, Variations: opts.Variations, Preferences: orNull(opts.Preferences), SavedOffset: opts.SavedOffset}
	if opts.TargetKey != "" {
		o.TargetKey = &opts.TargetKey
	}
	var raw json.RawMessage
	if err := e.invoke(ctx, "sheet", &raw, song, offset, o); err != nil {
		return Sheet{}, err
	}
	var probe struct {
		Error string `json:"error"`
	}
	if json.Unmarshal(raw, &probe) == nil && probe.Error != "" {
		if probe.Error == "unreadable" {
			return Sheet{}, ErrUnreadable
		}
		return Sheet{}, &CallError{Call: "sheet", Class: "Answer", Message: probe.Error}
	}
	var s Sheet
	return s, decode("sheet", raw, &s)
}

// Setlist reads a setlist's playable items, its paths resolved against the
// book's paths.
func (e *Engine) Setlist(ctx context.Context, text, setlistPath string, bookPaths []string) (Setlist, error) {
	if bookPaths == nil {
		bookPaths = []string{}
	}
	var s Setlist
	return s, e.invoke(ctx, "setlist", &s, text, setlistPath, bookPaths)
}

// Misses lists the queued misses; only a new Load clears them.
func (e *Engine) Misses(ctx context.Context) ([]Miss, error) {
	var m []Miss
	if err := e.invoke(ctx, "misses", &m); err != nil {
		return nil, err
	}
	if m == nil {
		m = []Miss{}
	}
	return m, nil
}

// Held reports what the session keeps.
func (e *Engine) Held(ctx context.Context) (Held, error) {
	var h Held
	return h, e.invoke(ctx, "held", &h)
}

// Close stops the owner goroutine (interrupting a call in flight) and drops
// the runtime. Later calls return ErrClosed; Close is idempotent.
func (e *Engine) Close() error {
	e.once.Do(func() {
		close(e.quit)
		if e.interrupt != nil {
			e.interrupt(ErrClosed)
		}
		<-e.stopped
	})
	return nil
}
