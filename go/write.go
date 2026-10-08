package cifra

// The canonical writer (spec §8): a song model back to its bytes, plus the
// `is canonical` predicate the hook needs. A faithful port of the reference's
// reference/cifra_md/write.py (and the writer half of layout.py, in layout.go) —
// never imported from it: agreement is by the corpus, byte for byte, not shared
// code (DIRECTION §3.6). It shares no code with the JavaScript twin either.
//
//	Write(model)       serialize(canonical(model)), then refuse a marked text
//	Canonical(model)   the model of the document's canonical form (§8.2/§8.3/§4.5)
//	IsCanonical(bytes) §9.1: Write(Parse(text)) == text, after the UTF-8/marker gates
//
// The per-line renderers (chart_line_text, sung_text, chord_text, lyric_text)
// live beside the §4.5 converge engine in layout.go, which the reader built: one
// token model both lays a sung line out and prints it (§8.4.5). This file holds
// the document serialiser, the §8.3 footnote invariants, the model-level
// canonicaliser and the marked-text guard.

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// --- fret and fingering formatters (§7.5, §7.5.1) ----------------------------

// numVal reads a numeric model value as an int, whether it arrived as a Go int
// (the reader's own models) or a json.Number (models loaded with DecodeModel).
func numVal(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case json.Number:
		i, _ := n.Int64()
		return int(i)
	case float64:
		return int(n)
	}
	return 0
}

// formatFrets writes a fret string: compact, unless a fret reaches 10, then
// hyphenated (§7.5).
func formatFrets(frets []any) string {
	parts := make([]string, len(frets))
	wide := false
	for i, f := range frets {
		if s, ok := f.(string); ok && s == "x" {
			parts[i] = "x"
			continue
		}
		n := numVal(f)
		parts[i] = strconv.Itoa(n)
		if n >= 10 {
			wide = true
		}
	}
	if wide {
		return strings.Join(parts, "-")
	}
	return strings.Join(parts, "")
}

// formatFingers writes a fingering: a space-joined row of positions, `-` for a
// string a finger does not press (§7.5.1).
func formatFingers(fingers []any) string {
	parts := make([]string, len(fingers))
	for i, f := range fingers {
		switch v := f.(type) {
		case nil:
			parts[i] = "-"
		case string:
			parts[i] = v
		default:
			parts[i] = strconv.Itoa(numVal(v))
		}
	}
	return strings.Join(parts, " ")
}

// --- deep copy ---------------------------------------------------------------

// deepCopyValue copies a model value so canonical() never mutates its caller's
// input (the reference's copy.deepcopy). Scalars are immutable and shared.
func deepCopyValue(v any) any {
	switch x := v.(type) {
	case *Object:
		o := NewObject()
		for _, k := range x.keys {
			o.Set(k, deepCopyValue(x.vals[k]))
		}
		return o
	case []any:
		a := make([]any, len(x))
		for i, e := range x {
			a[i] = deepCopyValue(e)
		}
		return a
	default:
		return v
	}
}

// --- the canonical model -----------------------------------------------------

// dialectOf is the document's reading dialect: the `notation` property if it
// names a known dialect, else the default (§5.6).
func dialectOf(doc *Object) string {
	for _, pEl := range objArray(doc, "properties") {
		p := pEl.(*Object)
		if objString(p, "key") == "notation" {
			d := asciiLower(strings.Trim(objString(p, "value"), " "))
			if _, ok := DIALECTS[d]; ok {
				return d
			}
			return defaultDialect
		}
	}
	return defaultDialect
}

// allMusicItems yields every item of every music line in the chart.
func allMusicItems(doc *Object) []*Object {
	var out []*Object
	for _, sEl := range objArray(doc, "sections") {
		for _, pEl := range objArray(sEl.(*Object), "body") {
			part := pEl.(*Object)
			if objString(part, "type") != "music" {
				continue
			}
			for _, lEl := range objArray(part, "lines") {
				for _, mEl := range objArray(lEl.(*Object), "measures") {
					for _, itEl := range objArray(mEl.(*Object), "items") {
						out = append(out, itEl.(*Object))
					}
				}
			}
		}
	}
	return out
}

// chordItemsOf yields every chord item of the chart.
func chordItemsOf(doc *Object) []*Object {
	var out []*Object
	for _, it := range allMusicItems(doc) {
		if objString(it, "type") == "chord" {
			out = append(out, it)
		}
	}
	return out
}

// sameShape reports whether two voicing entries give the same shape: the same
// frets and the same fingering (an absent fingering is distinct from one that
// is present) (§8.3). Compared through the one pinned serialiser, so the test
// is independent of how the numbers arrived in the model.
func sameShape(a, b *Object) bool {
	af, _ := a.Get("frets")
	bf, _ := b.Get("frets")
	if string(Encode(af)) != string(Encode(bf)) {
		return false
	}
	av, aok := a.Get("fingers")
	bv, bok := b.Get("fingers")
	if aok != bok {
		return false
	}
	if !aok {
		return true
	}
	return string(Encode(av)) == string(Encode(bv))
}

// footnotes applies I1, I3 and I2 of §8.3, in that order, to the model in
// place: unused keys dropped, indices no block tells apart merged, the survivors
// renumbered 1…n in the chart and every block alike (I5, one pass).
func footnotes(doc *Object) {
	unknown := map[string]bool{}
	for _, it := range allMusicItems(doc) {
		if objString(it, "type") == "unknown" {
			unknown[objString(it, "text")] = true
		}
	}
	used := map[string][]int{}
	var symbolOrder []string
	for _, it := range chordItemsOf(doc) {
		sym := objString(it, "symbol")
		idx := numVal(mustGet(it, "index"))
		if _, ok := used[sym]; !ok {
			symbolOrder = append(symbolOrder, sym)
			used[sym] = []int{}
		}
		if !containsInt(used[sym], idx) {
			used[sym] = append(used[sym], idx)
		}
	}

	blocks := objArray(doc, "blocks")

	// I1: a key the chart does not use is dropped from every block, unless an
	// unknown token spells that key.
	for _, bEl := range blocks {
		b := bEl.(*Object)
		var kept []any
		for _, eEl := range objArray(b, "voicings") {
			e := eEl.(*Object)
			sym := objString(e, "symbol")
			idx := numVal(mustGet(e, "index"))
			if containsInt(used[sym], idx) || unknown[objString(e, "key")] {
				kept = append(kept, e)
			}
		}
		if kept == nil {
			kept = []any{}
		}
		b.Set("voicings", kept)
	}

	for _, symbol := range symbolOrder {
		indices := append([]int{}, used[symbol]...)
		sort.Ints(indices)

		// shapes[k] maps an index to this symbol's entry in block k.
		shapes := make([]map[int]*Object, len(blocks))
		for k, bEl := range blocks {
			m := map[int]*Object{}
			for _, eEl := range objArray(bEl.(*Object), "voicings") {
				e := eEl.(*Object)
				if objString(e, "symbol") == symbol {
					m[numVal(mustGet(e, "index"))] = e
				}
			}
			shapes[k] = m
		}
		same := func(i, j int) bool {
			both := false
			for _, sh := range shapes {
				a, aok := sh[i]
				c, cok := sh[j]
				if !aok && !cok {
					continue
				}
				if !aok || !cok || !sameShape(a, c) {
					return false
				}
				both = true
			}
			return both
		}

		// I3: an index no block tells apart from a lower one joins the lowest such.
		rep := map[int]int{}
		for _, i := range indices {
			rep[i] = i
			for _, r := range indices {
				if r < i && rep[r] == r && same(r, i) {
					rep[i] = r
					break
				}
			}
		}
		// I2: the indices that remain become 1 to n, in order.
		survSet := map[int]bool{}
		for _, i := range indices {
			survSet[rep[i]] = true
		}
		var survivors []int
		for s := range survSet {
			survivors = append(survivors, s)
		}
		sort.Ints(survivors)
		survPos := map[int]int{}
		for pos, s := range survivors {
			survPos[s] = pos + 1
		}
		newIndex := map[int]int{}
		for _, i := range indices {
			newIndex[i] = survPos[rep[i]]
		}

		for _, it := range chordItemsOf(doc) {
			if objString(it, "symbol") == symbol {
				ni := newIndex[numVal(mustGet(it, "index"))]
				it.Set("index", ni)
				it.Set("key", keyFor(symbol, ni))
			}
		}
		for _, bEl := range blocks {
			b := bEl.(*Object)
			var kept []any
			for _, eEl := range objArray(b, "voicings") {
				e := eEl.(*Object)
				if objString(e, "symbol") == symbol {
					old := numVal(mustGet(e, "index"))
					if rep[old] != old {
						continue
					}
					ni := newIndex[old]
					e.Set("index", ni)
					e.Set("key", keyFor(symbol, ni))
				}
				kept = append(kept, e)
			}
			if kept == nil {
				kept = []any{}
			}
			b.Set("voicings", kept)
		}
	}
}

func mustGet(o *Object, key string) any {
	v, _ := o.Get(key)
	return v
}

func containsInt(xs []int, x int) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

// collapseBlankRuns turns a run of blank lines into a single blank line (§8.2):
// notes keep their shape but never hold two blank lines in a row.
func collapseBlankRuns(text string) string {
	var out []string
	for _, ln := range strings.Split(text, "\n") {
		if ln == "" && len(out) > 0 && out[len(out)-1] == "" {
			continue
		}
		out = append(out, ln)
	}
	return strings.Join(out, "\n")
}

// canonicalModel returns the model of the document's canonical form (§8.2):
// what a reader gets back from serialize(canonicalModel(doc)), derived fields
// included. `sungAt` and `diagnostics` are left as they were — they describe a
// text, not a model (refinement §Decisions).
func canonicalModel(doc *Object) *Object {
	doc = deepCopyValue(doc).(*Object)
	dialect := dialectOf(doc)

	if v, ok := doc.Get("title"); ok {
		if s, isStr := v.(string); isStr && s == "" {
			doc.Set("title", nil)
		}
	}

	for _, bEl := range objArray(doc, "blocks") {
		for _, eEl := range objArray(bEl.(*Object), "voicings") {
			e := eEl.(*Object)
			if fv, ok := e.Get("fingers"); ok {
				allNil := true
				for _, f := range fv.([]any) {
					if f != nil {
						allNil = false
						break
					}
				}
				if allNil {
					e.Delete("fingers")
				}
			}
		}
	}

	footnotes(doc)

	for _, bEl := range objArray(doc, "blocks") {
		b := bEl.(*Object)
		sortVoicings(objArray(b, "voicings"))
	}

	for _, sEl := range objArray(doc, "sections") {
		for _, pEl := range objArray(sEl.(*Object), "body") {
			part := pEl.(*Object)
			if objString(part, "type") == "notes" {
				part.Set("text", collapseBlankRuns(objString(part, "text")))
			}
			if objString(part, "type") != "music" {
				continue
			}
			for _, lEl := range objArray(part, "lines") {
				line := lEl.(*Object)
				if objString(line, "kind") == "sung" {
					// The layout again, for tokens whose width §8.3 changed (§4.5.3).
					converge(line, lyricText(line), dialect)
				}
			}
		}
	}

	rederiveModel(doc, dialect)
	return doc
}

// sortVoicings sorts a block's voicings by symbol then index, in place.
func sortVoicings(voicings []any) {
	sort.SliceStable(voicings, func(i, j int) bool {
		a := voicings[i].(*Object)
		b := voicings[j].(*Object)
		sa, sb := objString(a, "symbol"), objString(b, "symbol")
		if sa != sb {
			return sa < sb
		}
		return numVal(mustGet(a, "index")) < numVal(mustGet(b, "index"))
	})
}

// --- re-deriving bar numbers and repeat groups (§2.8, §3) --------------------
//
// These recompute the model's derived fields exactly as the reader does, but
// read the model directly: the reader's own numberBars/pairRepeats work on the
// parser's internal section structs, which a model no longer carries, so a
// model-level twin is needed. Diagnostics these recomputations would raise are
// discarded — a model carries only the diagnostics its own reading produced
// (refinement §Decisions).

func rederiveModel(doc *Object, dialect string) {
	for _, sEl := range objArray(doc, "sections") {
		for _, pEl := range objArray(sEl.(*Object), "body") {
			part := pEl.(*Object)
			if objString(part, "type") != "music" {
				continue
			}
			for _, lEl := range objArray(part, "lines") {
				for _, mEl := range objArray(lEl.(*Object), "measures") {
					m := mEl.(*Object)
					m.Delete("number")
					m.Delete("stated")
				}
			}
		}
	}
	if !obool(doc, "sung") {
		numberBarsModel(doc)
	}
	for _, sEl := range objArray(doc, "sections") {
		pairRepeatsModel(sEl.(*Object))
	}
}

func numberBarsModel(doc *Object) {
	bar := 1
	for _, sEl := range objArray(doc, "sections") {
		s := sEl.(*Object)
		if av, ok := oint(s, "anchor"); ok {
			bar = av
		}
		for _, pEl := range objArray(s, "body") {
			part := pEl.(*Object)
			if objString(part, "type") != "music" {
				continue
			}
			for _, lEl := range objArray(part, "lines") {
				line := lEl.(*Object)
				if objString(line, "kind") != "chart" || obool(line, "run") {
					continue
				}
				for _, mEl := range objArray(line, "measures") {
					m := mEl.(*Object)
					if !isBar(m) {
						continue
					}
					if av, ok := oint(m, "anchor"); ok {
						bar = av
					}
					m.Set("number", bar)
					m.Set("stated", m.Has("anchor"))
					bar++
				}
			}
		}
	}
}

func positionsModel(s *Object) []posEntry {
	var out []posEntry
	for pi, pEl := range objArray(s, "body") {
		part := pEl.(*Object)
		if objString(part, "type") != "music" {
			continue
		}
		for li, lEl := range objArray(part, "lines") {
			line := lEl.(*Object)
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

func pairRepeatsModel(s *Object) {
	seq := positionsModel(s)
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
		switch objString(it, "type") {
		case "mark":
			if obool(it, "open") {
				if !openSet {
					openSet = true
					group = NewObject()
					group.Set("open", posObject(pos))
					group.Set("close", nil)
					group.Set("count", nil)
					group.Set("endings", []any{})
				}
			} else if openSet {
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
				groups = append(groups, finishGroupModel(group))
				openSet = false
				group = nil
			}
		case "ending":
			if consumed[pos] {
				continue
			}
			if group != nil {
				if cl, _ := group.Get("close"); cl == nil {
					num, _ := oint(it, "number")
					appendEnding(group, num, pos)
					consumed[pos] = true
				}
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
			}
		}
	}
	s.Set("groups", groups)
	demoteModel(s, consumed)
}

func finishGroupModel(group *Object) *Object {
	endings := objArray(group, "endings")
	if len(endings) > 0 {
		mx := 0
		for _, eEl := range endings {
			n, _ := oint(eEl.(*Object), "number")
			if n > mx {
				mx = n
			}
		}
		group.Set("count", mx)
	} else if cv, _ := group.Get("count"); cv == nil {
		group.Set("count", 2)
	}
	return group
}

func demoteModel(s *Object, consumed map[posRef]bool) {
	for _, e := range positionsModel(s) {
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

// --- printing ----------------------------------------------------------------

// fenceLines wraps lines in a fence long enough that none of them closes it
// (§8.4.3). The fence character is a backtick, or a tilde when the info string
// holds a backtick.
func fenceLines(lines []string, info string) []string {
	char := byte('`')
	if strings.Contains(info, "`") {
		char = '~'
	}
	longest := 0
	for _, ln := range lines {
		if run := leadingFenceRun(ln, char); run > longest {
			longest = run
		}
	}
	n := longest + 1
	if n < 3 {
		n = 3
	}
	marker := strings.Repeat(string(char), n)
	out := make([]string, 0, len(lines)+2)
	out = append(out, marker+info)
	out = append(out, lines...)
	out = append(out, marker)
	return out
}

// leadingFenceRun is the length of a run of char at the start of a line, after
// up to three leading spaces; 0 when the line does not begin with such a run.
func leadingFenceRun(line string, char byte) int {
	i := 0
	for i < len(line) && i < 3 && line[i] == ' ' {
		i++
	}
	n := 0
	for i < len(line) && line[i] == char {
		n++
		i++
	}
	return n
}

// musicLines prints the lines of a music part (§8.4.4, §8.4.5).
func musicLines(lines []any, dialect string) []string {
	var out []string
	for _, lEl := range lines {
		line := lEl.(*Object)
		switch objString(line, "kind") {
		case "chart":
			out = append(out, chartLineText(line, dialect))
		case "sung":
			out = append(out, sungText(line, dialect)...)
		case "lyric":
			text := objString(line, "text")
			if obool(line, "forced") {
				rs := []rune(text)
				out = append(out, ">"+string(rs[1:]))
			} else {
				out = append(out, text)
			}
		case "break":
			out = append(out, "")
		case "annotation":
			if t := objString(line, "text"); t != "" {
				out = append(out, "// "+t)
			} else {
				out = append(out, "//")
			}
		}
	}
	return out
}

// headingLine writes a Markdown heading. A text that ends in what CommonMark
// would take for a closing sequence gets a closing ` #` of its own, so that it
// reads back (§8.4.3).
func headingLine(level int, text string) string {
	if closingSequenceRE.MatchString(text) {
		text += " #"
	}
	h := strings.Repeat("#", level)
	if text != "" {
		return h + " " + text
	}
	return h
}

// headingName is a section's name with its ` @anchor` and ` x count` written
// back (§8.4.3).
func headingName(s *Object) string {
	name := objString(s, "name")
	if a, ok := oint(s, "anchor"); ok {
		name = strings.Trim(name+" @"+strconv.Itoa(a), " ")
	}
	if t, ok := oint(s, "times"); ok {
		name = strings.Trim(name+" x"+strconv.Itoa(t), " ")
	}
	return name
}

// chartBlocks writes the chart section by section (§8.4.3): each block is the
// lines of one fence or notes part; a bracket or label heading opens a music
// fence that continuing sections share.
func chartBlocks(sections []any, dialect string) [][]string {
	var blocks [][]string
	var openFence []string
	openFenceSet := false

	flush := func() {
		if openFenceSet {
			blocks = append(blocks, fenceLines(openFence, ""))
			openFence = nil
			openFenceSet = false
		}
	}
	partLines := func(part *Object) []string {
		switch objString(part, "type") {
		case "notes":
			return strings.Split(objString(part, "text"), "\n")
		case "verbatim":
			return fenceLines(strings.Split(objString(part, "text"), "\n"), objString(part, "info"))
		default:
			return fenceLines(musicLines(objArray(part, "lines"), dialect), "")
		}
	}

	for _, sEl := range sections {
		s := sEl.(*Object)
		heading := objString(s, "heading")
		if heading == "bracket" || heading == "label" {
			var head string
			if heading == "bracket" {
				head = "[" + headingName(s) + "]"
			} else {
				head = objString(s, "name") + ":"
			}
			body := objArray(s, "body")
			var firstMusic []any
			if len(body) > 0 && objString(body[0].(*Object), "type") == "music" {
				firstMusic = objArray(body[0].(*Object), "lines")
			}
			joined := false
			if len(firstMusic) > 0 && objString(firstMusic[0].(*Object), "kind") == "chart" {
				text := chartLineText(firstMusic[0].(*Object), dialect)
				if heading == "bracket" && !countRE.MatchString(text) {
					head, joined = head+" "+text, true
				} else if heading == "label" && isChordRun(text, dialect) {
					head, joined = head+" "+text, true
				}
			}
			if !openFenceSet {
				openFence = []string{head}
				openFenceSet = true
			} else {
				openFence = append(openFence, "", head)
			}
			for idx, pEl := range body {
				part := pEl.(*Object)
				lines := objArray(part, "lines")
				if objString(part, "type") == "music" && idx == 0 {
					if joined {
						openFence = append(openFence, musicLines(lines[1:], dialect)...)
					} else {
						openFence = append(openFence, musicLines(lines, dialect)...)
					}
				} else if objString(part, "type") == "music" && len(lines) > 0 {
					flush()
					openFence = musicLines(lines, dialect)
					openFenceSet = true
				} else {
					flush()
					blocks = append(blocks, partLines(part))
				}
			}
			continue
		}
		flush()
		var parts [][]string
		for _, pEl := range objArray(s, "body") {
			parts = append(parts, partLines(pEl.(*Object)))
		}
		if heading == "markdown" {
			head := headingLine(2, headingName(s))
			if len(parts) > 0 {
				parts[0] = append([]string{head}, parts[0]...)
			} else {
				parts = [][]string{{head}}
			}
		}
		blocks = append(blocks, parts...)
	}
	flush()
	return blocks
}

// voicingBlocks writes the voicings part (§8.4.6): blocks ordered by first
// tuning then variation, each block's items ordered by symbol then index.
func voicingBlocks(blocks []any) [][]string {
	var order []string
	indexOf := func(id string) int {
		for i, x := range order {
			if x == id {
				return i
			}
		}
		return -1
	}
	for _, bEl := range blocks {
		id := objString(oobj(bEl.(*Object), "tuning"), "id")
		if indexOf(id) < 0 {
			order = append(order, id)
		}
	}
	idxs := make([]int, len(blocks))
	for i := range idxs {
		idxs[i] = i
	}
	sort.SliceStable(idxs, func(a, b int) bool {
		ba := blocks[idxs[a]].(*Object)
		bb := blocks[idxs[b]].(*Object)
		oa := indexOf(objString(oobj(ba, "tuning"), "id"))
		ob := indexOf(objString(oobj(bb, "tuning"), "id"))
		if oa != ob {
			return oa < ob
		}
		la := objString(ba, "label") != ""
		lb := objString(bb, "label") != ""
		if la != lb {
			return !la
		}
		return idxs[a] < idxs[b]
	})

	var out [][]string
	for _, k := range idxs {
		b := blocks[k].(*Object)
		label := objString(b, "label")
		if label == "" {
			label = "Voicings"
		}
		tuning := oobj(b, "tuning")
		lines := []string{"## " + label + ": " + objString(tuning, "text")}
		voicings := append([]any{}, objArray(b, "voicings")...)
		sortVoicings(voicings)
		for _, eEl := range voicings {
			e := eEl.(*Object)
			item := "- " + objString(e, "key") + ": " + formatFrets(objArray(e, "frets"))
			if fv, ok := e.Get("fingers"); ok {
				if arr, isArr := fv.([]any); isArr && len(arr) > 0 {
					item += " (" + formatFingers(arr) + ")"
				}
			}
			lines = append(lines, item)
		}
		for _, nEl := range objArray(b, "notes") {
			if s, ok := nEl.(string); ok {
				lines = append(lines, s)
			}
		}
		out = append(out, lines)
	}
	return out
}

// serialize prints a model that is already canonical (§8.4). Write is what
// callers want; this assumes §8.3 has been applied.
func serialize(doc *Object) string {
	var blocks [][]string
	var meta []string
	if title := objString(doc, "title"); title != "" {
		meta = append(meta, headingLine(1, title))
	}
	for _, pEl := range objArray(doc, "properties") {
		p := pEl.(*Object)
		if v := objString(p, "value"); v != "" {
			meta = append(meta, "- "+objString(p, "key")+": "+v)
		} else {
			meta = append(meta, "- "+objString(p, "key")+":")
		}
	}
	if len(meta) > 0 {
		blocks = append(blocks, meta)
	}
	blocks = append(blocks, chartBlocks(objArray(doc, "sections"), dialectOf(doc))...)
	voicings := voicingBlocks(objArray(doc, "blocks"))
	if len(voicings) > 0 {
		blocks = append(blocks, []string{"---"})
		blocks = append(blocks, voicings...)
	}
	if len(blocks) == 0 {
		return ""
	}
	joined := make([]string, len(blocks))
	for i, b := range blocks {
		joined[i] = strings.Join(b, "\n")
	}
	return strings.Join(joined, "\n\n") + "\n"
}

// --- the marked-text refusal (§8.1, §11.12.3) --------------------------------

// MarkedTextError reports that a document's canonical text would hold a line of
// git's conflict markers: an unresolved merge, which a writer refuses to save
// (§8.1, §11.12.3). Line is the first marker line's 1-based number, Text that
// line. It mirrors the reader's NotUTF8Error in Go idiom.
type MarkedTextError struct {
	Line int
	Text string
}

func (e *MarkedTextError) Error() string {
	return fmt.Sprintf("cifra: line %d is a conflict marker (%s): resolve the merge before saving", e.Line, pyReprStr(e.Text))
}

// checkUnmarked returns a *MarkedTextError at the first marker line of a text,
// or nil (§11.12.3).
func checkUnmarked(text string) error {
	for i, ln := range strings.Split(text, "\n") {
		if isMarkerLine(ln) {
			return &MarkedTextError{Line: i + 1, Text: ln}
		}
	}
	return nil
}

// writeModel is the public writer's body: the canonical text of a document
// model (§8), with a marked model refused.
func writeModel(doc *Object) ([]byte, error) {
	text := serialize(canonicalModel(doc))
	if err := checkUnmarked(text); err != nil {
		return nil, err
	}
	return []byte(text), nil
}

// isCanonical answers §9.1: a non-UTF-8 text is not a document, a marked text is
// never canonical, otherwise the text is canonical when writing its model gives
// it back byte for byte.
func isCanonical(text []byte) bool {
	lines, err := prepare(text)
	if err != nil {
		return false
	}
	for _, ln := range lines {
		if isMarkerLine(ln) {
			return false
		}
	}
	model, err := Parse(text)
	if err != nil {
		return false
	}
	out, err := writeModel(model)
	if err != nil {
		return false
	}
	return string(out) == string(text)
}
