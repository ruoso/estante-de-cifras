package cifra

// The song reader (spec §1 to §7): cifra.Parse turns the bytes of a .cifra.md
// file into the document model of model.go. A faithful port of the reference's
// reference/cifra_md/parse.py and the JavaScript twin js/src/parse.js — never
// imported from either: agreement is by the corpus, byte for byte, not shared
// code (DIRECTION §3.6). It builds the model as the order-preserving Object and
// []any directly (key order is part of the model), reusing the §1.3 text layer
// (text.go) and the §1.4.1/§1.9 block primitives (markdown.go). The chord, pitch,
// tuning, fret and layout layers live in their own files.
//
// A reader never fails on a line it does not understand: everything unparseable
// becomes a diagnostic inside the model, and the only error Parse returns is
// non-UTF-8 input (§9.2).

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Whitespace is U+0020 only (§1.3); tabs are already spaces and trailing spaces
// already gone when these patterns see a line.
var (
	ruleRE           = regexp.MustCompile(`^ {0,3}-{3,}$`)
	songListItemRE   = regexp.MustCompile(`^ {0,3}[-*+](?: +(.*))?$`)
	bracketHeadingRE = regexp.MustCompile(`^( *\[ *([^\]]*?) *\] *)(.*)$`)
	labelHeadingRE   = regexp.MustCompile(`^( *([^ :|]+):(?: +|$))(.*)$`)
	headingAnchorRE  = regexp.MustCompile(` *@(0*[1-9][0-9]*) *$`)
	barAnchorRE      = regexp.MustCompile(`^@(0*[1-9][0-9]*)$`)
	countRE          = regexp.MustCompile(`^\(?(?:[x×](0*[1-9][0-9]*)|(0*[1-9][0-9]*)[x×]|(bis))\)?$`)
	annotationRE     = regexp.MustCompile(`^ *// ?(.*)$`)
	headingCountRE   = regexp.MustCompile(` *(\(?(?:[x×]0*[1-9][0-9]*|0*[1-9][0-9]*[x×]|bis)\)?) *$`)
	endingRE         = regexp.MustCompile(`^(0*[1-9][0-9]*)\.$`)
	chordTokenRE     = regexp.MustCompile(`^(.*?)(?:\[([0-9]+)\])?$`)
	lyricMarkerRE    = regexp.MustCompile(`^( *)>( ?)`)
	fingeringRE      = regexp.MustCompile(`^(.*?) *\(([^()]*)\) *$`)
)

const repeatMark = "%"

// --- small helpers -----------------------------------------------------------

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func isHeadingLine(s string) bool {
	_, _, ok := mdHeading(s)
	return ok
}

// partition splits s at the first occurrence of sep (Python str.partition).
func partition(s, sep string) (before, after string, found bool) {
	if i := strings.Index(s, sep); i >= 0 {
		return s[:i], s[i+len(sep):], true
	}
	return s, "", false
}

func objsToAny(xs []*Object) []any {
	out := make([]any, len(xs))
	for i, x := range xs {
		out[i] = x
	}
	return out
}

// keyFor is the §2.4 footnote key: the bare symbol, or `symbol[index]` for a
// second or later occurrence.
func keyFor(symbol string, index int) string {
	if index > 1 {
		return symbol + "[" + strconv.Itoa(index) + "]"
	}
	return symbol
}

func countTimes(m []string) int {
	if len(m) >= 4 && m[3] != "" {
		return 2
	}
	s := m[1]
	if s == "" {
		s = m[2]
	}
	n, _ := strconv.Atoi(s)
	return n
}

// substantive reports whether an item makes a measure (§2.2). Marks, counts and
// ending markers do not — including an ending demoted to an unknown token (§3.4).
func substantive(it *Object) bool {
	typ := objString(it, "type")
	if typ == "unknown" {
		return !endingRE.MatchString(objString(it, "text"))
	}
	switch typ {
	case "chord", "nochord", "beat", "repeat":
		return true
	}
	return false
}

func isBar(m *Object) bool {
	for _, el := range objArray(m, "items") {
		if substantive(el.(*Object)) {
			return true
		}
	}
	return false
}

// pyReprStr reproduces Python's repr() of a string for the diagnostics that use
// `!r`: a quoted string, escaping the quote, backslash and control characters,
// printable non-ASCII kept raw. Chooses `"` only when the string holds `'` and
// no `"`, as CPython does.
func pyReprStr(s string) string {
	quote := byte('\'')
	if strings.Contains(s, "'") && !strings.Contains(s, "\"") {
		quote = '"'
	}
	var b strings.Builder
	b.WriteByte(quote)
	for _, r := range s {
		switch {
		case r == rune(quote) || r == '\\':
			b.WriteByte('\\')
			b.WriteRune(r)
		case r == '\t':
			b.WriteString(`\t`)
		case r == '\n':
			b.WriteString(`\n`)
		case r == '\r':
			b.WriteString(`\r`)
		case r < 0x20 || r == 0x7f:
			b.WriteString(fmt.Sprintf(`\x%02x`, r))
		default:
			b.WriteRune(r)
		}
	}
	b.WriteByte(quote)
	return b.String()
}

// pyReprIntList reproduces Python's repr() of a list of ints: `[1, 2, 3]`.
func pyReprIntList(xs []int) string {
	parts := make([]string, len(xs))
	for i, x := range xs {
		parts[i] = strconv.Itoa(x)
	}
	return "[" + strings.Join(parts, ", ") + "]"
}

// --- chord-line scanning (§2) ------------------------------------------------

type barMatch struct {
	start     int // rune column where the match (its leading colon or pipes) begins
	end       int // rune column after the match
	colon1    bool
	pipeStart int
	pipeLen   int
	colon3    bool
	colon3Pos int
}

// findBars scans a line for bar lines, mirroring the reference's
// BARS = (:)?(\|+)(:)? finditer, over code points.
func findBars(rs []rune) []barMatch {
	var out []barMatch
	i := 0
	for i < len(rs) {
		start := i
		k := i
		colon1 := false
		if rs[k] == ':' {
			colon1 = true
			k++
		}
		if k < len(rs) && rs[k] == '|' {
			pipeStart := k
			for k < len(rs) && rs[k] == '|' {
				k++
			}
			pipeLen := k - pipeStart
			colon3 := false
			colon3Pos := -1
			if k < len(rs) && rs[k] == ':' {
				colon3 = true
				colon3Pos = k
				k++
			}
			out = append(out, barMatch{start: start, end: k, colon1: colon1, pipeStart: pipeStart, pipeLen: pipeLen, colon3: colon3, colon3Pos: colon3Pos})
			i = k
		} else {
			i = start + 1
		}
	}
	return out
}

type wordAt struct {
	col  int
	word string
}

func findWords(rs []rune, lo, hi int) []wordAt {
	var out []wordAt
	i := lo
	for i < hi {
		if rs[i] == ' ' {
			i++
			continue
		}
		j := i
		for j < hi && rs[j] != ' ' {
			j++
		}
		out = append(out, wordAt{col: i, word: string(rs[i:j])})
		i = j
	}
	return out
}

func markItem(open bool, notation string, column int) *Object {
	it := NewObject()
	it.Set("type", "mark")
	it.Set("open", open)
	it.Set("notation", notation)
	it.Set("column", column)
	return it
}

// splitMarks peels leading `(` and trailing `)` that nothing balances into marks
// (§2.3, §3.2).
func splitMarks(word string) (before, core, after string) {
	before, core, after = "", word, ""
	for core != "" && !chordBalanced(core) {
		if strings.HasPrefix(core, "(") {
			before += "("
			core = core[1:]
		} else if strings.HasSuffix(core, ")") {
			after = ")" + after
			core = core[:len(core)-1]
		} else {
			break
		}
	}
	return
}

func runeLen(s string) int { return len([]rune(s)) }

// classifyCore applies steps 2, 3, 4 and 6 of §2.3 to a word with its marks
// removed.
func classifyCore(core, dialect string) *Object {
	it := NewObject()
	if core == repeatMark {
		it.Set("type", "repeat")
		return it
	}
	if up := strings.ToUpper(core); up == "N.C." || up == "NC" {
		it.Set("type", "nochord")
		return it
	}
	if core == "/" || core == "." || core == "-" {
		it.Set("type", "beat")
		it.Set("mark", core)
		return it
	}
	if m := countRE.FindStringSubmatch(core); m != nil {
		it.Set("type", "count")
		it.Set("times", countTimes(m))
		return it
	}
	if m := endingRE.FindStringSubmatch(core); m != nil {
		n, _ := strconv.Atoi(m[1])
		it.Set("type", "ending")
		it.Set("number", n)
		return it
	}
	m := chordTokenRE.FindStringSubmatch(core)
	symbol := core
	if m != nil && m[1] != "" {
		symbol = m[1]
	}
	index := 1
	if m != nil && m[2] != "" {
		if iv, _ := strconv.Atoi(m[2]); iv > 1 {
			index = iv
		}
	}
	result := parseChord(symbol, dialect)
	if result.chord == nil {
		it.Set("type", "unknown")
		it.Set("text", core)
		return it
	}
	it.Set("type", "chord")
	it.Set("symbol", symbol)
	it.Set("index", index)
	it.Set("key", keyFor(symbol, index))
	it.Set("chord", result.chord)
	if len(result.ambiguities) > 0 {
		it.Set("ambiguities", result.ambiguities)
	}
	return it
}

type scanResult struct {
	measures    []*Object
	closeBar    any // string "|"/"||" or nil
	trailing    int
	trailingSet bool
	hasBar      bool
}

// scanLine reads the measures and items of one chord line, with every item's
// column (§2). Measures carry private "_col"/"_anchorCol" for the sung layout.
func scanLine(body, dialect string) *scanResult {
	rs := []rune(body)
	bars := findBars(rs)

	type piece struct {
		start int
		lo    int
		hi    int
		bar   *barMatch
	}
	var pieces []piece
	prevEnd := 0
	for bi := range bars {
		b := &bars[bi]
		pieces = append(pieces, piece{start: prevEnd, lo: prevEnd, hi: b.start, bar: b})
		prevEnd = b.end
	}
	pieces = append(pieces, piece{start: prevEnd, lo: prevEnd, hi: len(rs), bar: nil})

	measures := []*Object{}
	var closeBar any = nil
	carryAnchor := 0
	carrySet := false
	pending := []any{}
	var barBefore any = nil
	barCol := 0
	barColSet := false

	for pi := range pieces {
		pc := pieces[pi]
		items := []*Object{}
		anchor := 0
		anchorSet := false
		anchorCol := 0
		for _, wa := range findWords(rs, pc.lo, pc.hi) {
			col := wa.col
			word := strings.TrimRight(wa.word, ",;")
			if word == "" {
				continue
			}
			if a := barAnchorRE.FindStringSubmatch(word); a != nil {
				anchor, _ = strconv.Atoi(a[1])
				anchorSet = true
				anchorCol = col
				continue
			}
			if countRE.MatchString(word) {
				m := countRE.FindStringSubmatch(word)
				it := NewObject()
				it.Set("type", "count")
				it.Set("times", countTimes(m))
				it.Set("column", col)
				items = append(items, it)
				continue
			}
			before, core, after := splitMarks(word)
			core = strings.TrimRight(core, ",;")
			afterCol := col + runeLen(before) + runeLen(core)
			for k := 0; k < runeLen(before); k++ {
				items = append(items, markItem(true, "bracket", col+k))
			}
			if core != "" {
				if am := barAnchorRE.FindStringSubmatch(core); am != nil {
					anchor, _ = strconv.Atoi(am[1])
					anchorSet = true
					anchorCol = col + runeLen(before)
					core = ""
				}
			}
			if core != "" {
				it := classifyCore(core, dialect)
				it.Set("column", col+runeLen(before))
				items = append(items, it)
			}
			for k := 0; k < runeLen(after); k++ {
				items = append(items, markItem(false, "bracket", afterCol+k))
			}
		}
		var closeMark *Object
		if pc.bar != nil && pc.bar.colon1 {
			closeMark = markItem(false, "barline", pc.bar.start)
		}

		subst := false
		for _, it := range items {
			switch objString(it, "type") {
			case "chord", "nochord", "beat", "repeat", "unknown":
				subst = true
			}
		}
		if subst {
			measure := NewObject()
			measure.Set("bar", barBefore)
			combined := append(append([]any{}, pending...), objsToAny(items)...)
			pending = []any{}
			measure.Set("items", combined)
			if barColSet {
				measure.Set("_col", barCol)
			}
			if anchorSet {
				measure.Set("anchor", anchor)
				measure.Set("_anchorCol", anchorCol)
			} else if carrySet {
				measure.Set("anchor", carryAnchor)
			}
			carrySet = false
			if closeMark != nil {
				measure.Set("items", append(objArray(measure, "items"), closeMark))
			}
			measures = append(measures, measure)
		} else {
			if anchorSet {
				carryAnchor = anchor
				carrySet = true
			}
			if closeMark != nil {
				items = append(items, closeMark)
			}
			for _, it := range items {
				typ := objString(it, "type")
				backwards := typ == "count" || (typ == "mark" && !obool(it, "open"))
				if backwards && len(measures) > 0 {
					last := measures[len(measures)-1]
					last.Set("items", append(objArray(last, "items"), it))
				} else {
					pending = append(pending, it)
				}
			}
			if pc.bar == nil && barBefore != nil {
				closeBar = barBefore
			}
		}

		if pc.bar == nil {
			break
		}
		if pc.bar.pipeLen >= 2 {
			barBefore = "||"
		} else {
			barBefore = "|"
		}
		barCol = pc.bar.pipeStart
		barColSet = true
		if pc.bar.colon3 {
			pending = append(pending, markItem(true, "barline", pc.bar.colon3Pos))
		}
	}

	if len(pending) > 0 {
		if len(measures) > 0 {
			last := measures[len(measures)-1]
			last.Set("items", append(objArray(last, "items"), pending...))
		} else {
			m := NewObject()
			m.Set("bar", nil)
			m.Set("items", pending)
			measures = append(measures, m)
		}
	}

	return &scanResult{
		measures:    measures,
		closeBar:    closeBar,
		trailing:    carryAnchor,
		trailingSet: carrySet,
		hasBar:      len(bars) > 0,
	}
}

// --- line shapes (§4.1) ------------------------------------------------------

type shape struct {
	kind   string
	body   string
	words  int
	scan   *scanResult
	forced bool
}

func stripMarker(raw string) string {
	loc := lyricMarkerRE.FindStringSubmatchIndex(raw)
	if loc == nil {
		return raw
	}
	g1 := raw[loc[2]:loc[3]]
	g2 := raw[loc[4]:loc[5]]
	return g1 + " " + g2 + raw[loc[1]:]
}

func lineShape(raw, dialect string) *shape {
	if am := annotationRE.FindStringSubmatch(raw); am != nil {
		return &shape{kind: "annotation", body: am[1], words: 0, scan: nil, forced: false}
	}
	forced := lyricMarkerRE.MatchString(raw)
	body := raw
	if forced {
		body = stripMarker(raw)
	}
	if forced && strings.Trim(body, " ") == "" {
		forced = false
		body = raw
	}
	scan := scanLine(body, dialect)
	var items []*Object
	for _, m := range scan.measures {
		for _, el := range objArray(m, "items") {
			items = append(items, el.(*Object))
		}
	}
	words := 0
	chords := 0
	for _, it := range items {
		switch objString(it, "type") {
		case "chord", "nochord", "unknown":
			words++
		}
		switch objString(it, "type") {
		case "chord", "nochord":
			chords++
		}
	}
	var kind string
	switch {
	case forced:
		kind = "forced"
	case len(items) == 0:
		kind = "blank"
	case scan.hasBar || words == 0 || chords == words:
		kind = "chords"
	case float64(words-chords)/float64(words) >= 0.5:
		kind = "prose"
	default:
		kind = "chart"
	}
	return &shape{kind: kind, body: body, words: words, scan: scan, forced: forced}
}

// isChordRun reports whether every word of a line is a chart item that is not an
// unknown token (§1.7.3).
func isChordRun(text, dialect string) bool {
	for _, w := range strings.Split(strings.ReplaceAll(text, "|", " "), " ") {
		w = strings.TrimRight(w, ",;")
		if w == "" {
			continue
		}
		if barAnchorRE.MatchString(w) || countRE.MatchString(w) {
			continue
		}
		_, core, _ := splitMarks(w)
		if core == "" {
			continue
		}
		if objString(classifyCore(core, dialect), "type") == "unknown" {
			return false
		}
	}
	return true
}

// takeAnchor strips a trailing bar anchor and/or count from a heading, in either
// order (§1.7.4).
func takeAnchor(name string) (string, *int, *int) {
	var anchor, times *int
	for {
		if m := headingAnchorRE.FindStringSubmatchIndex(name); m != nil && anchor == nil {
			n, _ := strconv.Atoi(name[m[2]:m[3]])
			a := n
			anchor = &a
			name = strings.Trim(name[:m[0]], " ")
			continue
		}
		if m := headingCountRE.FindStringSubmatchIndex(name); m != nil && times == nil && m[0] > 0 {
			cm := countRE.FindStringSubmatch(name[m[2]:m[3]])
			t := countTimes(cm)
			times = &t
			name = strings.Trim(name[:m[0]], " ")
			continue
		}
		break
	}
	return name, anchor, times
}

// --- the parser --------------------------------------------------------------

type rawLine struct {
	lineno int
	text   string
}

type songPart struct {
	typ     string // "music", "notes", "verbatim"
	raw     []rawLine
	info    string
	shapes  []*shape
	opening bool
	section *songSection
	lines   []*Object
	text    string
}

type songSection struct {
	name    string
	heading any // nil or string
	anchor  *int
	times   *int
	body    []*songPart
	groups  []any
}

type voicingEntry struct {
	key, symbol string
	index       int
	frets       []any
	fingers     []any
	hasFingers  bool
}

type block struct {
	label    string
	tuning   tuningModel
	voicings []*voicingEntry
	notes    []string
}

type songParser struct {
	lines       []string
	diagnostics []*Object
	title       any
	properties  []*Object
	sections    []*songSection
	blocks      []*block
	dialect     string
	sung        bool
	sungAt      *int
}

func (p *songParser) diag(code string, line int, message string) {
	o := NewObject()
	o.Set("code", code)
	o.Set("message", message)
	o.Set("line", line)
	p.diagnostics = append(p.diagnostics, o)
}

func (p *songParser) diagText(code string, line int, message, text string) {
	o := NewObject()
	o.Set("code", code)
	o.Set("message", message)
	o.Set("line", line)
	o.Set("text", text)
	p.diagnostics = append(p.diagnostics, o)
}

func (p *songParser) prop(key string) (string, bool) {
	for _, pr := range p.properties {
		if objString(pr, "key") == key {
			return objString(pr, "value"), true
		}
	}
	return "", false
}

func (p *songParser) readMetadata() int {
	i := 0
	n := len(p.lines)
	for i < n && p.lines[i] == "" {
		i++
	}
	if i < n {
		if level, txt, ok := mdHeading(p.lines[i]); ok && level == 1 {
			if txt != "" {
				p.title = txt
			} else {
				p.title = nil
			}
			i++
		}
	}
	j := i
	for j < n {
		ln := p.lines[j]
		if ln == "" {
			j++
			continue
		}
		m := songListItemRE.FindStringSubmatch(ln)
		if m == nil {
			break
		}
		pm := propertyRE.FindStringSubmatch(m[1])
		if pm != nil {
			key := asciiLower(pm[1])
			value := pm[2]
			found := false
			for _, pr := range p.properties {
				if objString(pr, "key") == key {
					p.diagText("duplicate-property", j+1, "`"+key+"` is set again; the earlier value is not kept", ln)
					pr.Set("value", value)
					found = true
					break
				}
			}
			if !found {
				o := NewObject()
				o.Set("key", key)
				o.Set("value", value)
				p.properties = append(p.properties, o)
			}
		} else {
			p.diagText("bad-property", j+1, "a property is `key: value`, with a space after the colon; this line is not kept", ln)
		}
		i = j + 1
		j++
	}
	return i
}

func (p *songParser) newSection(name string, heading any) *songSection {
	name = innerSpacesRE.ReplaceAllString(strings.Trim(name, " "), " ")
	var anchor, times *int
	if heading != "label" {
		name, anchor, times = takeAnchor(name)
	}
	s := &songSection{name: name, heading: heading, anchor: anchor, times: times, groups: []any{}}
	p.sections = append(p.sections, s)
	return s
}

func (p *songParser) run() Model {
	for idx, raw := range p.lines {
		if isMarkerLine(raw) {
			p.diagText("marker-line", idx+1, "a conflict marker: this text is an unresolved merge, and cannot be saved until it is resolved", raw)
		}
	}
	start := p.readMetadata()

	raw := defaultDialect
	if v, ok := p.prop("notation"); ok && v != "" {
		raw = v
	}
	dialect := asciiLower(strings.Trim(raw, " "))
	if _, ok := DIALECTS[dialect]; !ok {
		p.diag("bad-notation", 1, "unknown notation "+pyReprStr(dialect)+"; using "+defaultDialect)
		dialect = defaultDialect
	}
	p.dialect = dialect

	section := p.newSection("", nil)
	var part *songPart
	var fnc *fence
	inVoicings := false
	var blk *block
	skipping := false

	leaveOpeningPart := func() {
		if part != nil && part.opening {
			allEmpty := true
			for _, rl := range part.raw {
				if rl.text != "" {
					allEmpty = false
					break
				}
			}
			if allEmpty && part.section != nil {
				body := part.section.body
				for i, pp := range body {
					if pp == part {
						part.section.body = append(body[:i], body[i+1:]...)
						break
					}
				}
			}
		}
	}

	for idx := start; idx < len(p.lines); idx++ {
		line := p.lines[idx]
		lineno := idx + 1

		if inVoicings {
			blk, skipping = p.voicingsLine(line, lineno, blk, skipping)
			continue
		}

		if fnc != nil {
			if closesFence(line, *fnc) {
				fnc = nil
				part = nil
				continue
			}
			if part.typ == "verbatim" {
				part.raw = append(part.raw, rawLine{lineno: lineno, text: line})
				continue
			}
			text := line
			headed := false
			for {
				bm := bracketHeadingRE.FindStringSubmatch(text)
				if !(bm != nil && bm[2] != "" && !isDigits(bm[2])) {
					break
				}
				rest := bm[3]
				var cm []string
				if rest != "" {
					cm = countRE.FindStringSubmatch(rest)
				}
				leaveOpeningPart()
				nm := bm[2]
				if cm != nil {
					nm = bm[2] + " " + rest
				}
				section = p.newSection(nm, "bracket")
				part = &songPart{typ: "music"}
				section.body = append(section.body, part)
				headed = true
				if cm != nil {
					text = ""
				} else {
					text = rest
				}
				if text == "" {
					break
				}
			}
			if headed && text == "" {
				continue
			}
			lm := labelHeadingRE.FindStringSubmatch(text)
			if lm != nil && lm[2] != "" && isChordRun(lm[3], dialect) {
				leaveOpeningPart()
				section = p.newSection(lm[2], "label")
				part = &songPart{typ: "music"}
				section.body = append(section.body, part)
				rest := lm[3]
				if rest != "" {
					part.raw = append(part.raw, rawLine{lineno: lineno, text: rest})
					if !strings.Contains(rest, "|") && len(strings.Split(rest, " ")) == 1 && objString(classifyCore(strings.TrimRight(rest, ",;"), dialect), "type") == "chord" {
						p.diagText("heading-looks-like-key", lineno,
							"`"+strings.Trim(text, " ")+"` reads as a section called "+pyReprStr(lm[2])+" holding one chord; if it is the song's key, write `- key: "+rest+"` in the properties",
							line)
					}
				}
				continue
			}
			part.raw = append(part.raw, rawLine{lineno: lineno, text: text})
			continue
		}

		if ch, length, info, ok := fenceOpen(line); ok {
			fnc = &fence{char: ch, length: length, line: lineno}
			if info != "" && info != "cifra" {
				part = &songPart{typ: "verbatim", info: info}
			} else {
				part = &songPart{typ: "music", opening: true, section: section}
			}
			section.body = append(section.body, part)
			continue
		}
		if ruleRE.MatchString(line) {
			inVoicings = true
			part = nil
			continue
		}
		if _, txt, ok := mdHeading(line); ok {
			section = p.newSection(txt, "markdown")
			part = nil
			continue
		}
		if part == nil || part.typ != "notes" {
			part = &songPart{typ: "notes"}
			section.body = append(section.body, part)
		}
		part.raw = append(part.raw, rawLine{lineno: lineno, text: line})
	}

	if fnc != nil {
		p.diag("unclosed-fence", fnc.line, "a fence was opened and never closed; it runs to the end of the document")
		if part != nil && part.typ == "verbatim" {
			for len(part.raw) > 0 && part.raw[len(part.raw)-1].text == "" {
				part.raw = part.raw[:len(part.raw)-1]
			}
		}
	}

	p.finishSections()
	return p.result()
}

// voicingsLine reads one line of the voicings part after the rule (§6, §7).
func (p *songParser) voicingsLine(raw string, lineno int, blk *block, skipping bool) (*block, bool) {
	if raw == "" {
		return blk, skipping
	}
	if ruleRE.MatchString(raw) {
		p.diagText("extra-rule", lineno, "a second rule; only the first divides the document, and this one is not kept", raw)
		return blk, skipping
	}
	if _, txt, ok := mdHeading(raw); ok {
		label, tuningText, hasSep := partition(txt, ":")
		label = strings.Trim(label, " ")
		tuningText = strings.Trim(tuningText, " ")
		if !hasSep || label == "" || tuningText == "" {
			p.diagText("bad-block-heading", lineno,
				"`"+strings.Trim(raw, " ")+"` comes after the rule, where a heading is a voicings block and needs a tuning (`## Voicings: E2 A2 D3 G3 B3 E4`). If it is a section of the song, move the rule below it; the lines under it are not read",
				raw)
			return nil, true
		}
		tn, err := parseTuning(tuningText)
		if err != nil {
			p.diagText("bad-block-heading", lineno,
				"not a tuning: "+pyReprStr(tuningText)+". A tuning is the open strings as pitches with octave numbers, lowest string first, like E2 A2 D3 G3 B3 E4 for a guitar or G4 C4 E4 A4 for a ukulele",
				raw)
			return nil, true
		}
		name := label
		if asciiLower(label) == "voicings" {
			name = ""
		}
		for _, existing := range p.blocks {
			if existing.tuning.id == tn.id && existing.label == name {
				p.diagText("duplicate-block", lineno, "a second block for the same tuning and variation; merged", raw)
				return existing, false
			}
		}
		nb := &block{label: name, tuning: tn}
		p.blocks = append(p.blocks, nb)
		return nb, false
	}
	if skipping {
		return blk, skipping
	}
	if m := songListItemRE.FindStringSubmatch(raw); m != nil {
		if blk == nil {
			p.diagText("item-outside-block", lineno, "a voicing before any block heading; not kept", raw)
			return blk, skipping
		}
		keyPart, fretsText, hasSep := partition(m[1], ":")
		key := strings.Trim(keyPart, " ")
		if !hasSep || key == "" || strings.Contains(key, " ") {
			p.diagText("bad-voicing", lineno, "a voicing is `- key: frets`; this line is not kept", raw)
			return blk, skipping
		}
		fingersText := ""
		hasFingersText := false
		if fm := fingeringRE.FindStringSubmatch(fretsText); fm != nil {
			fretsText = fm[1]
			fingersText = fm[2]
			hasFingersText = true
		}
		frets, ok := parseFrets(fretsText)
		if !ok {
			p.diagText("bad-voicing", lineno, "not a fret string: "+pyReprStr(strings.Trim(fretsText, " ")), raw)
			return blk, skipping
		}
		if len(frets) != len(blk.tuning.pitches) {
			p.diagText("bad-voicing", lineno, strconv.Itoa(len(frets))+" frets for "+strconv.Itoa(len(blk.tuning.pitches))+" strings", raw)
			return blk, skipping
		}
		cm := chordTokenRE.FindStringSubmatch(key)
		symbol := key
		if cm != nil && cm[1] != "" {
			symbol = cm[1]
		}
		index := 1
		if cm != nil && cm[2] != "" {
			if iv, _ := strconv.Atoi(cm[2]); iv > 1 {
				index = iv
			}
		}
		entry := &voicingEntry{key: keyFor(symbol, index), symbol: symbol, index: index, frets: frets}
		if hasFingersText {
			fingers, fok := parseFingers(fingersText)
			problem := "not a fingering"
			if fok {
				problem = checkFingers(fingers, frets)
			}
			if problem != "" {
				p.diagText("bad-fingering", lineno, problem, raw)
			} else {
				entry.fingers = fingers
				entry.hasFingers = true
			}
		}
		replaced := false
		for _, existing := range blk.voicings {
			if existing.key == entry.key {
				existing.frets = frets
				existing.fingers = nil
				existing.hasFingers = false
				if entry.hasFingers {
					existing.fingers = entry.fingers
					existing.hasFingers = true
				}
				replaced = true
				break
			}
		}
		if !replaced {
			blk.voicings = append(blk.voicings, entry)
		}
		return blk, skipping
	}
	if blk == nil {
		p.diagText("notes-outside-block", lineno, "text in the voicings part before any block; not kept", raw)
		return blk, skipping
	}
	blk.notes = append(blk.notes, raw)
	return blk, skipping
}

func (p *songParser) finishSections() {
	dialect := p.dialect
	var shaped []*songPart
	for _, s := range p.sections {
		for _, part := range s.body {
			if part.typ == "music" {
				part.shapes = make([]*shape, len(part.raw))
				for i, rl := range part.raw {
					part.shapes[i] = lineShape(rl.text, dialect)
				}
				shaped = append(shaped, part)
			}
		}
	}

	sung := false
	var sungAt *int
	for _, part := range shaped {
		if sung {
			break
		}
		shapes := part.shapes
		for i, sh := range shapes {
			if sung {
				break
			}
			if sh.kind == "forced" {
				v := part.raw[i].lineno
				sung, sungAt = true, &v
			} else if sh.kind == "chords" && i+1 < len(shapes) && shapes[i+1].kind == "prose" && shapes[i+1].words >= 2 {
				v := part.raw[i+1].lineno
				sung, sungAt = true, &v
			}
		}
	}
	wv := ""
	if v, ok := p.prop("words"); ok {
		wv = v
	}
	words := asciiLower(strings.Trim(wv, " "))
	if words == "yes" || words == "no" {
		sung = words == "yes"
		sungAt = nil
	} else if words != "" {
		p.diag("bad-property", 1, "`words` is yes or no, not "+pyReprStr(words))
	}
	p.sung = sung
	p.sungAt = sungAt

	var keptSections []*songSection
	for _, s := range p.sections {
		var newBody []*songPart
		for _, part := range s.body {
			switch part.typ {
			case "notes":
				lines := append([]rawLine{}, part.raw...)
				for len(lines) > 0 && lines[0].text == "" {
					lines = lines[1:]
				}
				for len(lines) > 0 && lines[len(lines)-1].text == "" {
					lines = lines[:len(lines)-1]
				}
				if len(lines) > 0 {
					texts := make([]string, len(lines))
					for i, rl := range lines {
						texts[i] = rl.text
					}
					newBody = append(newBody, &songPart{typ: "notes", text: strings.Join(texts, "\n")})
					if len(shaped) == 0 {
						p.unfencedCheck(lines)
					}
				}
			case "verbatim":
				texts := make([]string, len(part.raw))
				for i, rl := range part.raw {
					texts[i] = rl.text
				}
				newBody = append(newBody, &songPart{typ: "verbatim", info: part.info, text: strings.Join(texts, "\n")})
			default:
				newBody = append(newBody, &songPart{typ: "music", lines: p.assemble(part, sung)})
			}
		}
		s.body = newBody
		if len(newBody) > 0 || s.heading != nil {
			keptSections = append(keptSections, s)
		}
	}
	p.sections = keptSections

	p.carryAnchors()
	p.convergeSung()
	if !sung {
		p.numberBars()
	}
	for _, s := range p.sections {
		p.pairRepeats(s)
	}
	p.checkRepeatSigns()

	for _, s := range p.sections {
		for _, part := range s.body {
			if part.typ != "music" {
				continue
			}
			for _, line := range part.lines {
				for _, mEl := range objArray(line, "measures") {
					m := mEl.(*Object)
					m.Delete("_col")
					m.Delete("_anchorCol")
					m.Delete("_trailing")
				}
				line.Delete("_anchor_only")
				line.Delete("_words")
				line.Delete("_line")
			}
		}
	}
}

func (p *songParser) unfencedCheck(lines []rawLine) {
	for _, d := range p.diagnostics {
		if objString(d, "code") == "unfenced-music" {
			return
		}
	}
	for _, rl := range lines {
		if isHeadingLine(rl.text) || songListItemRE.MatchString(rl.text) {
			continue
		}
		sh := lineShape(rl.text, p.dialect)
		if sh.scan == nil {
			continue
		}
		chords := 0
		for _, mEl := range sh.scan.measures {
			for _, itEl := range objArray(mEl, "items") {
				t := objString(itEl.(*Object), "type")
				if t == "chord" || t == "nochord" {
					chords++
				}
			}
		}
		if sh.kind == "chords" && chords > 0 {
			p.diagText("unfenced-music", rl.lineno, "this reads as a line of chords, but it is outside a fence, so it is notes; put the music between ``` lines (or ~~~)", rl.text)
			return
		}
	}
}

func (p *songParser) assemble(part *songPart, sung bool) []*Object {
	shapes := part.shapes
	raws := part.raw
	out := []*Object{}
	content := false
	gap := false
	i := 0
	for i < len(shapes) {
		sh := shapes[i]
		lineno := raws[i].lineno
		if sh.kind == "blank" {
			if sh.scan != nil && sh.scan.trailingSet {
				l := NewObject()
				l.Set("kind", "chart")
				l.Set("measures", []any{})
				l.Set("closeBar", nil)
				l.Set("_anchor_only", sh.scan.trailing)
				out = append(out, l)
			}
			gap = true
			i++
			continue
		}
		if gap && content {
			l := NewObject()
			l.Set("kind", "break")
			out = append(out, l)
		}
		gap = false
		content = true
		if sh.kind == "annotation" {
			l := NewObject()
			l.Set("kind", "annotation")
			l.Set("text", sh.body)
			out = append(out, l)
			i++
			continue
		}
		if !sung {
			line := p.chartLine(sh)
			line.Set("_line", lineno)
			out = append(out, line)
			i++
			continue
		}
		var nxt *shape
		if i+1 < len(shapes) {
			nxt = shapes[i+1]
		}
		paired := sh.kind == "chords" && nxt != nil && (nxt.kind == "prose" || nxt.kind == "forced")
		if paired {
			line := p.sungLine(sh, nxt)
			line.Set("_line", lineno)
			out = append(out, line)
			i += 2
		} else if sh.kind == "prose" || sh.kind == "forced" {
			l := NewObject()
			l.Set("kind", "lyric")
			l.Set("text", sh.body)
			l.Set("forced", sh.forced)
			out = append(out, l)
			i++
		} else {
			line := p.chartLine(sh)
			line.Set("_line", lineno)
			out = append(out, line)
			i++
		}
	}
	return out
}

func (p *songParser) chartLine(sh *shape) *Object {
	scan := sh.scan
	for _, m := range scan.measures {
		for _, itEl := range objArray(m, "items") {
			itEl.(*Object).Delete("column")
		}
	}
	line := NewObject()
	line.Set("kind", "chart")
	line.Set("measures", objsToAny(scan.measures))
	line.Set("closeBar", scan.closeBar)
	if !scan.hasBar {
		line.Set("run", true)
	}
	if scan.trailingSet && len(scan.measures) > 0 {
		scan.measures[len(scan.measures)-1].Set("_trailing", scan.trailing)
	}
	return line
}

func (p *songParser) sungLine(sh, nxt *shape) *Object {
	scan := sh.scan
	for _, m := range scan.measures {
		if m.Has("_col") {
			v, _ := m.Get("_col")
			m.Delete("_col")
			m.Set("column", v)
		}
		if m.Has("_anchorCol") {
			v, _ := m.Get("_anchorCol")
			m.Delete("_anchorCol")
			m.Set("anchorColumn", v)
		}
	}
	if scan.trailingSet && len(scan.measures) > 0 {
		scan.measures[len(scan.measures)-1].Set("_trailing", scan.trailing)
	}
	line := NewObject()
	line.Set("kind", "sung")
	line.Set("measures", objsToAny(scan.measures))
	line.Set("closeBar", scan.closeBar)
	line.Set("forced", nxt.forced)
	line.Set("_words", nxt.body)
	return line
}

func (p *songParser) carryAnchors() {
	var pending *int
	for _, s := range p.sections {
		for _, part := range s.body {
			if part.typ != "music" {
				continue
			}
			kept := []*Object{}
			for _, line := range part.lines {
				if objString(line, "kind") == "chart" && line.Has("_anchor_only") {
					v, _ := oint(line, "_anchor_only")
					pv := v
					pending = &pv
					continue
				}
				kept = append(kept, line)
				k := objString(line, "kind")
				if k != "chart" && k != "sung" {
					continue
				}
				for _, mEl := range objArray(line, "measures") {
					m := mEl.(*Object)
					if m.Has("_trailing") && !isBar(m) {
						v, _ := oint(m, "_trailing")
						m.Delete("_trailing")
						pv := v
						pending = &pv
						continue
					}
					if !isBar(m) {
						continue
					}
					if pending != nil && !m.Has("anchor") {
						m.Set("anchor", *pending)
					}
					pending = nil
					if m.Has("_trailing") {
						v, _ := oint(m, "_trailing")
						m.Delete("_trailing")
						pv := v
						pending = &pv
					}
				}
			}
			part.lines = kept
		}
	}
}

func (p *songParser) convergeSung() {
	for _, s := range p.sections {
		for _, part := range s.body {
			if part.typ != "music" {
				continue
			}
			for _, line := range part.lines {
				if objString(line, "kind") == "sung" {
					w, _ := line.Get("_words")
					line.Delete("_words")
					converge(line, w.(string), p.dialect)
				}
			}
		}
	}
}

func (p *songParser) numberBars() {
	bar := 1
	for _, s := range p.sections {
		if s.anchor != nil {
			bar = *s.anchor
		}
		for _, part := range s.body {
			if part.typ != "music" {
				continue
			}
			for _, line := range part.lines {
				if objString(line, "kind") != "chart" || obool(line, "run") {
					continue
				}
				for _, mEl := range objArray(line, "measures") {
					m := mEl.(*Object)
					if !isBar(m) {
						continue
					}
					if m.Has("anchor") {
						v, _ := oint(m, "anchor")
						bar = v
					}
					m.Set("number", bar)
					m.Set("stated", m.Has("anchor"))
					bar++
				}
			}
		}
	}
}

type posRef struct{ part, line, measure, item int }

type posEntry struct {
	pos  posRef
	item *Object
	line *Object
}

func posObject(p posRef) *Object {
	o := NewObject()
	o.Set("part", p.part)
	o.Set("line", p.line)
	o.Set("measure", p.measure)
	o.Set("item", p.item)
	return o
}

func lineNo(line *Object) int {
	if v, ok := oint(line, "_line"); ok {
		return v
	}
	return 1
}

func (p *songParser) positions(s *songSection) []posEntry {
	var out []posEntry
	for pi, part := range s.body {
		if part.typ != "music" {
			continue
		}
		for li, line := range part.lines {
			k := objString(line, "kind")
			if k != "chart" && k != "sung" {
				continue
			}
			for mi, mEl := range objArray(line, "measures") {
				m := mEl.(*Object)
				for ii, itEl := range objArray(m, "items") {
					out = append(out, posEntry{pos: posRef{pi, li, mi, ii}, item: itEl.(*Object), line: line})
				}
			}
		}
	}
	return out
}

func appendEnding(group *Object, number int, pos posRef) {
	arr := objArray(group, "endings")
	e := NewObject()
	e.Set("number", number)
	e.Set("at", posObject(pos))
	group.Set("endings", append(arr, e))
}

func (p *songParser) pairRepeats(s *songSection) {
	seq := p.positions(s)
	openSet := false
	var group *Object
	groups := []any{}
	consumed := map[posRef]bool{}
	sameLine := func(a, b posRef) bool { return a.part == b.part && a.line == b.line }

	for n := 0; n < len(seq); n++ {
		e := seq[n]
		pos := e.pos
		it := e.item
		line := e.line
		t := objString(it, "type")
		lno := lineNo(line)
		switch t {
		case "mark":
			if obool(it, "open") {
				if openSet {
					p.diag("stray-mark", lno, "an opening mark inside an open repeat group")
				} else {
					openSet = true
					group = NewObject()
					group.Set("open", posObject(pos))
					group.Set("close", nil)
					group.Set("count", nil)
					group.Set("endings", []any{})
				}
			} else if !openSet {
				p.diag("stray-mark", lno, "a closing mark with no open repeat group")
			} else {
				group.Set("close", posObject(pos))
				if n+1 < len(seq) {
					ne := seq[n+1]
					if sameLine(ne.pos, pos) && objString(ne.item, "type") == "count" {
						times, _ := oint(ne.item, "times")
						group.Set("count", times)
						group.Set("countItem", posObject(ne.pos))
						consumed[ne.pos] = true
					} else if sameLine(ne.pos, pos) && objString(ne.item, "type") == "ending" {
						num, _ := oint(ne.item, "number")
						appendEnding(group, num, ne.pos)
						consumed[ne.pos] = true
					}
				}
				groups = append(groups, p.finishGroup(group, lno))
				openSet = false
				group = nil
			}
		case "ending":
			if consumed[pos] {
				continue
			}
			appended := false
			if group != nil {
				if cl, _ := group.Get("close"); cl == nil {
					num, _ := oint(it, "number")
					appendEnding(group, num, pos)
					consumed[pos] = true
					appended = true
				}
			}
			if !appended {
				num, _ := oint(it, "number")
				p.diag("ending-outside-group", lno, strconv.Itoa(num)+". outside a repeat group is not an ending")
			}
		case "count":
			if consumed[pos] {
				continue
			}
			last := n+1 == len(seq) || !sameLine(seq[n+1].pos, pos)
			hasMarks := false
			for _, e2 := range seq {
				if sameLine(e2.pos, pos) && objString(e2.item, "type") == "mark" {
					hasMarks = true
					break
				}
			}
			if last && !hasMarks {
				times, _ := oint(it, "times")
				line.Set("times", times)
			} else {
				p.diag("count-out-of-place", lno, "a count that follows neither a repeat group nor ends a line")
			}
		}
	}
	if openSet {
		lno := 1
		if len(seq) > 0 {
			lno = lineNo(seq[len(seq)-1].line)
		}
		p.diag("unclosed-group", lno, "a repeat group was opened and never closed")
	}
	s.groups = groups
	p.demote(s, consumed)
}

func (p *songParser) finishGroup(group *Object, lineno int) *Object {
	endings := objArray(group, "endings")
	if len(endings) > 0 {
		numbers := make([]int, len(endings))
		for i, eEl := range endings {
			numbers[i], _ = oint(eEl.(*Object), "number")
		}
		seqOK := true
		for i := range numbers {
			if numbers[i] != i+1 {
				seqOK = false
				break
			}
		}
		if !seqOK {
			p.diag("bad-ending-sequence", lineno, "endings must be 1. to n. in order, got "+pyReprIntList(numbers))
		}
		if cv, _ := group.Get("count"); cv != nil {
			p.diag("count-with-endings", lineno, "a group with endings takes its count from them")
		}
		mx := numbers[0]
		for _, x := range numbers {
			if x > mx {
				mx = x
			}
		}
		group.Set("count", mx)
	} else if cv, _ := group.Get("count"); cv == nil {
		group.Set("count", 2)
	}
	return group
}

func (p *songParser) demote(s *songSection, consumed map[posRef]bool) {
	for _, e := range p.positions(s) {
		it := e.item
		if objString(it, "type") == "ending" && !consumed[e.pos] {
			num, _ := oint(it, "number")
			text := strconv.Itoa(num) + "."
			col, hasCol := oint(it, "column")
			wrd, hasWrd := it.Get("words")
			for _, k := range it.Keys() {
				it.Delete(k)
			}
			it.Set("type", "unknown")
			it.Set("text", text)
			if hasCol {
				it.Set("column", col)
			}
			if hasWrd {
				it.Set("words", wrd)
			}
		}
	}
}

func (p *songParser) checkRepeatSigns() {
	var previous *Object
	for _, s := range p.sections {
		for _, part := range s.body {
			if part.typ != "music" {
				continue
			}
			for _, line := range part.lines {
				k := objString(line, "kind")
				if k != "chart" && k != "sung" {
					continue
				}
				for _, mEl := range objArray(line, "measures") {
					m := mEl.(*Object)
					var kinds []string
					for _, itEl := range objArray(m, "items") {
						t := objString(itEl.(*Object), "type")
						switch t {
						case "chord", "nochord", "repeat", "unknown":
							kinds = append(kinds, t)
						}
					}
					hasRepeat := false
					for _, kk := range kinds {
						if kk == "repeat" {
							hasRepeat = true
							break
						}
					}
					if hasRepeat {
						if previous == nil {
							p.diag("repeat-without-previous", lineNo(line), "a % with no measure before it")
						}
						if len(kinds) > 1 {
							p.diag("repeat-beside-items", lineNo(line), "a % beside other items has no defined meaning")
						}
					}
					previous = m
				}
			}
		}
	}
}

func sectionObject(s *songSection) *Object {
	o := NewObject()
	o.Set("name", s.name)
	o.Set("heading", s.heading)
	if s.anchor != nil {
		o.Set("anchor", *s.anchor)
	} else {
		o.Set("anchor", nil)
	}
	body := []any{}
	for _, part := range s.body {
		po := NewObject()
		switch part.typ {
		case "music":
			po.Set("type", "music")
			lines := []any{}
			for _, l := range part.lines {
				lines = append(lines, l)
			}
			po.Set("lines", lines)
		case "notes":
			po.Set("type", "notes")
			po.Set("text", part.text)
		case "verbatim":
			po.Set("type", "verbatim")
			po.Set("info", part.info)
			po.Set("text", part.text)
		}
		body = append(body, po)
	}
	o.Set("body", body)
	o.Set("groups", s.groups)
	if s.times != nil {
		o.Set("times", *s.times)
	}
	return o
}

func blockObject(b *block) *Object {
	o := NewObject()
	o.Set("label", b.label)
	o.Set("tuning", tuningObject(b.tuning))
	voi := []any{}
	for _, v := range b.voicings {
		vo := NewObject()
		vo.Set("key", v.key)
		vo.Set("symbol", v.symbol)
		vo.Set("index", v.index)
		vo.Set("frets", v.frets)
		if v.hasFingers {
			vo.Set("fingers", v.fingers)
		}
		voi = append(voi, vo)
	}
	o.Set("voicings", voi)
	notes := []any{}
	for _, n := range b.notes {
		notes = append(notes, n)
	}
	o.Set("notes", notes)
	return o
}

func (p *songParser) result() Model {
	sort.SliceStable(p.diagnostics, func(a, b int) bool {
		la, _ := oint(p.diagnostics[a], "line")
		lb, _ := oint(p.diagnostics[b], "line")
		return la < lb
	})
	for _, b := range p.blocks {
		sort.SliceStable(b.voicings, func(i, j int) bool {
			if b.voicings[i].symbol != b.voicings[j].symbol {
				return b.voicings[i].symbol < b.voicings[j].symbol
			}
			return b.voicings[i].index < b.voicings[j].index
		})
	}
	order := map[string]int{}
	next := 0
	for _, b := range p.blocks {
		if _, ok := order[b.tuning.id]; !ok {
			order[b.tuning.id] = next
			next++
		}
	}
	idxs := make([]int, len(p.blocks))
	for i := range idxs {
		idxs[i] = i
	}
	sort.SliceStable(idxs, func(a, b int) bool {
		ba, bb := p.blocks[idxs[a]], p.blocks[idxs[b]]
		if order[ba.tuning.id] != order[bb.tuning.id] {
			return order[ba.tuning.id] < order[bb.tuning.id]
		}
		la, lb := ba.label != "", bb.label != ""
		if la != lb {
			return !la
		}
		return idxs[a] < idxs[b]
	})
	orderedBlocks := make([]*block, len(p.blocks))
	for i, k := range idxs {
		orderedBlocks[i] = p.blocks[k]
	}

	m := NewObject()
	if s, ok := p.title.(string); ok {
		m.Set("title", s)
	} else {
		m.Set("title", nil)
	}
	props := []any{}
	for _, pr := range p.properties {
		props = append(props, pr)
	}
	m.Set("properties", props)
	secs := []any{}
	for _, s := range p.sections {
		secs = append(secs, sectionObject(s))
	}
	m.Set("sections", secs)
	blks := []any{}
	for _, b := range orderedBlocks {
		blks = append(blks, blockObject(b))
	}
	m.Set("blocks", blks)
	m.Set("sung", p.sung)
	if p.sungAt != nil {
		m.Set("sungAt", *p.sungAt)
	} else {
		m.Set("sungAt", nil)
	}
	diags := []any{}
	for _, d := range p.diagnostics {
		diags = append(diags, d)
	}
	m.Set("diagnostics", diags)
	return m
}
