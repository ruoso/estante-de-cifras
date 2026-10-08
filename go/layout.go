package cifra

// The layout of sung lines (spec §4.5, §8.4.4). A faithful port of the
// reference's reference/cifra_md/layout.py — never imported from it: agreement is
// by the corpus, not shared code (DIRECTION §3.6). Only the reader's needs are
// here: converge lays a sung line out once (a single deterministic left-to-right
// pass, with at most one guard re-run), so the model holds the columns and words
// of the canonical form (§4.5.3). The §8 printers (chord_text, lyric_text,
// sung_text) belong to cifra_go.writer.

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const padRune = '_'

var padRunRE = regexp.MustCompile(`_+`)

// tok is one bar, anchor, item or guard token of a chord line, in writing order.
type tok struct {
	kind      string // "bar", "anchor", "item", "guard"
	bar       string // "|" or "||" for a bar token
	closeM    *Object
	openM     *Object
	measure   *Object
	item      *Object
	text      string
	at        int
	afterOpen bool
}

func itemText(it *Object) string {
	switch objString(it, "type") {
	case "chord":
		return objString(it, "key")
	case "repeat":
		return "%"
	case "nochord":
		return "N.C."
	case "beat":
		return objString(it, "mark")
	case "mark":
		if objString(it, "notation") == "bracket" {
			if obool(it, "open") {
				return "("
			}
			return ")"
		}
		return ":"
	case "count":
		t, _ := oint(it, "times")
		return "x" + strconv.Itoa(t)
	case "ending":
		n, _ := oint(it, "number")
		return strconv.Itoa(n) + "."
	case "unknown":
		return objString(it, "text")
	}
	return ""
}

func isOpenBar(it *Object) bool {
	return objString(it, "type") == "mark" && objString(it, "notation") == "barline" && obool(it, "open")
}

func isCloseBar(it *Object) bool {
	return objString(it, "type") == "mark" && objString(it, "notation") == "barline" && !obool(it, "open")
}

func newBarTok(open, close_ *Object) *tok {
	return &tok{kind: "bar", bar: "|", closeM: close_, openM: open}
}

// lineTokens is a chord line as a sequence of bar, anchor and item tokens, in
// writing order (§8.5.4).
func lineTokens(line *Object, sung bool) []*tok {
	toks := []*tok{}
	ms := objArray(line, "measures")
	n := len(ms)
	var pendingClose *Object

	for i, mEl := range ms {
		m := mEl.(*Object)
		var items []*Object
		for _, itEl := range objArray(m, "items") {
			it := itEl.(*Object)
			if objString(it, "type") != "lead" {
				items = append(items, it)
			}
		}
		start := len(toks)
		var anchor *tok
		if m.Has("anchor") {
			av, _ := oint(m, "anchor")
			anchor = &tok{kind: "anchor", text: "@" + strconv.Itoa(av), measure: m}
		}
		if i > 0 {
			toks = append(toks, newBarTok(nil, pendingClose))
			pendingClose = nil
		}
		var subst []int
		for j, it := range items {
			if substantive(it) {
				subst = append(subst, j)
			}
		}
		first := -1
		if len(subst) > 0 {
			first = subst[0]
		}
		for j, it := range items {
			if j == first {
				var bars []*tok
				for _, tt := range toks[start:] {
					if tt.kind == "bar" {
						bars = append(bars, tt)
					}
				}
				if mbar, ok := m.Get("bar"); ok && mbar != nil {
					if len(bars) == 0 {
						toks = append(toks, newBarTok(nil, nil))
						bars = []*tok{toks[len(toks)-1]}
					}
					bars[len(bars)-1].bar = mbar.(string)
					bars[len(bars)-1].measure = m
				}
				if anchor != nil && !sung {
					toks = append(toks, anchor)
				}
			}
			var last *tok
			if len(toks) > start {
				last = toks[len(toks)-1]
			}
			switch {
			case isOpenBar(it):
				if last != nil && last.kind == "bar" && last.openM == nil {
					last.openM = it
				} else {
					toks = append(toks, newBarTok(it, nil))
				}
			case isCloseBar(it):
				if j == len(items)-1 && i+1 < n {
					pendingClose = it
				} else {
					toks = append(toks, newBarTok(nil, it))
				}
			default:
				toks = append(toks, &tok{kind: "item", item: it, text: itemText(it)})
			}
		}
		if anchor != nil && sung && len(subst) > 0 {
			slot := anchorSlot(toks, start, m)
			toks = append(toks, nil)
			copy(toks[slot+1:], toks[slot:])
			toks[slot] = anchor
		}
	}

	if cb, _ := line.Get("closeBar"); cb != nil {
		lastBar := -1
		for x, tt := range toks {
			if tt.kind == "bar" {
				lastBar = x
			}
		}
		reuse := false
		if lastBar != -1 && toks[lastBar].measure == nil {
			anySubstAfter := false
			for _, tt := range toks[lastBar+1:] {
				if tt.kind == "item" && substantive(tt.item) {
					anySubstAfter = true
					break
				}
			}
			reuse = !anySubstAfter
		}
		if reuse {
			toks[lastBar].bar = cb.(string)
		} else {
			nb := newBarTok(nil, nil)
			nb.bar = cb.(string)
			toks = append(toks, nb)
		}
	}
	return toks
}

// anchorSlot is where a sung measure's anchor goes among the measure's tokens
// (§8.4.4 step 5).
func anchorSlot(toks []*tok, start int, m *Object) int {
	var made []int
	for x := start; x < len(toks); x++ {
		if toks[x].kind == "item" && substantive(toks[x].item) {
			made = append(made, x)
		}
	}
	col, hasCol := oint(m, "anchorColumn")
	if !hasCol {
		return made[len(made)-1] + 1
	}
	lo := made[0]
	for lo > start && toks[lo-1].kind != "bar" {
		lo--
	}
	hi := made[len(made)-1] + 1
	for hi < len(toks) && toks[hi].kind != "bar" {
		hi++
	}
	for x := lo; x < hi; x++ {
		if want, ok := desired(toks[x]); ok && want > col {
			return x
		}
	}
	return hi
}

func tokenText(t *tok) string {
	if t.kind == "bar" {
		pre := ""
		if t.closeM != nil {
			pre = ":"
		}
		post := ""
		if t.openM != nil {
			post = ":"
		}
		return pre + t.bar + post
	}
	return t.text
}

// desired is the column a token wants, as written (§4.5).
func desired(t *tok) (int, bool) {
	switch t.kind {
	case "item":
		return oint(t.item, "column")
	case "anchor":
		return oint(t.measure, "anchorColumn")
	case "bar":
		if t.closeM != nil {
			if c, ok := oint(t.closeM, "column"); ok {
				return c, true
			}
		}
		if t.measure != nil {
			if c, ok := oint(t.measure, "column"); ok {
				return c, true
			}
		}
		if t.openM != nil {
			if c, ok := oint(t.openM, "column"); ok {
				v := c - len(t.bar)
				if v < 0 {
					v = 0
				}
				return v, true
			}
		}
	}
	return 0, false
}

func isBracketTok(t *tok, open bool) bool {
	if t.kind != "item" {
		return false
	}
	it := t.item
	return objString(it, "type") == "mark" && objString(it, "notation") == "bracket" && obool(it, "open") == open
}

// mayTouch reports whether two tokens may be written with no space between them
// (§8.4.5).
func mayTouch(prev, t *tok) bool {
	if t.kind == "anchor" {
		return prev.kind == "bar" || isBracketTok(prev, true)
	}
	if prev.kind == "anchor" {
		return t.kind == "bar" || (isBracketTok(t, false) && !prev.afterOpen)
	}
	if prev.kind == "bar" && t.kind == "item" {
		return !strings.HasPrefix(t.text, ":")
	}
	if prev.kind == "item" && t.kind == "bar" {
		return !strings.HasSuffix(prev.text, ":")
	}
	return false
}

// unpad returns the words of a sung line without their padding, and a ref
// function: ref(column) is the index in the words of the character at that
// column (§4.5.2). Everything is in code points (runes).
func unpad(text string) ([]rune, func(int) int) {
	rs := []rune(text)
	pad := make([]bool, len(rs))
	for _, loc := range padRunRE.FindAllStringIndex(text, -1) {
		s := len([]rune(text[:loc[0]]))
		e := len([]rune(text[:loc[1]]))
		if s > 0 && e < len(rs) && rs[s-1] != ' ' && rs[e] != ' ' {
			for k := s; k < e; k++ {
				pad[k] = true
			}
		}
	}
	index := make([]int, len(rs))
	var kept []rune
	for k, ch := range rs {
		index[k] = len(kept)
		if !pad[k] {
			kept = append(kept, ch)
		}
	}
	wlen := len(kept)
	ref := func(column int) int {
		if column < len(rs) {
			return index[column]
		}
		return wlen + column - len(rs)
	}
	return kept, ref
}

// paddingRune is the character that pads before words[at]: `_` inside a word,
// a space otherwise.
func paddingRune(words []rune, at int) rune {
	if at > 0 && at < len(words) && words[at-1] != ' ' && words[at-1] != '_' && words[at] != ' ' && words[at] != '_' {
		return padRune
	}
	return ' '
}

// pushed returns the words with padding inserted, and which columns are `_`
// padding (§4.5.3).
func pushed(words []rune, inserts [][2]int) ([]rune, []bool) {
	var laid []rune
	var mask []bool
	k := 0
	for _, in := range inserts {
		at, nn := in[0], in[1]
		laid = append(laid, words[k:at]...)
		for x := 0; x < at-k; x++ {
			mask = append(mask, false)
		}
		ch := paddingRune(words, at)
		for x := 0; x < nn; x++ {
			laid = append(laid, ch)
			mask = append(mask, ch == padRune)
		}
		k = at
	}
	laid = append(laid, words[k:]...)
	for x := 0; x < len(words)-k; x++ {
		mask = append(mask, false)
	}
	return laid, mask
}

func attachedTok(t *tok) bool {
	return t.kind == "item" && substantive(t.item)
}

// place places the tokens left to right, each in t.at, returning the padding to
// insert into the words as (index, width) pairs (§4.5.3).
func place(toks []*tok, words []rune, ref func(int) int) [][2]int {
	var inserts [][2]int
	total := 0
	end := 0
	var prev *tok
	shift := 0
	floor := -1

	current := func(pp int) int {
		s := pp
		for _, in := range inserts {
			if in[0] <= pp {
				s += in[1]
			}
		}
		return s
	}

	for _, t := range toks {
		var written int
		var hasWritten bool
		if t.kind == "guard" {
			written, hasWritten = 0, true
		} else {
			written, hasWritten = desired(t)
		}
		attached := attachedTok(t) && hasWritten
		var want int
		var hasWant bool
		var p int
		if attached {
			p = ref(written)
			want = current(p)
			hasWant = true
		} else if hasWritten {
			add := shift
			if t.kind == "guard" {
				add = 0
			}
			want = written + add
			hasWant = true
		}

		var at int
		switch {
		case prev == nil:
			if hasWant && want >= 0 {
				at = want
			} else {
				at = 0
			}
		case hasWant && (want > end || (want == end && mayTouch(prev, t))):
			at = want
		default:
			at = end + 1
		}

		if attached {
			var q int
			if at > want && floor < p && p < len(words) {
				inserts = append(inserts, [2]int{p, at - want})
				total += at - want
				q = p
			} else if at == want {
				q = p
			} else {
				q = at - total
			}
			if q > floor {
				floor = q
			}
			shift = at - written
		}
		t.at = at
		if t.kind == "anchor" {
			t.afterOpen = prev != nil && at == end && isBracketTok(prev, true)
		}
		end = at + len([]rune(tokenText(t)))
		prev = t
	}
	return inserts
}

func render(toks []*tok) string {
	var out []rune
	for _, t := range toks {
		for len(out) < t.at {
			out = append(out, ' ')
		}
		out = append(out, []rune(tokenText(t))...)
	}
	return string(out)
}

// misread reports whether a reader would take a chord line for a heading, an
// annotation or words (§8.5.4).
func misread(text, dialect string) bool {
	if bm := bracketHeadingRE.FindStringSubmatch(text); bm != nil && bm[2] != "" && !isDigits(bm[2]) {
		return true
	}
	if lm := labelHeadingRE.FindStringSubmatch(text); lm != nil && lm[2] != "" && isChordRun(lm[3], dialect) {
		return true
	}
	return annotationRE.MatchString(text) || lyricMarkerRE.MatchString(text)
}

func readsAsWords(text, dialect string) bool {
	if misread(text, dialect) {
		return false
	}
	return lineShape(text, dialect).kind == "prose"
}

// converge lays a sung line out (§4.5.3) and records the result in the model.
func converge(line *Object, text, dialect string) {
	text = strings.TrimRight(text, " ")
	for _, mEl := range objArray(line, "measures") {
		m := mEl.(*Object)
		var filtered []any
		for _, itEl := range objArray(m, "items") {
			if objString(itEl.(*Object), "type") != "lead" {
				filtered = append(filtered, itEl)
			}
		}
		m.Set("items", filtered)
	}
	words, ref := unpad(text)
	toks := lineTokens(line, true)
	inserts := place(toks, words, ref)
	if misread(render(toks), dialect) {
		toks = append([]*tok{{kind: "guard", text: ","}}, lineTokens(line, true)...)
		inserts = place(toks, words, ref)
	}
	laid, mask := pushed(words, inserts)
	shift := 0
	if !obool(line, "forced") && !readsAsWords(string(laid), dialect) {
		line.Set("forced", true)
		if !(len(laid) > 0 && laid[0] == ' ') {
			laid = append([]rune{' '}, laid...)
			mask = append([]bool{false}, mask...)
			shift = 1
		}
	}
	for _, t := range toks {
		x := t.at + shift
		switch t.kind {
		case "item":
			t.item.Set("column", x)
		case "bar":
			if t.closeM != nil {
				t.closeM.Set("column", x)
				x++
			}
			if t.measure != nil {
				t.measure.Set("column", x)
			}
			if t.openM != nil {
				t.openM.Set("column", x+len(t.bar))
			}
		case "anchor":
			t.measure.Set("anchorColumn", x)
		}
	}
	divideLine(line, laid, mask)
	for _, mEl := range objArray(line, "measures") {
		reorderObject(mEl.(*Object), "bar", "items", "column", "anchor", "anchorColumn")
	}
}

// divideLine gives each item that makes a measure the words from its column to
// the next such item's (§4.4), and inserts the lead item for words before the
// first (§4.5.3).
func divideLine(line *Object, laid []rune, mask []bool) {
	// segment clamps like Python's laid[a:b] slicing: a token's words can reach
	// past the end of the laid-out line.
	segment := func(a, b int) string {
		if a < 0 {
			a = 0
		}
		if b > len(laid) {
			b = len(laid)
		}
		var out []rune
		for k := a; k < b; k++ {
			if !mask[k] {
				out = append(out, laid[k])
			}
		}
		return string(out)
	}
	var items []*Object
	for _, mEl := range objArray(line, "measures") {
		for _, itEl := range objArray(mEl.(*Object), "items") {
			items = append(items, itEl.(*Object))
		}
	}
	var attached []*Object
	for _, it := range items {
		if substantive(it) {
			attached = append(attached, it)
		}
	}
	sort.SliceStable(attached, func(i, j int) bool {
		a, _ := oint(attached[i], "column")
		b, _ := oint(attached[j], "column")
		return a < b
	})
	for _, it := range items {
		it.Delete("words")
	}
	for k, it := range attached {
		col, _ := oint(it, "column")
		end := len(laid)
		if k+1 < len(attached) {
			end, _ = oint(attached[k+1], "column")
		}
		if col < len(laid) {
			it.Set("words", segment(col, end))
		} else {
			it.Set("words", "")
		}
	}
	leadEnd := len(laid)
	if len(attached) > 0 {
		leadEnd, _ = oint(attached[0], "column")
	}
	lead := segment(0, leadEnd)
	if strings.Trim(lead, " ") != "" {
		leadItem := NewObject()
		leadItem.Set("type", "lead")
		leadItem.Set("column", 0)
		leadItem.Set("words", lead)
		m0 := objArray(line, "measures")[0].(*Object)
		arr := objArray(m0, "items")
		m0.Set("items", append([]any{leadItem}, arr...))
	}
}
