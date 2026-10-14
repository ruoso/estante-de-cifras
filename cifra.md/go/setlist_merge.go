package cifra

// The merge of setlists (spec §11.13). A port of the reference's
// reference/cifra_md/setlist_merge.py and the JavaScript twin
// js/src/setlist_merge.js — never imported from either: agreement is by the
// corpus, not shared code (DIRECTION §3.6). Merge in merge.go calls
// mergeSetlists with the three canonical texts once whole files, unreadable
// inputs, marked inputs and unchanged sides are dealt with (§11.2 to §11.4): a
// setlist that holds a marker line is never merged, as a song is not.
//
// A setlist merges as a song does, with less in it.

import (
	"sort"
	"strconv"
	"strings"
)

var slVersions = []string{"base", ours, theirs}

// entryIds are the identities of a list of entries: a property by its key, an
// unrecognised entry by its text and occurrence (§11.13).
func entryIds(entries []any) []any {
	var out []any
	seen := newCounter()
	for _, eAny := range entries {
		e := eAny.(*Object)
		if objString(e, "type") == "property" {
			out = append(out, []any{"p", objString(e, "key")})
		} else {
			seen.inc(objString(e, "text"))
			out = append(out, []any{"u", objString(e, "text"), seen.get(objString(e, "text"))})
		}
	}
	return out
}

func entrySort(i any) any {
	id := i.([]any)
	if id[0] == "u" {
		return []any{id[1], id[2]}
	}
	return []any{id[1], 0}
}

// slReference is an item's reference (§11.13): its path, or an unlinked item's
// content.
func slReference(el *Object) any {
	if objString(el, "type") == "song" {
		return []any{"song", objString(el, "path")}
	}
	return []any{"unlinked", objString(el, "content")}
}

// withNotes gives the identities of a body, given those of its items in order:
// a notes block is identified by the item it follows (§11.13).
func withNotes(body []any, itemIds []any) []any {
	var out []any
	idx := 0
	var last any
	for _, elAny := range body {
		el := elAny.(*Object)
		if objString(el, "type") == "notes" {
			out = append(out, []any{"notes", last})
		} else {
			last = itemIds[idx]
			idx++
			out = append(out, last)
		}
	}
	return out
}

// bodyIds are base's identities: each item's reference and its occurrence among
// base's items with that reference.
func bodyIds(body []any) []any {
	seen := newCounter()
	var ids []any
	for _, elAny := range body {
		el := elAny.(*Object)
		if objString(el, "type") != "notes" {
			ref := slReference(el)
			seen.inc(ref)
			r := ref.([]any)
			ids = append(ids, append(append([]any{}, r...), seen.get(ref)))
		}
	}
	return withNotes(body, ids)
}

func itemValue(item *Object) any {
	var lines []any
	for _, e := range orderedEntries(objArray(item, "entries")) {
		lines = append(lines, entryLine(e, 0))
	}
	var text any
	if t, ok := item.Get("text"); ok {
		text = t
	}
	return []any{text, lines}
}

// sideBodyIds are a side's identities, from pairing its items with base's
// (§11.13): an alignment by reference and value, then one by reference within
// each stretch between its pairs, then what is left of each reference in order.
func sideBodyIds(base, side []any) []any {
	var B, S []any
	for _, elAny := range base {
		if objString(elAny.(*Object), "type") != "notes" {
			B = append(B, elAny)
		}
	}
	for _, elAny := range side {
		if objString(elAny.(*Object), "type") != "notes" {
			S = append(S, elAny)
		}
	}
	var bids []any
	for _, i := range bodyIds(base) {
		if i.([]any)[0] != "notes" {
			bids = append(bids, i)
		}
	}
	pair := map[int]int{} // side position -> base position
	exact := func(a, c any) bool {
		ao, co := a.(*Object), c.(*Object)
		return eqv(slReference(ao), slReference(co)) && eqv(itemValue(ao), itemValue(co))
	}
	for i, j := range pairsOf(align(B, S, exact)) {
		pair[j] = i
	}
	var fixed [][2]int
	for j, i := range pair {
		fixed = append(fixed, [2]int{i, j})
	}
	sort.SliceStable(fixed, func(a, b int) bool {
		if fixed[a][0] != fixed[b][0] {
			return fixed[a][0] < fixed[b][0]
		}
		return fixed[a][1] < fixed[b][1]
	})
	bounds := append([][2]int{{-1, -1}}, fixed...)
	bounds = append(bounds, [2]int{len(B), len(S)})
	for bi := 0; bi < len(bounds)-1; bi++ {
		i0, j0 := bounds[bi][0], bounds[bi][1]
		i1, j1 := bounds[bi+1][0], bounds[bi+1][1]
		subB := B[i0+1 : i1]
		subS := S[j0+1 : j1]
		sub := pairsOf(align(subB, subS, func(a, c any) bool { return eqv(slReference(a.(*Object)), slReference(c.(*Object))) }))
		for i, j := range sub {
			pair[j0+1+j] = i0 + 1 + i
		}
	}
	pairedBase := map[int]bool{}
	for _, i := range pair {
		pairedBase[i] = true
	}
	refsSeen := newTSet()
	var refs []any
	for _, elAny := range S {
		r := slReference(elAny.(*Object))
		if !refsSeen.has(r) {
			refsSeen.add(r)
			refs = append(refs, r)
		}
	}
	for _, ref := range refs {
		var left, right []int
		for i, elAny := range B {
			if eqv(slReference(elAny.(*Object)), ref) && !pairedBase[i] {
				left = append(left, i)
			}
		}
		for j, elAny := range S {
			if _, ok := pair[j]; eqv(slReference(elAny.(*Object)), ref) && !ok {
				right = append(right, j)
			}
		}
		n := len(left)
		if len(right) < n {
			n = len(right)
		}
		for k := 0; k < n; k++ {
			pair[right[k]] = left[k]
		}
	}
	count := newCounter()
	for _, elAny := range B {
		count.inc(slReference(elAny.(*Object)))
	}
	neu := newCounter()
	var ids []any
	for j, elAny := range S {
		if bi, ok := pair[j]; ok {
			ids = append(ids, bids[bi])
		} else {
			ref := slReference(elAny.(*Object))
			neu.inc(ref)
			r := ref.([]any)
			ids = append(ids, append(append([]any{}, r...), count.get(ref)+neu.get(ref)))
		}
	}
	return withNotes(side, ids)
}

func itemName(i any) any {
	id := i.([]any)
	if id[0] == "song" {
		return writePath(id[1].(string))
	}
	return id[1]
}

func itemString(item *Object) string {
	lines := []string{itemContent(item)}
	for _, e := range orderedEntries(objArray(item, "entries")) {
		lines = append(lines, entryLine(e, 0))
	}
	return strings.Join(lines, "\n")
}

// entryMerge is a keyed list of entries (§11.13): the setlist's own, or an
// item's.
type entryMerge struct {
	value    *tmap
	conflict *tmap
	inResult *tset
	order    []any
}

func newEntryMerge(versions map[string][]any, has map[string]bool, kind string, conflicts *[]map[string]any, extra map[string]any) *entryMerge {
	ids := map[string][]any{}
	by := map[string]*tmap{}
	values := map[string]*tmap{}
	for _, k := range slVersions {
		by[k] = newTMap()
		values[k] = newTMap()
		if has[k] {
			v := versions[k]
			ids[k] = entryIds(v)
			for n, i := range ids[k] {
				e := v[n].(*Object)
				by[k].set(i, e)
				if objString(e, "type") == "property" {
					var val any
					if vv, ok := e.Get("value"); ok {
						val = vv
					}
					values[k].set(i, val)
				} else {
					values[k].set(i, true)
				}
			}
		} else {
			ids[k] = nil
		}
	}
	em := &entryMerge{value: newTMap(), conflict: newTMap(), inResult: newTSet()}
	allIds := newTSet()
	for _, k := range slVersions {
		for _, i := range ids[k] {
			allIds.add(i)
		}
	}
	for _, i := range allIds.values() {
		a := tmapGetOrNil(values["base"], i)
		x := tmapGetOrNil(values[ours], i)
		y := tmapGetOrNil(values[theirs], i)
		var val any
		if a == nil || (x != nil && y != nil) {
			em.inResult.add(i)
			val = mergeValue(a, x, y)
		} else if x == nil && y == nil {
			continue
		} else {
			var kept any = x
			if x == nil {
				kept = y
			}
			if eqv(kept, a) {
				continue
			}
			em.inResult.add(i)
			val = confl
		}
		em.value.set(i, val)
		if isConflict(val) {
			c := map[string]any{"kind": kind, "key": i.([]any)[1], "base": a, ours: x, theirs: y}
			for ek, ev := range extra {
				c[ek] = ev
			}
			if kind == "property" {
				delete(c, "item")
			}
			em.conflict.set(i, c)
			*conflicts = append(*conflicts, c)
		}
	}
	em.order = keyedOrder(ids["base"], ids[ours], ids[theirs], em.inResult, entrySort)
	return em
}

func tmapGetOrNil(t *tmap, k any) any {
	if v, ok := t.get(k); ok {
		return v
	}
	return nil
}

func (em *entryMerge) entries() []any {
	var out []any
	for _, i := range em.order {
		id := i.([]any)
		o := NewObject()
		if id[0] == "p" {
			o.Set("type", "property")
			o.Set("key", id[1])
			v, _ := em.value.get(i)
			o.Set("value", v)
		} else {
			o.Set("type", "unrecognised")
			o.Set("text", id[1])
		}
		out = append(out, o)
	}
	return out
}

// lines returns the entry lines, with a region (holding a marker) for each
// conflict (§11.13), as a []any so finishMarked can number the markers.
func (em *entryMerge) lines(indent int, item bool) []any {
	order := em.order
	if item {
		var first []any
		firstSet := newTSet()
		for _, k := range []string{"key", "note"} {
			for _, i := range order {
				if eqv(i, []any{"p", k}) {
					first = append(first, i)
					firstSet.add(i)
				}
			}
		}
		var rest []any
		for _, i := range order {
			if !firstSet.has(i) {
				rest = append(rest, i)
			}
		}
		order = append(append([]any{}, first...), rest...)
	}
	var out []any
	for _, i := range order {
		id := i.([]any)
		if cAny, ok := em.conflict.get(i); ok {
			c := cAny.(map[string]any)
			side := func(v any) []string {
				if v == nil {
					return nil
				}
				e := NewObject()
				e.Set("type", "property")
				e.Set("key", id[1])
				e.Set("value", v)
				return []string{entryLine(e, indent)}
			}
			out = append(out, region(c, side(c[ours]), side(c[theirs]))...)
		} else if id[0] == "p" {
			e := NewObject()
			e.Set("type", "property")
			e.Set("key", id[1])
			v, _ := em.value.get(i)
			e.Set("value", v)
			out = append(out, entryLine(e, indent))
		} else {
			e := NewObject()
			e.Set("type", "unrecognised")
			e.Set("text", id[1])
			out = append(out, entryLine(e, indent))
		}
	}
	return out
}

type setlistMerge struct {
	m         map[string]*Object
	conflicts []map[string]any

	title         any
	titleConflict map[string]any
	props         *entryMerge
	by            map[string]*tmap
	inResult      *tset
	presence      *tmap
	order         []any
	items         *tmap
}

func mergeSetlists(b, o, t string) Outcome {
	sm := &setlistMerge{m: map[string]*Object{}}
	sm.m["base"], _ = ParseSetlist([]byte(b))
	sm.m[ours], _ = ParseSetlist([]byte(o))
	sm.m[theirs], _ = ParseSetlist([]byte(t))
	return sm.run()
}

func (sm *setlistMerge) run() Outcome {
	m := sm.m
	bt, _ := m["base"].Get("title")
	ot, _ := m[ours].Get("title")
	tt, _ := m[theirs].Get("title")
	sm.title = mergeValue(bt, ot, tt)
	sm.titleConflict = nil
	if isConflict(sm.title) {
		sm.titleConflict = map[string]any{"kind": "title", "base": bt, ours: ot, theirs: tt}
		sm.conflicts = append(sm.conflicts, sm.titleConflict)
	}
	propsV := map[string][]any{}
	propsHas := map[string]bool{}
	for _, k := range slVersions {
		propsV[k] = objArray(m[k], "properties")
		propsHas[k] = true
	}
	sm.props = newEntryMerge(propsV, propsHas, "property", &sm.conflicts, map[string]any{})
	ids := map[string][]any{"base": bodyIds(objArray(m["base"], "body"))}
	for _, k := range sides {
		ids[k] = sideBodyIds(objArray(m["base"], "body"), objArray(m[k], "body"))
	}
	sm.by = map[string]*tmap{}
	for _, k := range slVersions {
		sm.by[k] = newTMap()
		body := objArray(m[k], "body")
		for n, i := range ids[k] {
			sm.by[k].set(i, body[n])
		}
	}

	value := func(elAny any) any {
		if elAny == nil {
			return nil
		}
		el := elAny.(*Object)
		if objString(el, "type") == "notes" {
			return append([]any{}, objArray(el, "lines")...)
		}
		return itemValue(el)
	}

	sm.inResult = newTSet()
	sm.presence = newTMap()
	allIds := newTSet()
	for _, k := range slVersions {
		for _, i := range ids[k] {
			allIds.add(i)
		}
	}
	for _, i := range allIds.values() {
		a := value(tmapGetOrNil(sm.by["base"], i))
		x := value(tmapGetOrNil(sm.by[ours], i))
		y := value(tmapGetOrNil(sm.by[theirs], i))
		if a == nil || (x != nil && y != nil) {
			sm.inResult.add(i)
		} else if x == nil && y == nil {
			continue
		} else {
			var kept any = x
			if x == nil {
				kept = y
			}
			if !eqv(kept, a) {
				sm.inResult.add(i)
				if x == nil {
					sm.presence.set(i, ours)
				} else {
					sm.presence.set(i, theirs)
				}
			}
		}
	}
	sm.order = keyedOrder(ids["base"], ids[ours], ids[theirs], sm.inResult, func(i any) any { return sm.sortKey(i) })
	sm.items = newTMap()
	for _, i := range sm.order {
		id := i.([]any)
		vers := map[string]*Object{}
		for _, k := range slVersions {
			if v, ok := sm.by[k].get(i); ok {
				vers[k] = v.(*Object)
			} else {
				vers[k] = nil
			}
		}
		if sm.presence.has(i) {
			kind := "item"
			if id[0] == "notes" {
				kind = "notes"
			}
			c := map[string]any{"kind": kind}
			for ek, ev := range sm.identityMembers(i) {
				c[ek] = ev
			}
			for _, k := range slVersions {
				if vers[k] != nil {
					if id[0] == "notes" {
						c[k] = strings.Join(anyStrs(objArray(vers[k], "lines")), "\n")
					} else {
						c[k] = itemString(vers[k])
					}
				}
			}
			sm.conflicts = append(sm.conflicts, c)
			sm.items.set(i, []any{"conflict", c})
			continue
		}
		if id[0] == "notes" {
			lines := mergeValue(
				notesVal(vers["base"]),
				notesVal(vers[ours]),
				notesVal(vers[theirs]),
			)
			if isConflict(lines) {
				c := map[string]any{"kind": "notes"}
				for ek, ev := range sm.identityMembers(i) {
					c[ek] = ev
				}
				for _, k := range slVersions {
					if vers[k] != nil {
						c[k] = strings.Join(anyStrs(objArray(vers[k], "lines")), "\n")
					}
				}
				sm.conflicts = append(sm.conflicts, c)
				sm.items.set(i, []any{"conflict", c})
			} else {
				sm.items.set(i, []any{"notes", lines})
			}
			continue
		}
		extra := sm.identityMembers(i)
		var text any
		var textConflict map[string]any
		if id[0] == "song" {
			text = mergeValue(textVal(vers["base"]), textVal(vers[ours]), textVal(vers[theirs]))
			if isConflict(text) {
				textConflict = map[string]any{"kind": "text"}
				for ek, ev := range extra {
					textConflict[ek] = ev
				}
				for _, k := range slVersions {
					if vers[k] != nil {
						textConflict[k] = objString(vers[k], "text")
					}
				}
				sm.conflicts = append(sm.conflicts, textConflict)
			}
		}
		entriesV := map[string][]any{}
		entriesHas := map[string]bool{}
		for _, k := range slVersions {
			if vers[k] != nil {
				entriesV[k] = objArray(vers[k], "entries")
				entriesHas[k] = true
			} else {
				entriesHas[k] = false
			}
		}
		entries := newEntryMerge(entriesV, entriesHas, "entry", &sm.conflicts, extra)
		sm.items.set(i, []any{"item", text, textConflict, entries})
	}
	if len(sm.conflicts) == 0 {
		res := sm.result()
		return Outcome{Result: &res}
	}
	mk := sm.marked()
	return Outcome{Conflicts: sm.conflicts, Marked: &mk}
}

func notesVal(el *Object) any {
	if el == nil {
		return nil
	}
	return append([]any{}, objArray(el, "lines")...)
}

func textVal(el *Object) any {
	if el == nil {
		return nil
	}
	if t, ok := el.Get("text"); ok {
		return t
	}
	return nil
}

func anyStrs(xs []any) []string {
	out := make([]string, len(xs))
	for i, x := range xs {
		out[i], _ = x.(string)
	}
	return out
}

func (sm *setlistMerge) identityMembers(i any) map[string]any {
	id := i.([]any)
	if id[0] == "notes" {
		after := id[1]
		if after == nil {
			return map[string]any{}
		}
		aid := after.([]any)
		out := map[string]any{"after": itemName(after)}
		if aid[2].(int) > 1 {
			out["occurrence"] = aid[2]
		}
		return out
	}
	out := map[string]any{"item": itemName(i)}
	if id[2].(int) > 1 {
		out["occurrence"] = id[2]
	}
	return out
}

func (sm *setlistMerge) sortKey(i any) []any {
	id := i.([]any)
	if id[0] == "notes" {
		var firsts []string
		for _, k := range slVersions {
			if el, ok := sm.by[k].get(i); ok {
				firsts = append(firsts, objArray(el.(*Object), "lines")[0].(string))
			}
		}
		sort.SliceStable(firsts, func(a, b int) bool { return cmpCodePoints(firsts[a], firsts[b]) < 0 })
		first := firsts[0]
		after := id[1]
		if after == nil {
			return []any{first, 1, 0, "", 0}
		}
		return []any{first, 1, 1, sm.sortKey(after)[0], after.([]any)[2]}
	}
	var lines []string
	for _, k := range slVersions {
		if el, ok := sm.by[k].get(i); ok {
			lines = append(lines, itemContent(el.(*Object)))
		}
	}
	sort.SliceStable(lines, func(a, b int) bool { return cmpCodePoints(lines[a], lines[b]) < 0 })
	return []any{lines[0], 0, id[2], "", 0}
}

func (sm *setlistMerge) resultModel() *Object {
	body := []any{}
	n := 0
	for _, i := range sm.order {
		id := i.([]any)
		kindAny, _ := sm.items.get(i)
		kind := kindAny.([]any)
		if kind[0] == "notes" {
			o := NewObject()
			o.Set("type", "notes")
			o.Set("lines", kind[1])
			body = append(body, o)
			continue
		}
		n++
		text := kind[1]
		entries := kind[3].(*entryMerge)
		o := NewObject()
		if id[0] == "song" {
			o.Set("type", "song")
			o.Set("number", n)
			o.Set("text", text)
			o.Set("path", id[1])
			o.Set("entries", entries.entries())
		} else {
			o.Set("type", "unlinked")
			o.Set("number", n)
			o.Set("content", id[1])
			o.Set("entries", entries.entries())
		}
		body = append(body, o)
	}
	m := NewObject()
	m.Set("title", sm.title)
	m.Set("properties", sm.props.entries())
	m.Set("body", body)
	m.Set("diagnostics", []any{})
	return m
}

func (sm *setlistMerge) result() string {
	out, _ := WriteSetlist(sm.resultModel())
	return canonicaliseSetlistText(string(out))
}

func (sm *setlistMerge) marked() string {
	var parts [][]any
	var meta []any
	if sm.titleConflict != nil {
		c := sm.titleConflict
		var ol, tl []string
		if s, ok := c[ours].(string); ok && s != "" {
			ol = []string{"# " + s}
		}
		if s, ok := c[theirs].(string); ok && s != "" {
			tl = []string{"# " + s}
		}
		meta = append(meta, region(c, ol, tl)...)
	} else if s, ok := sm.title.(string); ok && s != "" {
		meta = append(meta, "# "+s)
	}
	for _, l := range sm.props.lines(0, false) {
		meta = append(meta, l)
	}
	if len(meta) > 0 {
		parts = append(parts, meta)
	}
	var run []any
	runOpen := false
	n := 0

	sideItem := func(k string, i any, number int) []string {
		elAny, ok := sm.by[k].get(i)
		if !ok {
			return nil
		}
		el := elAny.(*Object)
		content := itemContent(el)
		indent := len(strconv.Itoa(number)) + 2
		head := strconv.Itoa(number) + "."
		if content != "" {
			head += " " + content
		}
		out := []string{head}
		for _, e := range orderedEntries(objArray(el, "entries")) {
			out = append(out, entryLine(e, indent))
		}
		return out
	}

	for _, i := range sm.order {
		id := i.([]any)
		kindAny, _ := sm.items.get(i)
		kind := kindAny.([]any)
		if id[0] == "notes" {
			if runOpen {
				parts = append(parts, run)
				run = nil
				runOpen = false
			}
			if kind[0] == "conflict" {
				c := kind[1].(map[string]any)
				side := func(k string) []string {
					if el, ok := sm.by[k].get(i); ok {
						return anyStrs(objArray(el.(*Object), "lines"))
					}
					return nil
				}
				parts = append(parts, region(c, side(ours), side(theirs)))
			} else {
				parts = append(parts, append([]any{}, linesToAny(kind[1])...))
			}
			continue
		}
		if !runOpen {
			run = nil
			runOpen = true
		}
		if kind[0] == "conflict" {
			c := kind[1].(map[string]any)
			ol := sideItem(ours, i, n+1)
			tl := sideItem(theirs, i, n+1)
			run = append(run, region(c, ol, tl)...)
			inc := 0
			if len(ol) > 0 {
				inc = 1
			}
			if len(tl) > 0 && 1 > inc {
				inc = 1
			}
			n += inc
			continue
		}
		n++
		text := kind[1]
		textConflict, _ := kind[2].(map[string]any)
		entries := kind[3].(*entryMerge)
		indent := len(strconv.Itoa(n)) + 2
		head := func(tx any) string {
			var content string
			if id[0] == "song" {
				it := NewObject()
				it.Set("type", "song")
				it.Set("text", tx)
				it.Set("path", id[1])
				content = itemContent(it)
			} else {
				content = id[1].(string)
			}
			h := strconv.Itoa(n) + "."
			if content != "" {
				h += " " + content
			}
			return h
		}
		if textConflict != nil {
			run = append(run, region(textConflict, []string{head(textConflict[ours])}, []string{head(textConflict[theirs])})...)
		} else {
			run = append(run, head(text))
		}
		for _, l := range entries.lines(indent, true) {
			run = append(run, l)
		}
	}
	if runOpen {
		parts = append(parts, run)
	}
	return finishMarked(parts, sm.conflicts)
}

func linesToAny(v any) []any {
	if arr, ok := v.([]any); ok {
		return arr
	}
	return nil
}
