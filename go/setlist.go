package cifra

// Setlists (spec §10): the reader and the canonical writer. A port of the
// reference's reference/cifra_md/setlist.py (parse_setlist, write_setlist,
// canonicalise_setlist, and the §10.5/§10.9.2 path machinery), matched to it
// and the thirteen setlist corpus entries, never imported from it: agreement is
// by the corpus, not shared code (DIRECTION §3.6). It is the Go twin of
// js/src/setlist.js.
//
// Nothing in a setlist is music and a setlist reader reads no chart (§10 intro):
// this file reads no song and imports no chord layer. A `key` is validated
// against a self-contained regex (the roots of §5.1.1), as the reference does,
// not against a chord parser (§10.7.1, refinement §Decisions). The §10.10
// editing operations are out of scope for Go — they belong to the app's
// JavaScript — so they are not implemented here (refinement §Decisions).
//
// The reader produces the order-preserving model type of model.go (*Object /
// []any), so the harness serialises it the one canonical way with Encode;
// numbers are json.Number so they render as the corpus's integers. The reader
// never fails on a line it does not understand and never discards one (§10.8.3).

import (
	"encoding/json"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

// bulletRE: a `-`/`*`/`+` marker and, after it, the content (§10.3).
var bulletRE = regexp.MustCompile(`^ *[-*+](?: +(.*))?$`)

// itemRE: 0–3 leading spaces, 1–9 digits, `.` or `)`, then the content
// (§10.3.2). Four or more leading spaces is not an item.
var itemRE = regexp.MustCompile(`^ {0,3}([0-9]{1,9})[.)](?: +(.*))?$`)

// propertyRE: a `[A-Za-z0-9_-]+` key, optional spaces, `:`, then — only if more
// follows — a required space and the value (§10.3). The required space after
// `:` is what makes `- https://example.com/` an unrecognised entry, not the key
// `https`.
var propertyRE = regexp.MustCompile(`^([A-Za-z0-9_-]+) *:(?: +(.*))?$`)

// schemeRE: a URL scheme (§10.5 step 2).
var schemeRE = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9+.-]*:`)

// keyRE: a `key` value, a root as in §5.1.1, then `m` for minor or nothing for
// major (§10.7.1). Written inline, as the reference does, so this file does not
// import a chord layer (§Decisions).
var keyRE = regexp.MustCompile(`^[A-G](?:#|b|♯|♭)?m?$`)

// asciiPunct is the set a Markdown backslash may escape (§10.4).
var asciiPunct = runeSet("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")

// safe is the set a path segment keeps unencoded besides the alphanumerics
// (§10.9.2).
var safe = runeSet("-._~!$'*+,;=@")

// hexDigits are the digits of a percent-encoded byte (§10.5 step 4).
var hexDigits = runeSet("0123456789abcdefABCDEF")

const songSuffix = ".cifra.md"

func runeSet(s string) map[rune]bool {
	m := map[rune]bool{}
	for _, r := range s {
		m[r] = true
	}
	return m
}

// --- model building helpers --------------------------------------------------
//
// The reader works in these small Go values and converts to the order-preserving
// model (*Object / []any) once, at the end, so the parsing logic mirrors the
// reference's dicts while the produced model is the one the harness serialises.

type setlistEntry struct {
	typ   string // "property" | "unrecognised"
	key   string
	value string
	text  string
}

type setlistItem struct {
	typ     string // "song" | "unlinked" | "notes"
	number  int
	text    string
	path    string
	content string
	entries []*setlistEntry
	lines   []string // notes
}

type diagnostic struct {
	code    string
	message string
	line    int
}

// lower lowercases only ASCII A–Z (§10.3): a property key is held lowercase.
func lower(text string) string { return asciiLower(text) }

// entryOf reads one bullet's content into an entry: a property when the content
// is `key: value`, else unrecognised (§10.3).
func entryOf(content string) *setlistEntry {
	if m := propertyRE.FindStringSubmatch(content); m != nil {
		return &setlistEntry{typ: "property", key: lower(m[1]), value: m[2]}
	}
	return &setlistEntry{typ: "unrecognised", text: content}
}

func isKey(value string) bool { return keyRE.MatchString(value) }

// --- links and paths (§10.4, §10.5) ------------------------------------------

// parseLink returns (text, dest, true) when the content has the shape of a song
// link, else false (§10.4). Scanned over runes so the index arithmetic matches
// the reference's on characters outside the BMP.
func parseLink(content string) (text, dest string, ok bool) {
	if !strings.HasPrefix(content, "[") {
		return "", "", false
	}
	cs := []rune(content)
	depth := 0
	i := 1
	closeAt := -1
	for i < len(cs) {
		ch := cs[i]
		if ch == '\\' && i+1 < len(cs) && asciiPunct[cs[i+1]] {
			i += 2
			continue
		}
		if ch == '[' {
			depth++
		} else if ch == ']' {
			if depth == 0 {
				closeAt = i
				break
			}
			depth--
		}
		i++
	}
	if closeAt == -1 || closeAt+1 >= len(cs) || cs[closeAt+1] != '(' || cs[len(cs)-1] != ')' {
		return "", "", false
	}
	text = string(cs[1:closeAt])
	dest = string(cs[closeAt+2 : len(cs)-1])
	if strings.HasPrefix(dest, "<") {
		if len(dest) < 2 || !strings.HasSuffix(dest, ">") {
			return "", "", false
		}
		inner := []rune(dest[1 : len(dest)-1])
		k := 0
		for k < len(inner) {
			if inner[k] == '\\' && k+1 < len(inner) && asciiPunct[inner[k+1]] {
				k += 2
				continue
			}
			if inner[k] == '<' || inner[k] == '>' {
				return "", "", false
			}
			k++
		}
		return text, dest, true
	}
	for _, ch := range dest {
		if ch == ' ' || ch < 32 || ch == 127 {
			return "", "", false
		}
	}
	ds := []rune(dest)
	depth2 := 0
	k := 0
	for k < len(ds) {
		if ds[k] == '\\' && k+1 < len(ds) && asciiPunct[ds[k+1]] {
			k += 2
			continue
		}
		if ds[k] == '(' {
			depth2++
		} else if ds[k] == ')' {
			depth2--
			if depth2 < 0 {
				return "", "", false
			}
		}
		k++
	}
	if depth2 != 0 {
		return "", "", false
	}
	return text, dest, true
}

// unescape removes a backslash before each ASCII-punctuation character (§10.5
// step 1).
func unescape(text string) string {
	cs := []rune(text)
	var b strings.Builder
	k := 0
	for k < len(cs) {
		if cs[k] == '\\' && k+1 < len(cs) && asciiPunct[cs[k+1]] {
			b.WriteRune(cs[k+1])
			k += 2
			continue
		}
		b.WriteRune(cs[k])
		k++
	}
	return b.String()
}

// songPath decodes a destination into a path (§10.5): (path, "") on success, or
// ("", reason) naming the step that failed. path is the decoded segments joined
// by `/`; a segment never holds a `/`, so the join is unambiguous.
func songPath(dest string) (path, reason string) {
	d := dest
	if strings.HasPrefix(d, "<") {
		d = d[1 : len(d)-1]
	}
	p := unescape(d)
	if schemeRE.MatchString(p) {
		return "", "step 2: a URL, not a path"
	}
	if strings.ContainsAny(p, "?#") {
		return "", "step 2: a query or a fragment"
	}
	if strings.HasPrefix(p, "/") {
		return "", "step 2: an absolute path"
	}
	segments := strings.Split(p, "/")
	for _, s := range segments {
		if s == "" {
			return "", "step 3: an empty segment"
		}
	}
	decoded := make([]string, 0, len(segments))
	for _, s := range segments {
		cs := []rune(s)
		data := []byte{}
		k := 0
		for k < len(cs) {
			if cs[k] == '%' && k+2 < len(cs) && hexDigits[cs[k+1]] && hexDigits[cs[k+2]] {
				b, _ := strconv.ParseUint(string(cs[k+1:k+3]), 16, 8)
				data = append(data, byte(b))
				k += 3
				continue
			}
			data = append(data, []byte(string(cs[k]))...)
			k++
		}
		if !utf8.Valid(data) {
			return "", "step 4: a segment that is not UTF-8"
		}
		seg := string(data)
		if strings.ContainsAny(seg, "/\x00") {
			return "", "step 4: a segment holding `/` or U+0000"
		}
		decoded = append(decoded, norm.NFC.String(seg))
	}
	kept := []string{}
	for _, s := range decoded {
		if s == "." {
			continue
		}
		if s == ".." {
			if len(kept) > 0 && kept[len(kept)-1] != ".." {
				kept = kept[:len(kept)-1]
			} else {
				kept = append(kept, s)
			}
			continue
		}
		kept = append(kept, s)
	}
	if len(kept) == 0 || allDotDot(kept) {
		return "", "step 5: nothing left"
	}
	last := kept[len(kept)-1]
	if !strings.HasSuffix(last, songSuffix) || len(last) <= len(songSuffix) {
		return "", "step 6: not a song (`.cifra.md`)"
	}
	return strings.Join(kept, "/"), ""
}

func allDotDot(segs []string) bool {
	for _, s := range segs {
		if s != ".." {
			return false
		}
	}
	return true
}

func isAsciiAlnum(ch rune) bool {
	return (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
}

func pctByte(b byte) string {
	const hex = "0123456789ABCDEF"
	return "%" + string([]byte{hex[b>>4], hex[b&0xf]})
}

// writePath encodes a path as canonical form writes it (§10.9.2): each segment
// percent-encoded, with the rule that a non-ASCII character immediately after a
// percent-encoded one is itself percent-encoded, so an accent cannot compose
// with a decoded byte.
func writePath(path string) string {
	out := make([]string, 0)
	for _, seg := range strings.Split(path, "/") {
		var enc strings.Builder
		afterPct := false
		for _, ch := range seg {
			if ch >= 128 {
				if afterPct {
					for _, b := range []byte(string(ch)) {
						enc.WriteString(pctByte(b))
					}
				} else {
					enc.WriteRune(ch)
				}
			} else if isAsciiAlnum(ch) || safe[ch] {
				enc.WriteRune(ch)
				afterPct = false
			} else {
				enc.WriteString(pctByte(byte(ch)))
				afterPct = true
			}
		}
		out = append(out, enc.String())
	}
	return strings.Join(out, "/")
}

// --- the reader (§10.3) ------------------------------------------------------

// setEntry adds an entry: a repeated key keeps its first position with the last
// value, and is reported (§10.3.1, §10.3.3); an entry that is not `key: value`
// is reported and kept.
func setEntry(entries *[]*setlistEntry, entry *setlistEntry, diag func(code string, line int, message string), lineno int) {
	if entry.typ == "property" {
		for _, e := range *entries {
			if e.typ == "property" && e.key == entry.key {
				diag("duplicate-key", lineno, "`"+entry.key+"` is set again; the earlier value is not kept")
				e.value = entry.value
				return
			}
		}
	} else {
		diag("unrecognised-entry", lineno, "an entry that is not `key: value`; kept as written")
	}
	*entries = append(*entries, entry)
}

func checkKey(entry *setlistEntry, diag func(code string, line int, message string), lineno int) {
	if entry.typ == "property" && entry.key == "key" && !isKey(entry.value) {
		diag("bad-key", lineno, "`"+entry.value+"` is not a key: a root, then `m` for minor (§10.7.1)")
	}
}

// ParseSetlist reads a setlist's text into its model (spec §10.6). It takes
// bytes because the text layer (§10.2) begins by validating UTF-8; non-UTF-8
// input is rejected with an error and never rewritten. It never fails on a
// setlist it does not understand: it reports in `diagnostics` and keeps
// everything (§10.8.3).
func ParseSetlist(src []byte) (Model, error) {
	lines, err := prepare(src)
	if err != nil {
		return nil, err
	}

	var diagnostics []diagnostic
	diag := func(code string, line int, message string) {
		diagnostics = append(diagnostics, diagnostic{code: code, message: message, line: line})
	}

	n := len(lines)
	i := 0
	title := ""
	haveTitle := false
	var properties []*setlistEntry
	for i < n && lines[i] == "" {
		i++
	}
	if i < n {
		if level, text, ok := mdHeading(lines[i]); ok && level == 1 {
			if text != "" {
				title = text
				haveTitle = true
			}
			i++
		}
	}
	// Properties: bullet lines right after the title, blank lines allowed.
	j := i
	for j < n {
		if lines[j] == "" {
			j++
			continue
		}
		m := bulletRE.FindStringSubmatch(lines[j])
		if m == nil {
			break
		}
		setEntry(&properties, entryOf(m[1]), diag, j+1)
		j++
		i = j
	}

	var body []*setlistItem
	var notes []string // the notes block being read, blank lines included
	notesOpen := false
	pendingBlank := 0
	var item *setlistItem // the item whose entries may follow
	var openFence *fence
	number := 0

	flushNotes := func() {
		if notesOpen {
			body = append(body, &setlistItem{typ: "notes", lines: notes})
			notes = nil
			notesOpen = false
		}
	}

	for k := i; k < n; k++ {
		ln := lines[k]
		lineno := k + 1
		if openFence != nil {
			if ln == "" {
				pendingBlank++ // kept only if a line of the fence follows
				continue
			}
			for z := 0; z < pendingBlank; z++ {
				notes = append(notes, "")
			}
			pendingBlank = 0
			notes = append(notes, ln)
			if closesFence(ln, *openFence) {
				openFence = nil
			}
			continue
		}
		if ln == "" {
			pendingBlank++
			continue
		}
		if m := itemRE.FindStringSubmatch(ln); m != nil {
			flushNotes()
			pendingBlank = 0
			number++
			content := m[2]
			text, dest, linked := parseLink(content)
			path, reason := "", ""
			havePath := false
			if linked {
				path, reason = songPath(dest)
				havePath = reason == ""
			}
			if havePath {
				item = &setlistItem{typ: "song", number: number, text: text, path: path, entries: []*setlistEntry{}}
				if strings.Contains(path, "\\") {
					diag("backslash-in-path", lineno, "a `\\` in a path is part of a file name, not a separator")
				}
			} else {
				item = &setlistItem{typ: "unlinked", number: number, content: content, entries: []*setlistEntry{}}
				if linked {
					diag("bad-path", lineno, "the link's destination is not a song path ("+reason+")")
				} else {
					diag("unlinked-item", lineno, "an item that is not a song link; kept, and skipped when playing")
				}
			}
			body = append(body, item)
			continue
		}
		if b := bulletRE.FindStringSubmatch(ln); b != nil && item != nil && !notesOpen {
			pendingBlank = 0
			entry := entryOf(b[1])
			checkKey(entry, diag, lineno)
			setEntry(&item.entries, entry, diag, lineno)
			continue
		}
		// notes
		item = nil
		if !notesOpen {
			notes = []string{}
			notesOpen = true
		} else {
			for z := 0; z < pendingBlank; z++ {
				notes = append(notes, "")
			}
		}
		pendingBlank = 0
		notes = append(notes, ln)
		if char, length, _, ok := fenceOpen(ln); ok {
			openFence = &fence{char: char, length: length, line: lineno}
		}
	}
	if openFence != nil {
		diag("unclosed-fence", openFence.line, "a fence was opened and never closed; it runs to the end of the setlist")
	}
	flushNotes()
	sort.SliceStable(diagnostics, func(a, b int) bool { return diagnostics[a].line < diagnostics[b].line })

	return buildModel(title, haveTitle, properties, body, diagnostics), nil
}

// buildModel converts the reader's working values into the order-preserving
// model the harness serialises: an *Object with keys title, properties, body,
// diagnostics, in that order.
func buildModel(title string, haveTitle bool, properties []*setlistEntry, body []*setlistItem, diagnostics []diagnostic) Model {
	m := NewObject()
	if haveTitle {
		m.Set("title", title)
	} else {
		m.Set("title", nil)
	}
	m.Set("properties", entriesToArray(properties))
	bodyArr := []any{}
	for _, it := range body {
		bodyArr = append(bodyArr, itemToObject(it))
	}
	m.Set("body", bodyArr)
	diagArr := []any{}
	for _, d := range diagnostics {
		o := NewObject()
		o.Set("code", d.code)
		o.Set("message", d.message)
		o.Set("line", json.Number(strconv.Itoa(d.line)))
		diagArr = append(diagArr, o)
	}
	m.Set("diagnostics", diagArr)
	return m
}

func entriesToArray(entries []*setlistEntry) []any {
	arr := []any{}
	for _, e := range entries {
		o := NewObject()
		if e.typ == "property" {
			o.Set("type", "property")
			o.Set("key", e.key)
			o.Set("value", e.value)
		} else {
			o.Set("type", "unrecognised")
			o.Set("text", e.text)
		}
		arr = append(arr, o)
	}
	return arr
}

func itemToObject(it *setlistItem) *Object {
	o := NewObject()
	switch it.typ {
	case "song":
		o.Set("type", "song")
		o.Set("number", json.Number(strconv.Itoa(it.number)))
		o.Set("text", it.text)
		o.Set("path", it.path)
		o.Set("entries", entriesToArray(it.entries))
	case "unlinked":
		o.Set("type", "unlinked")
		o.Set("number", json.Number(strconv.Itoa(it.number)))
		o.Set("content", it.content)
		o.Set("entries", entriesToArray(it.entries))
	case "notes":
		o.Set("type", "notes")
		lines := []any{}
		for _, ln := range it.lines {
			lines = append(lines, ln)
		}
		o.Set("lines", lines)
	}
	return o
}

// --- the writer (§10.9) ------------------------------------------------------

// objString returns the string value under key, or "" when absent or not a
// string (as the reference reads `.get`/truthiness).
func objString(o *Object, key string) string {
	if v, ok := o.Get(key); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func objArray(o *Object, key string) []any {
	if v, ok := o.Get(key); ok {
		if a, ok := v.([]any); ok {
			return a
		}
	}
	return nil
}

func entryLine(entry *Object, indent int) string {
	pad := strings.Repeat(" ", indent)
	if objString(entry, "type") == "property" {
		line := pad + "- " + objString(entry, "key") + ":"
		if v := objString(entry, "value"); v != "" {
			line += " " + v
		}
		return line
	}
	if t := objString(entry, "text"); t != "" {
		return pad + "- " + t
	}
	return pad + "-"
}

// orderedEntries lists an item's entries in canonical order: `key`, `note`, then
// the rest in read order (§10.9.2).
func orderedEntries(entries []any) []*Object {
	var first []*Object
	inFirst := map[*Object]bool{}
	for _, k := range []string{"key", "note"} {
		for _, e := range entries {
			o, _ := e.(*Object)
			if o != nil && objString(o, "type") == "property" && objString(o, "key") == k {
				first = append(first, o)
				inFirst[o] = true
			}
		}
	}
	out := first
	for _, e := range entries {
		o, _ := e.(*Object)
		if o != nil && !inFirst[o] {
			out = append(out, o)
		}
	}
	return out
}

// itemContent is the item line after its number and the space (§10.9.2).
func itemContent(item *Object) string {
	if objString(item, "type") == "song" {
		return "[" + objString(item, "text") + "](" + writePath(objString(item, "path")) + ")"
	}
	return objString(item, "content")
}

func itemLines(item *Object, number int) []string {
	content := itemContent(item)
	head := strconv.Itoa(number) + "."
	if content != "" {
		head += " " + content
	}
	indent := len(strconv.Itoa(number)) + 2
	lines := []string{head}
	for _, e := range orderedEntries(objArray(item, "entries")) {
		lines = append(lines, entryLine(e, indent))
	}
	return lines
}

// WriteSetlist serialises a setlist model to its canonical text (spec §10.9):
// parts separated by one blank line (the metadata, then runs of items and notes
// blocks in document order), with a final LF — or the zero-byte file for a
// setlist with no title, properties, items or notes.
func WriteSetlist(model Model) ([]byte, error) {
	var parts [][]string
	var meta []string
	if title := objString(model, "title"); title != "" {
		meta = append(meta, "# "+title)
	}
	for _, e := range objArray(model, "properties") {
		if o, ok := e.(*Object); ok {
			meta = append(meta, entryLine(o, 0))
		}
	}
	if len(meta) > 0 {
		parts = append(parts, meta)
	}
	var run []string
	runOpen := false
	number := 0
	for _, el := range objArray(model, "body") {
		o, ok := el.(*Object)
		if !ok {
			continue
		}
		if objString(o, "type") == "notes" {
			if runOpen {
				parts = append(parts, run)
				run = nil
				runOpen = false
			}
			var lines []string
			for _, ln := range objArray(o, "lines") {
				if s, ok := ln.(string); ok {
					lines = append(lines, s)
				}
			}
			parts = append(parts, lines)
			continue
		}
		number++
		if !runOpen {
			run = nil
			runOpen = true
		}
		run = append(run, itemLines(o, number)...)
	}
	if runOpen {
		parts = append(parts, run)
	}
	if len(parts) == 0 {
		return []byte(""), nil
	}
	joined := make([]string, len(parts))
	for idx, p := range parts {
		joined[idx] = strings.Join(p, "\n")
	}
	return []byte(strings.Join(joined, "\n\n") + "\n"), nil
}

// isCanonicalSetlist answers §9.1 for a setlist, mirroring isCanonical (the
// song predicate in write.go): a non-UTF-8 text is not a document, a text
// holding a marker line is never canonical, otherwise it is canonical when
// WriteSetlist(ParseSetlist(text)) gives it back byte for byte.
func isCanonicalSetlist(text []byte) bool {
	lines, err := prepare(text)
	if err != nil {
		return false
	}
	for _, ln := range lines {
		if isMarkerLine(ln) {
			return false
		}
	}
	model, err := ParseSetlist(text)
	if err != nil {
		return false
	}
	out, err := WriteSetlist(model)
	if err != nil {
		return false
	}
	return string(out) == string(text)
}

// IsCanonicalSetlist reports whether a setlist document's bytes are in canonical
// form (§9.1), the setlist counterpart of the song IsCanonical. The hook uses
// it, through the form layer (versions.go), to decide a push.
func IsCanonicalSetlist(text []byte) bool {
	return isCanonicalSetlist(text)
}

// CanonicalSetlist returns the model of the canonical form of a setlist model
// (spec §10.9), defined as read-after-write so there is no second code path to
// keep in step with the writer: write the model to canonical text and read it
// back, which reorders each item's entries into `key`→`note`→rest order,
// collapses a repeated key, and renumbers (refinement §Decisions).
func CanonicalSetlist(model Model) (Model, error) {
	text, err := WriteSetlist(model)
	if err != nil {
		return nil, err
	}
	return ParseSetlist(text)
}
