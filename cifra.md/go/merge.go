package cifra

// The three-way merge of songs and setlists (spec §11). A port of the
// reference's reference/cifra_md/merge.py and the JavaScript twin
// js/src/merge.js — never imported from either: agreement with the reference is
// by the corpus, byte for byte, not by shared code (DIRECTION §3.6).
//
// Merge(base, ours, theirs, setlist) is the entry point; each input is bytes, or
// nil when absent. The outcome holds a Result, or Deleted, or Conflicts with,
// unless the only conflict is about the whole file or a marked input, a Marked
// text. ConflictsJSON gives the JSON of §11.12.5, MergeOutputs the corpus file
// map, and ResolveMarked resolves a marked text by one side (§11.12.4).
//
// The merge works on the models Parse/ParseSetlist produce, finishes clean
// results through the §8 writer (serialize + canonicalModel) and writes marked
// text with the §8.4 serialiser without the §8.3 invariants or canonicalisation
// (§11.12.2). It imports only the cifra package and the standard library; it is
// a pure function of three byte slices.

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

// ptrID is a stable per-pointer identity string, the Go stand-in for the
// reference's id() / the JS twin's object ids used to key a unit's variants.
func ptrID(u *unit) string { return fmt.Sprintf("%p", u) }

const (
	ours   = "ours"
	theirs = "theirs"
)

var sides = []string{ours, theirs}

func other(side string) string {
	if side == ours {
		return theirs
	}
	return ours
}

// conflictSentinel is the value a merged value takes when the two sides
// disagree and neither matches base (the reference's CONFLICT singleton).
type conflictSentinel struct{}

var confl = &conflictSentinel{}

func isConflict(v any) bool { _, ok := v.(*conflictSentinel); return ok }

// --- structural helpers (the reference's tuples-as-keys and `==`) -------------
//
// The reference leans on Python tuples as hashable keys, structural `==`, and
// id()-keyed dicts. hkey reproduces JSON.stringify over the merge's value types
// (strings, ints, booleans, null, and slices/objects of these); eqv is
// structural equality through it; cmp is Python's lexicographic comparison.

func hkey(v any) string {
	var b strings.Builder
	hkeyEnc(&b, v)
	return b.String()
}

func hkeyEnc(b *strings.Builder, v any) {
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case string:
		raw, _ := json.Marshal(x)
		b.Write(raw)
	case bool:
		if x {
			b.WriteString("true")
		} else {
			b.WriteString("false")
		}
	case int:
		b.WriteString(strconv.Itoa(x))
	case int64:
		b.WriteString(strconv.FormatInt(x, 10))
	case json.Number:
		b.WriteString(string(x))
	case []any:
		b.WriteByte('[')
		for i, e := range x {
			if i > 0 {
				b.WriteByte(',')
			}
			hkeyEnc(b, e)
		}
		b.WriteByte(']')
	case *Object:
		b.WriteByte('{')
		for i, k := range x.keys {
			if i > 0 {
				b.WriteByte(',')
			}
			raw, _ := json.Marshal(k)
			b.Write(raw)
			b.WriteByte(':')
			hkeyEnc(b, x.vals[k])
		}
		b.WriteByte('}')
	default:
		raw, _ := json.Marshal(x)
		b.Write(raw)
	}
}

func eqv(a, b any) bool { return hkey(a) == hkey(b) }

// cmpCodePoints compares whole code points, not bytes (§8.4.6).
func cmpCodePoints(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	n := len(ra)
	if len(rb) < n {
		n = len(rb)
	}
	for i := 0; i < n; i++ {
		if ra[i] != rb[i] {
			if ra[i] < rb[i] {
				return -1
			}
			return 1
		}
	}
	return len(ra) - len(rb)
}

func toInt(v any) (int, bool) {
	switch n := v.(type) {
	case int:
		return n, true
	case int64:
		return int(n), true
	case json.Number:
		i, err := n.Int64()
		if err != nil {
			return 0, false
		}
		return int(i), true
	}
	return 0, false
}

// cmp is Python's lexicographic comparison: booleans as 0/1, strings by code
// point, arrays element by element, numbers numerically.
func cmp(a, b any) int {
	aa, aArr := a.([]any)
	bb, bArr := b.([]any)
	if aArr && bArr {
		n := len(aa)
		if len(bb) < n {
			n = len(bb)
		}
		for i := 0; i < n; i++ {
			if c := cmp(aa[i], bb[i]); c != 0 {
				return c
			}
		}
		return len(aa) - len(bb)
	}
	na, nb := a, b
	if bv, ok := a.(bool); ok {
		if bv {
			na = 1
		} else {
			na = 0
		}
	}
	if bv, ok := b.(bool); ok {
		if bv {
			nb = 1
		} else {
			nb = 0
		}
	}
	if x, ok := toInt(na); ok {
		if y, ok2 := toInt(nb); ok2 {
			switch {
			case x < y:
				return -1
			case x > y:
				return 1
			default:
				return 0
			}
		}
	}
	if xs, ok := na.(string); ok {
		if ys, ok2 := nb.(string); ok2 {
			return cmpCodePoints(xs, ys)
		}
	}
	if eqv(na, nb) {
		return 0
	}
	return -1
}

func cmpLess(a, b any) bool { return cmp(a, b) < 0 }

// tmap is a map keyed by a structural key, preserving insertion order like a
// Python dict.
type tmap struct {
	order []any
	m     map[string]any
}

func newTMap() *tmap { return &tmap{m: map[string]any{}} }

func (t *tmap) set(k, v any) {
	h := hkey(k)
	if _, ok := t.m[h]; !ok {
		t.order = append(t.order, k)
	}
	t.m[h] = v
}
func (t *tmap) get(k any) (any, bool) { v, ok := t.m[hkey(k)]; return v, ok }
func (t *tmap) has(k any) bool        { _, ok := t.m[hkey(k)]; return ok }
func (t *tmap) setdefault(k, d any) any {
	h := hkey(k)
	if v, ok := t.m[h]; ok {
		return v
	}
	t.order = append(t.order, k)
	t.m[h] = d
	return d
}
func (t *tmap) keys() []any { return t.order }
func (t *tmap) size() int   { return len(t.order) }

// tset is an insertion-ordered set keyed structurally.
type tset struct {
	order []any
	m     map[string]bool
}

func newTSet(items ...any) *tset {
	s := &tset{m: map[string]bool{}}
	for _, it := range items {
		s.add(it)
	}
	return s
}
func (s *tset) add(k any) {
	h := hkey(k)
	if !s.m[h] {
		s.m[h] = true
		s.order = append(s.order, k)
	}
}
func (s *tset) has(k any) bool { return s.m[hkey(k)] }
func (s *tset) values() []any  { return s.order }
func (s *tset) size() int      { return len(s.order) }

// counter counts structural keys.
type counter struct {
	order []any
	m     map[string]int
}

func newCounter(items ...any) *counter {
	c := &counter{m: map[string]int{}}
	for _, it := range items {
		c.inc(it)
	}
	return c
}
func (c *counter) inc(k any) {
	h := hkey(k)
	if _, ok := c.m[h]; !ok {
		c.order = append(c.order, k)
	}
	c.m[h]++
}
func (c *counter) get(k any) int { return c.m[hkey(k)] }
func (c *counter) keys() []any   { return c.order }

// --- the outcome --------------------------------------------------------------

// Outcome is the result of a merge (spec §11.1), mirroring the reference's
// Outcome dataclass. Its fields are exported for the git merge driver, which
// inspects an Outcome to decide its exit code and what to write; the corpus
// harness and MergeOutputs read them through this package.
type Outcome struct {
	Result  *string
	Deleted bool
	// Conflicts holds the conflicts in the order of their regions in the marked
	// text. Each is the reference's conflict dict: "kind" plus the members of
	// §11.12.5 and internal (underscore-prefixed) members the serialiser drops.
	Conflicts []map[string]any
	Marked    *string
	// Kept is what stays unchanged: for an `unresolved` conflict, ours exactly as
	// it was given (bytes, or nil when ours is absent); for a delete-vs-change
	// `file` conflict, the changed side's canonical text. Unused by the outputs.
	Kept any
}

// Kind is "result", "deleted" or "conflicts" (§11.1).
func (o Outcome) Kind() string {
	if o.Result != nil {
		return "result"
	}
	if o.Deleted {
		return "deleted"
	}
	return "conflicts"
}

func strptr(s string) *string { return &s }

// --- values (§11.6) -----------------------------------------------------------

func mergeValue(a, x, y any) any {
	if eqv(x, y) {
		return x
	}
	if eqv(y, a) {
		return x
	}
	if eqv(x, a) {
		return y
	}
	return confl
}

// --- sequences (§11.5) --------------------------------------------------------

// change is one side's change to a sequence (§11.5.2).
type change struct {
	side string
	a, b int
	run  []any
}

func (c *change) insertion() bool { return c.a == c.b }

type step struct {
	kind string // "pair", "drop", "take"
	i, j int    // j is -1 for a drop
}

// align is the alignment of §11.5.1, as steps over the base positions.
func align(A, C []any, match func(a, b any) bool) []step {
	n, m := len(A), len(C)
	M := make([][]bool, n)
	for i := 0; i < n; i++ {
		M[i] = make([]bool, m)
		for j := 0; j < m; j++ {
			M[i][j] = match(A[i], C[j])
		}
	}
	L := make([][]int, n+1)
	for i := 0; i <= n; i++ {
		L[i] = make([]int, m+1)
	}
	for i := n - 1; i >= 0; i-- {
		row, below := L[i], L[i+1]
		for j := m - 1; j >= 0; j-- {
			if M[i][j] {
				row[j] = 1 + below[j+1]
			} else if below[j] >= row[j+1] {
				row[j] = below[j]
			} else {
				row[j] = row[j+1]
			}
		}
	}
	var steps []step
	i, j := 0, 0
	for i < n || j < m {
		if i < n && j < m && M[i][j] {
			steps = append(steps, step{"pair", i, j})
			i++
			j++
		} else if j == m || (i < n && L[i+1][j] >= L[i][j+1]) {
			steps = append(steps, step{"drop", i, -1})
			i++
		} else {
			steps = append(steps, step{"take", i, j})
			j++
		}
	}
	return steps
}

func pairsOf(steps []step) map[int]int {
	m := map[int]int{}
	for _, s := range steps {
		if s.kind == "pair" {
			m[s.i] = s.j
		}
	}
	return m
}

// pairsOfOrdered returns the pairs in step order, for deterministic iteration.
func pairsOfOrdered(steps []step) [][2]int {
	var out [][2]int
	for _, s := range steps {
		if s.kind == "pair" {
			out = append(out, [2]int{s.i, s.j})
		}
	}
	return out
}

func sideChanges(side string, A, C []any, steps []step, otherPairs map[int]int, same func(a, b any) bool) []*change {
	var changes []*change
	start := -1
	var drops []int
	var takes []int
	flush := func() {
		if start == -1 {
			return
		}
		run := make([]any, len(takes))
		for k, j := range takes {
			run[k] = C[j]
		}
		if len(drops) == len(run) && len(run) > 0 {
			for k := 0; k < len(run); k++ {
				changes = append(changes, &change{side, start + k, start + k + 1, []any{run[k]}})
			}
		} else {
			changes = append(changes, &change{side, start, start + len(drops), run})
		}
	}
	for _, s := range steps {
		if s.kind == "pair" {
			flush()
			start, drops, takes = -1, nil, nil
			continue
		}
		if start == -1 {
			start = s.i
		}
		if s.kind == "drop" {
			drops = append(drops, s.i)
		} else {
			takes = append(takes, s.j)
		}
	}
	flush()
	for _, p := range pairsOfOrdered(steps) {
		i, j := p[0], p[1]
		if _, ok := otherPairs[i]; !ok && !same(A[i], C[j]) {
			changes = append(changes, &change{side, i, i + 1, []any{C[j]}})
		}
	}
	sort.SliceStable(changes, func(x, y int) bool {
		if changes[x].a != changes[y].a {
			return changes[x].a < changes[y].a
		}
		return changes[x].b < changes[y].b
	})
	return changes
}

func touch(c, d *change) bool {
	if c.insertion() && d.insertion() {
		return c.a == d.a
	}
	if c.insertion() {
		return d.a < c.a && c.a < d.b
	}
	if d.insertion() {
		return c.a < d.a && d.a < c.b
	}
	return c.a < d.b && d.a < c.b
}

// combine combines two runs (§11.5.4).
func combine(X, Y []any, equal func(a, b any) bool, sortKey, identity func(any) any) []any {
	if len(X) == len(Y) {
		ok := true
		for i := range X {
			if !equal(X[i], Y[i]) {
				ok = false
				break
			}
		}
		if ok {
			return append([]any{}, X...)
		}
	}
	kx := make([]any, len(X))
	for i, x := range X {
		kx[i] = sortKey(x)
	}
	ky := make([]any, len(Y))
	for i, y := range Y {
		ky[i] = sortKey(y)
	}
	first, second := X, Y
	if cmp(toAny(kx), toAny(ky)) > 0 {
		first, second = Y, X
	}
	seen := map[string]bool{}
	out := make([]any, 0, len(first)+len(second))
	for _, e := range first {
		seen[hkey(identity(e))] = true
		out = append(out, e)
	}
	for _, e := range second {
		if !seen[hkey(identity(e))] {
			out = append(out, e)
		}
	}
	return out
}

func toAny(xs []any) any { return xs }

// piece is one element of a merged sequence, mirroring the reference's tuples
// exactly: p1, p2, p3 are pc[1], pc[2], pc[3]:
//
//	both/paired: p1=base, p2=ours, p3=theirs
//	one:         p1=side(string), p2=element
//	common:      p1=ours, p2=theirs
//	combined:    p1=element
//	conflict:    p1=baseRun([]any), p2=oursRun([]any), p3=theirsRun([]any)
type piece struct {
	tag        string
	p1, p2, p3 any
}

type posKey struct {
	side string
	a    int
}

type cluster struct{ members []*change }

func mergeSequence(A, O, T []any, match, same, equal func(a, b any) bool, policy string, pairing bool, sortKey, identity func(any) any) []*piece {
	so := align(A, O, match)
	st := align(A, T, match)
	po := pairsOf(so)
	pt := pairsOf(st)
	co := sideChanges(ours, A, O, so, pt, same)
	ct := sideChanges(theirs, A, T, st, po, same)
	ident := map[*change]*change{}
	for _, c := range co {
		for _, d := range ct {
			if c.a == d.a && c.b == d.b && len(c.run) == len(d.run) {
				okAll := true
				for i := range c.run {
					if !equal(c.run[i], d.run[i]) {
						okAll = false
						break
					}
				}
				if okAll {
					ident[c] = d
					ident[d] = c
				}
			}
		}
	}
	var rest []*change
	for _, c := range append(append([]*change{}, co...), ct...) {
		if _, ok := ident[c]; !ok {
			rest = append(rest, c)
		}
	}
	parent := map[*change]*change{}
	for _, c := range rest {
		parent[c] = c
	}
	var find func(*change) *change
	find = func(c *change) *change {
		for parent[c] != c {
			c = parent[c]
		}
		return c
	}
	for _, c := range rest {
		for _, d := range rest {
			if c.side == ours && d.side == theirs && touch(c, d) {
				rc, rd := find(c), find(d)
				if rc != rd {
					parent[rd] = rc
				}
			}
		}
	}
	groups := map[*change][]*change{}
	var groupRoots []*change
	for _, c := range rest {
		r := find(c)
		if _, ok := groups[r]; !ok {
			groupRoots = append(groupRoots, r)
		}
		groups[r] = append(groups[r], c)
	}
	var clusters []*cluster
	for _, r := range groupRoots {
		if len(groups[r]) >= 2 {
			clusters = append(clusters, &cluster{members: groups[r]})
		}
	}
	member := map[*change]*cluster{}
	for _, cl := range clusters {
		for _, c := range cl.members {
			member[c] = cl
		}
	}
	moved := true
	for moved {
		moved = false
		for _, cl := range clusters {
			if len(cl.members) == 0 {
				continue
			}
			lo, hi := cl.members[0].a, cl.members[0].b
			for _, c := range cl.members {
				if c.a < lo {
					lo = c.a
				}
				if c.b > hi {
					hi = c.b
				}
			}
			for _, c := range rest {
				if c.insertion() && lo < c.a && c.a < hi && member[c] != cl {
					if mc, ok := member[c]; ok {
						for _, e := range mc.members {
							member[e] = cl
						}
						cl.members = append(cl.members, mc.members...)
						mc.members = nil
					} else {
						cl.members = append(cl.members, c)
						member[c] = cl
					}
					moved = true
				}
			}
		}
	}
	var keptClusters []*cluster
	for _, cl := range clusters {
		if len(cl.members) > 0 {
			keptClusters = append(keptClusters, cl)
		}
	}
	clusters = keptClusters
	member = map[*change]*cluster{}
	spans := map[*cluster][2]int{}
	for _, cl := range clusters {
		lo, hi := cl.members[0].a, cl.members[0].b
		for _, c := range cl.members {
			member[c] = cl
			if c.a < lo {
				lo = c.a
			}
			if c.b > hi {
				hi = c.b
			}
		}
		spans[cl] = [2]int{lo, hi}
	}
	emptyAt := map[int]*cluster{}
	startsAt := map[int]*cluster{}
	for _, cl := range clusters {
		sp := spans[cl]
		if sp[0] == sp[1] {
			emptyAt[sp[0]] = cl
		} else {
			startsAt[sp[0]] = cl
		}
	}
	inserts := map[posKey]*change{}
	nonempty := map[posKey]*change{}
	for _, c := range append(append([]*change{}, co...), ct...) {
		if c.insertion() {
			inserts[posKey{c.side, c.a}] = c
		} else {
			nonempty[posKey{c.side, c.a}] = c
		}
	}
	sideData := map[string]struct {
		C     []any
		pairs map[int]int
	}{
		ours:   {O, po},
		theirs: {T, pt},
	}

	sideRun := func(side string, cl *cluster, lo, hi int) []any {
		sd := sideData[side]
		mine := map[int]*change{}
		for _, c := range cl.members {
			if c.side == side && c.insertion() {
				mine[c.a] = c
			}
		}
		var run []any
		p := lo
		for p <= hi {
			if c, ok := mine[p]; ok {
				run = append(run, c.run...)
			}
			if p == hi {
				break
			}
			if c, ok := nonempty[posKey{side, p}]; ok {
				run = append(run, c.run...)
				p = c.b
				continue
			}
			run = append(run, sd.C[sd.pairs[p]])
			p++
		}
		return run
	}

	settle := func(cl *cluster) []*piece {
		sp := spans[cl]
		lo, hi := sp[0], sp[1]
		X := sideRun(ours, cl, lo, hi)
		Y := sideRun(theirs, cl, lo, hi)
		B := A[lo:hi]
		if policy == "combine" {
			var out []*piece
			for _, e := range combine(X, Y, equal, sortKey, identity) {
				out = append(out, &piece{tag: "combined", p1: e})
			}
			return out
		}
		k := 0
		minXY := len(X)
		if len(Y) < minXY {
			minXY = len(Y)
		}
		for k < minXY && equal(X[k], Y[k]) {
			k++
		}
		s := 0
		for s < minXY-k && equal(X[len(X)-1-s], Y[len(Y)-1-s]) {
			s++
		}
		var pre, post []*piece
		for q := 0; q < k; q++ {
			pre = append(pre, &piece{tag: "common", p1: X[q], p2: Y[q]})
		}
		for q := 0; q < s; q++ {
			post = append(post, &piece{tag: "common", p1: X[len(X)-s+q], p2: Y[len(Y)-s+q]})
		}
		Xr := X[k : len(X)-s]
		Yr := Y[k : len(Y)-s]
		var mid []*piece
		if len(Xr) > 0 || len(Yr) > 0 {
			paired := false
			if pairing && len(Xr) == len(Yr) {
				paired = true
				for i := range Xr {
					if !match(Xr[i], Yr[i]) {
						paired = false
						break
					}
				}
			}
			if paired {
				for q := 0; q < len(Xr); q++ {
					var b any
					if len(B) == len(Xr) {
						allB := true
						for r := range B {
							if !(match(B[r], Xr[r]) && match(B[r], Yr[r])) {
								allB = false
								break
							}
						}
						if allB {
							b = B[q]
						}
					}
					mid = append(mid, &piece{tag: "paired", p1: b, p2: Xr[q], p3: Yr[q]})
				}
			} else {
				mid = append(mid, &piece{tag: "conflict", p1: append([]any{}, B...), p2: append([]any{}, Xr...), p3: append([]any{}, Yr...)})
			}
		}
		out := append([]*piece{}, pre...)
		out = append(out, mid...)
		out = append(out, post...)
		return out
	}

	applyC := func(c *change) []*piece {
		if d, ok := ident[c]; ok {
			o, t := c, d
			if c.side != ours {
				o, t = d, c
			}
			var out []*piece
			for i := range o.run {
				out = append(out, &piece{tag: "common", p1: o.run[i], p2: t.run[i]})
			}
			return out
		}
		var out []*piece
		for _, x := range c.run {
			out = append(out, &piece{tag: "one", p1: c.side, p2: x})
		}
		return out
	}

	var pieces []*piece
	n := len(A)
	p := 0
	for {
		if cl, ok := emptyAt[p]; ok {
			pieces = append(pieces, settle(cl)...)
		}
		done := map[*change]bool{}
		for _, side := range sides {
			if c, ok := inserts[posKey{side, p}]; ok {
				if _, inMember := member[c]; !inMember && !done[c] {
					pieces = append(pieces, applyC(c)...)
					done[c] = true
					if d, ok := ident[c]; ok {
						done[d] = true
					}
				}
			}
		}
		if p >= n {
			break
		}
		if cl, ok := startsAt[p]; ok {
			pieces = append(pieces, settle(cl)...)
			p = spans[cl][1]
			continue
		}
		var c *change
		if cc, ok := nonempty[posKey{ours, p}]; ok {
			c = cc
		} else if cc, ok := nonempty[posKey{theirs, p}]; ok {
			c = cc
		}
		if c != nil {
			pieces = append(pieces, applyC(c)...)
			p = c.b
			continue
		}
		pieces = append(pieces, &piece{tag: "both", p1: A[p], p2: O[po[p]], p3: T[pt[p]]})
		p++
	}
	return pieces
}

func containsVal(arr []any, el any) bool {
	h := hkey(el)
	for _, x := range arr {
		if hkey(x) == h {
			return true
		}
	}
	return false
}

func indexOfVal(arr []any, el any) int {
	h := hkey(el)
	for i, x := range arr {
		if hkey(x) == h {
			return i
		}
	}
	return -1
}

// keyedOrder is the order of a keyed list (§11.5.5): identities, in merged
// order.
func keyedOrder(B, O, T []any, inResult *tset, sortKey func(any) any) []any {
	eq := func(x, y any) bool { return eqv(x, y) }
	pieces := mergeSequence(B, O, T, eq, eq, eq, "combine", false, sortKey, func(x any) any { return x })
	var seq []any
	seqSet := map[string]bool{}
	inSet := map[string]bool{}
	var inArr []any
	for _, e := range inResult.values() {
		inSet[hkey(e)] = true
		inArr = append(inArr, e)
	}
	for _, pc := range pieces {
		var el any
		if pc.tag == "both" || pc.tag == "common" || pc.tag == "combined" {
			el = pc.p1
		} else {
			el = pc.p2
		}
		h := hkey(el)
		if inSet[h] && !seqSet[h] {
			seq = append(seq, el)
			seqSet[h] = true
		}
	}
	var remaining []any
	for _, e := range inArr {
		if !seqSet[hkey(e)] {
			remaining = append(remaining, e)
		}
	}
	sort.SliceStable(remaining, func(i, j int) bool { return cmpLess(sortKey(remaining[i]), sortKey(remaining[j])) })
	for _, el := range remaining {
		holder := O
		if !containsVal(O, el) {
			holder = T
		}
		pos := 0
		idx := indexOfVal(holder, el)
		for r := idx - 1; r >= 0; r-- {
			if seqSet[hkey(holder[r])] {
				pos = indexOfVal(seq, holder[r]) + 1
				break
			}
		}
		seq = append(seq, nil)
		copy(seq[pos+1:], seq[pos:])
		seq[pos] = el
		seqSet[hkey(el)] = true
	}
	return seq
}

// --- conflicts (§11.12.5) -----------------------------------------------------

var members = []string{
	"kind", "line", "deleted", "unreadable", "item", "occurrence", "after",
	"tuning", "variation", "key", "changed", "symbols", "base", "ours", "theirs",
}

// conflictObject builds the §11.12.5 object for one conflict: the known members,
// in the fixed order, dropping nil.
func conflictObject(c map[string]any) *Object {
	o := NewObject()
	for _, k := range members {
		if v, ok := c[k]; ok && v != nil {
			o.Set(k, v)
		}
	}
	return o
}

// ConflictsJSON writes the conflicts of an outcome as the §11.12.5 JSON the
// corpus stores: two-space indent, non-ASCII raw, final newline.
func ConflictsJSON(o Outcome) ([]byte, error) {
	root := NewObject()
	arr := []any{}
	for _, c := range o.Conflicts {
		arr = append(arr, conflictObject(c))
	}
	root.Set("conflicts", arr)
	return append(Encode(root), '\n'), nil
}

// conflictsJSONString is ConflictsJSON as a string, for MergeOutputs.
func conflictsJSONString(o Outcome) string {
	b, _ := ConflictsJSON(o)
	return string(b)
}

const markMid = "======="
const markEnd = ">>>>>>> theirs"

// marker is the `<<<<<<< ours` line of a region, carrying its conflict so
// finishMarked can number it once the blocks are assembled.
type marker struct{ conflict map[string]any }

// region returns a region's lines: the marker, ours, the mid, theirs, the end.
func region(conflict map[string]any, oursLines, theirsLines []string) []any {
	out := make([]any, 0, len(oursLines)+len(theirsLines)+3)
	out = append(out, &marker{conflict})
	for _, l := range oursLines {
		out = append(out, l)
	}
	out = append(out, markMid)
	for _, l := range theirsLines {
		out = append(out, l)
	}
	out = append(out, markEnd)
	return out
}

func lineStr(v any) string {
	if _, ok := v.(*marker); ok {
		return "<<<<<<< ours"
	}
	return v.(string)
}

// fenceAny is fenceLines over a line list that may hold markers (§8.4.5),
// preserving the markers so finishMarked can number them.
func fenceAny(lines []any, info string) []any {
	char := byte('`')
	if strings.Contains(info, "`") {
		char = '~'
	}
	longest := 0
	for _, ln := range lines {
		if r := leadingFenceRun(lineStr(ln), char); r > longest {
			longest = r
		}
	}
	n := longest + 1
	if n < 3 {
		n = 3
	}
	mk := strings.Repeat(string(char), n)
	out := make([]any, 0, len(lines)+2)
	out = append(out, mk+info)
	out = append(out, lines...)
	out = append(out, mk)
	return out
}

// finishMarked joins the blocks, numbers each region's first line, orders the
// conflicts.
func finishMarked(blocks [][]any, conflicts []map[string]any) string {
	var lines []any
	for k, b := range blocks {
		if k > 0 {
			lines = append(lines, "")
		}
		lines = append(lines, b...)
	}
	for i, ln := range lines {
		if mk, ok := ln.(*marker); ok {
			mk.conflict["line"] = i + 1
		}
	}
	sort.SliceStable(conflicts, func(i, j int) bool {
		li, _ := toInt(conflicts[i]["line"])
		lj, _ := toInt(conflicts[j]["line"])
		return li < lj
	})
	if len(lines) == 0 {
		return ""
	}
	strs := make([]string, len(lines))
	for i, ln := range lines {
		strs[i] = lineStr(ln)
	}
	return strings.Join(strs, "\n") + "\n"
}

// --- resolving a marked text (§11.12.4) ---------------------------------------

// OpenRegionError refuses a marked text with an open region: a `<<<<<<< ours`
// line not followed by a `=======` and then a `>>>>>>> theirs` line, which has
// no side to take (§11.12.4). Line is the 1-based number of its `<<<<<<< ours`.
type OpenRegionError struct{ Line int }

func (e *OpenRegionError) Error() string {
	return fmt.Sprintf("line %d opens a conflict region that is never closed", e.Line)
}

// markedRegions splits a marked text into plain lines (string) and
// [ours, theirs] regions ([2][]string), refusing the first open region.
func markedRegions(marked string) ([]any, error) {
	var out []any
	lines := strings.Split(marked, "\n")
	indexOf := func(target string, from int) int {
		for i := from; i < len(lines); i++ {
			if lines[i] == target {
				return i
			}
		}
		return -1
	}
	k := 0
	for k < len(lines) {
		if lines[k] == "<<<<<<< ours" {
			m := indexOf(markMid, k)
			e := -1
			if m >= 0 {
				e = indexOf(markEnd, m)
			}
			if e < 0 {
				return nil, &OpenRegionError{Line: k + 1}
			}
			out = append(out, [2][]string{append([]string{}, lines[k+1:m]...), append([]string{}, lines[m+1:e]...)})
			k = e + 1
		} else {
			out = append(out, lines[k])
			k++
		}
	}
	return out, nil
}

// ResolveMarked resolves every region of a marked text by one side (§11.12.4);
// a text with an open region is refused with *OpenRegionError.
func ResolveMarked(marked []byte, side string) ([]byte, error) {
	regions, err := markedRegions(string(marked))
	if err != nil {
		return nil, err
	}
	var out []string
	for _, el := range regions {
		if reg, ok := el.([2][]string); ok {
			if side == ours {
				out = append(out, reg[0]...)
			} else {
				out = append(out, reg[1]...)
			}
		} else {
			out = append(out, el.(string))
		}
	}
	return []byte(strings.Join(out, "\n")), nil
}

// MarkerLines reports the 1-based line numbers of the marker lines of a text,
// after the §1.3 text layer; an empty slice for a non-UTF-8 text or one with no
// marker line (§11.12.3). The corpus harness uses it to spot a marked input.
func MarkerLines(text []byte) []int {
	lines, err := prepare(text)
	if err != nil {
		return nil
	}
	var out []int
	for i, ln := range lines {
		if isMarkerLine(ln) {
			out = append(out, i+1)
		}
	}
	return out
}

// --- whole files (§11.4) and the method (§11.2) -------------------------------

func canonicalSongText(text string) string {
	model, _ := Parse([]byte(text))
	return serialize(canonicalModel(model))
}

func canonicaliseSetlistText(text string) string {
	model, _ := ParseSetlist([]byte(text))
	out, _ := WriteSetlist(model)
	return string(out)
}

// Merge merges three inputs of a song or a setlist (spec §11.2); a nil input is
// an absent side. It never returns an error on a well-formed input; errors from
// the writer or reader are propagated.
func Merge(base, ours_, theirs_ []byte, setlist bool) (Outcome, error) {
	// decode each present input, collecting unreadable (non-UTF-8) sides in order
	type dec struct {
		present bool // the side exists (not absent)
		text    string
		ok      bool // readable (UTF-8)
	}
	raw := []struct {
		name string
		data []byte
	}{{"base", base}, {"ours", ours_}, {"theirs", theirs_}}
	decoded := map[string]dec{}
	var unreadable []any
	for _, r := range raw {
		if r.data == nil {
			decoded[r.name] = dec{present: false, ok: true}
			continue
		}
		if !utf8.Valid(r.data) {
			unreadable = append(unreadable, r.name)
			continue
		}
		decoded[r.name] = dec{present: true, text: string(r.data), ok: true}
	}
	if len(unreadable) > 0 {
		return Outcome{Conflicts: []map[string]any{{"kind": "file", "unreadable": unreadable}}}, nil
	}
	if decoded["base"].present && !decoded["ours"].present && !decoded["theirs"].present {
		return Outcome{Deleted: true}, nil
	}
	// A marked input is never merged (§11.4): ours stays exactly as it is.
	first := map[string]any{}
	hasFirst := false
	for _, name := range []string{"base", "ours", "theirs"} {
		d := decoded[name]
		if !d.present {
			continue
		}
		if ls := MarkerLines([]byte(d.text)); len(ls) > 0 {
			first[name] = ls[0]
			hasFirst = true
		}
	}
	if hasFirst {
		c := map[string]any{"kind": "unresolved"}
		for k, v := range first {
			c[k] = v
		}
		var kept any
		if ours_ != nil {
			kept = ours_
		}
		return Outcome{Conflicts: []map[string]any{c}, Kept: kept}, nil
	}
	canon := canonicalSongText
	if setlist {
		canon = canonicaliseSetlistText
	}
	var bP, oP, tP *string
	if decoded["base"].present {
		bP = strptr(canon(decoded["base"].text))
	}
	if decoded["ours"].present {
		oP = strptr(canon(decoded["ours"].text))
	}
	if decoded["theirs"].present {
		tP = strptr(canon(decoded["theirs"].text))
	}
	var b, o, t string
	if bP == nil {
		if oP == nil && tP == nil {
			return Outcome{Deleted: true}, nil
		}
		if oP == nil {
			return Outcome{Result: tP}, nil
		}
		if tP == nil {
			return Outcome{Result: oP}, nil
		}
		b = ""
	} else {
		if oP == nil && tP == nil {
			return Outcome{Deleted: true}, nil
		}
		if oP == nil {
			if *tP == *bP {
				return Outcome{Deleted: true}, nil
			}
			return Outcome{Conflicts: []map[string]any{{"kind": "file", "deleted": ours}}, Kept: *tP}, nil
		}
		if tP == nil {
			if *oP == *bP {
				return Outcome{Deleted: true}, nil
			}
			return Outcome{Conflicts: []map[string]any{{"kind": "file", "deleted": theirs}}, Kept: *oP}, nil
		}
		b = *bP
	}
	o, t = *oP, *tP
	if o == t {
		return Outcome{Result: strptr(o)}, nil
	}
	if b == o {
		return Outcome{Result: strptr(t)}, nil
	}
	if b == t {
		return Outcome{Result: strptr(o)}, nil
	}
	if setlist {
		return mergeSetlists(b, o, t), nil
	}
	return newSongMerge(b, o, t).run(), nil
}

// MergeOutputs turns a merge Outcome into the files a merge entry stores
// (result, result.deleted, conflicts.json, marked), keyed by file name
// (reference/tools/corpus.py merge_outputs).
func MergeOutputs(o Outcome, setlist bool) (map[string][]byte, error) {
	ext := ".cifra.md"
	if setlist {
		ext = ".setlist.md"
	}
	if o.Result != nil {
		return map[string][]byte{"result" + ext: []byte(*o.Result)}, nil
	}
	if o.Deleted {
		return map[string][]byte{"result.deleted": []byte("")}, nil
	}
	files := map[string][]byte{"conflicts.json": []byte(conflictsJSONString(o))}
	if o.Marked != nil {
		files["marked"+ext] = []byte(*o.Marked)
	}
	return files, nil
}

// --- songs: the pieces of a version -------------------------------------------

func dialectOfProps(props []any) string {
	for _, pEl := range props {
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

// voicingText is a voicing as §8.4.6 writes it after the key, or nil.
func voicingText(e *Object) any {
	if e == nil {
		return nil
	}
	t := formatFrets(objArray(e, "frets"))
	if fv, ok := e.Get("fingers"); ok {
		if arr, isArr := fv.([]any); isArr {
			any_ := false
			for _, f := range arr {
				if f != nil {
					any_ = true
					break
				}
			}
			if any_ {
				t += " (" + formatFingers(arr) + ")"
			}
		}
	}
	return t
}

// vtextEq compares two voicingText results (nil or string).
func vtextEq(a, b any) bool { return eqv(a, b) }

// mostCommon is the key most of a list has, between equal numbers the one with
// the least index; nil if none is a key.
func mostCommon(keys []any) any {
	c := newCounter()
	for _, k := range keys {
		if k != nil {
			c.inc(k)
		}
	}
	ks := c.keys()
	if len(ks) == 0 {
		return nil
	}
	best := ks[0]
	for _, k := range ks {
		if cmp([]any{-c.get(k), keyIdx(k)}, []any{-c.get(best), keyIdx(best)}) < 0 {
			best = k
		}
	}
	return best
}

func keyIdx(k any) int    { return k.([]any)[1].(int) }
func keySym(k any) string { return k.([]any)[0].(string) }

func chordsOf(line *Object) []*Object {
	var out []*Object
	for _, mEl := range objArray(line, "measures") {
		for _, itEl := range objArray(mEl.(*Object), "items") {
			it := itEl.(*Object)
			if objString(it, "type") == "chord" {
				out = append(out, it)
			}
		}
	}
	return out
}

func kt(item *Object) any {
	return []any{objString(item, "symbol"), numVal(mustGet(item, "index"))}
}

func keyText(k any) any {
	if k == nil {
		return nil
	}
	kk := k.([]any)
	return keyFor(kk[0].(string), kk[1].(int))
}

func maskedLine(line *Object) *Object {
	line = deepCopyValue(line).(*Object)
	for _, it := range chordsOf(line) {
		it.Set("index", 1)
		it.Set("key", objString(it, "symbol"))
	}
	return line
}

// unit is a line (or fence) of a section's body (§11.8.1).
type unit struct {
	version string
	kind    []any
	text    string
	masked  string
	line    *Object
	chords  []*Object
}

func unitsOf(section *Object, dialect, version string) []*unit {
	var out []*unit
	for _, pEl := range objArray(section, "body") {
		part := pEl.(*Object)
		switch objString(part, "type") {
		case "notes":
			for _, ln := range strings.Split(objString(part, "text"), "\n") {
				out = append(out, &unit{version: version, kind: []any{"notes"}, text: ln, masked: ln})
			}
		case "verbatim":
			info := objString(part, "info")
			out = append(out, &unit{version: version, kind: []any{"fence", info}, text: "```" + info, masked: "```" + info})
			for _, ln := range strings.Split(objString(part, "text"), "\n") {
				out = append(out, &unit{version: version, kind: []any{"verbatim", info}, text: ln, masked: ln})
			}
		default: // music
			out = append(out, &unit{version: version, kind: []any{"fence", ""}, text: "```", masked: "```"})
			for _, lEl := range objArray(part, "lines") {
				line := lEl.(*Object)
				text := strings.Join(musicLines([]any{line}, dialect), "\n")
				masked := strings.Join(musicLines([]any{maskedLine(line)}, dialect), "\n")
				out = append(out, &unit{version: version, kind: []any{"music", objString(line, "kind")}, text: text, masked: masked, line: line, chords: chordsOf(line)})
			}
		}
	}
	return out
}

// headingOf is a section's heading tuple: (form, name, anchor, times).
func headingOf(section *Object) []any {
	form := "none"
	if hv, ok := section.Get("heading"); ok {
		if s, isStr := hv.(string); isStr && s != "" {
			form = s
		}
	}
	var name any
	if nv, ok := section.Get("name"); ok {
		name = nv
	}
	var anchor any
	if av, ok := section.Get("anchor"); ok && av != nil {
		anchor = av
	}
	var times any
	if tv, ok := section.Get("times"); ok {
		times = tv
	}
	return []any{form, name, anchor, times}
}

var noHeading = []any{nil, nil, nil, nil}

// headingTextLine is a heading's line (§8.4.3), or nil for a section with no
// heading.
func headingTextLine(h []any) any {
	form, _ := h[0].(string)
	name := ""
	if s, ok := h[1].(string); ok {
		name = s
	}
	s := NewObject()
	s.Set("name", name)
	s.Set("anchor", h[2])
	if h[3] != nil {
		s.Set("times", h[3])
	} else {
		s.Set("times", nil)
	}
	switch form {
	case "markdown":
		return headingLine(2, headingName(s))
	case "bracket":
		return "[" + headingName(s) + "]"
	case "label":
		return name + ":"
	}
	return nil
}

// sec is a section with its heading tuple and units.
type sec struct {
	version string
	model   *Object
	heading []any
	units   []*unit
}

func unitMatch(u, v any) bool {
	a, b := u.(*unit), v.(*unit)
	return eqv(a.kind, b.kind) && a.masked == b.masked
}

func secMatch(bb, ss any) bool {
	b, s := bb.(*sec), ss.(*sec)
	if eqv(b.heading, s.heading) {
		return true
	}
	if len(b.units) >= 1 && len(b.units) == len(s.units) {
		for i := range b.units {
			if !unitMatch(b.units[i], s.units[i]) {
				return false
			}
		}
		return true
	}
	return false
}

func secEqual(oo, tt any) bool {
	o, t := oo.(*sec), tt.(*sec)
	if !eqv(o.heading, t.heading) || len(o.units) != len(t.units) {
		return false
	}
	for i := range o.units {
		if !unitMatch(o.units[i], t.units[i]) {
			return false
		}
	}
	return true
}

// version is one parsed input side.
type version struct {
	name      string
	text      string
	doc       *Object
	dialect   string
	props     map[string]string
	propOrder []string
	secs      []*sec
	keys      *tset
	blocks    []any
}

func newVersion(name, text string) *version {
	doc, _ := Parse([]byte(text))
	v := &version{name: name, text: text, doc: doc}
	v.dialect = dialectOfProps(objArray(doc, "properties"))
	v.props = map[string]string{}
	for _, pEl := range objArray(doc, "properties") {
		p := pEl.(*Object)
		k := objString(p, "key")
		v.props[k] = objString(p, "value")
		v.propOrder = append(v.propOrder, k)
	}
	for _, sEl := range objArray(doc, "sections") {
		s := sEl.(*Object)
		v.secs = append(v.secs, &sec{version: name, model: s, heading: headingOf(s), units: unitsOf(s, v.dialect, name)})
	}
	v.keys = newTSet()
	for _, s := range v.secs {
		for _, u := range s.units {
			for _, it := range u.chords {
				v.keys.add(kt(it))
			}
		}
	}
	v.blocks = objArray(doc, "blocks")
	return v
}

// propGet returns a property value or nil (an absent property).
func (v *version) propGet(k string) any {
	if val, ok := v.props[k]; ok {
		return val
	}
	return nil
}

// --- footnote keys (§11.9.2) --------------------------------------------------

type keyMatch struct {
	match *tmap // base key -> side key
	mu    *tmap // side key -> base key
}

func newKeyMatch(baseKeys, sideKeys *tset, corr [][2]any) *keyMatch {
	km := &keyMatch{match: newTMap(), mu: newTMap()}
	counts := newCounter()
	for _, bv := range corr {
		counts.inc([]any{bv[0], bv[1]})
	}
	withOccB := newTSet()
	withOccV := newTSet()
	for _, bv := range corr {
		withOccB.add(bv[0])
		withOccV.add(bv[1])
	}
	symSet := newTSet()
	for _, k := range baseKeys.values() {
		symSet.add(keySym(k))
	}
	for _, k := range sideKeys.values() {
		symSet.add(keySym(k))
	}
	symbols := append([]any{}, symSet.values()...)
	sort.SliceStable(symbols, func(i, j int) bool { return cmpCodePoints(symbols[i].(string), symbols[j].(string)) < 0 })
	for _, symAny := range symbols {
		sym := symAny.(string)
		for {
			var bestCand []any
			var bestB, bestV any
			found := false
			for _, pairAny := range counts.keys() {
				pair := pairAny.([]any)
				b, vv := pair[0], pair[1]
				if keySym(b) != sym || km.match.has(b) || km.mu.has(vv) {
					continue
				}
				n := counts.get(pairAny)
				cand := []any{-n, keyIdx(b) != keyIdx(vv), keyIdx(b), keyIdx(vv)}
				if !found || cmp(cand, bestCand) < 0 {
					bestCand, bestB, bestV, found = cand, b, vv, true
				}
			}
			if !found {
				break
			}
			km.match.set(bestB, bestV)
			km.mu.set(bestV, bestB)
		}
		idxSet := newTSet()
		for _, k := range baseKeys.values() {
			if keySym(k) == sym {
				idxSet.add(keyIdx(k))
			}
		}
		for _, k := range sideKeys.values() {
			if keySym(k) == sym {
				idxSet.add(keyIdx(k))
			}
		}
		indices := append([]any{}, idxSet.values()...)
		sort.SliceStable(indices, func(i, j int) bool { return indices[i].(int) < indices[j].(int) })
		for _, iAny := range indices {
			k := []any{sym, iAny.(int)}
			if baseKeys.has(k) && sideKeys.has(k) && !km.match.has(k) && !km.mu.has(k) && !withOccB.has(k) && !withOccV.has(k) {
				km.match.set(k, k)
				km.mu.set(k, k)
			}
		}
	}
	return km
}

func (km *keyMatch) matchGet(k any) any {
	if v, ok := km.match.get(k); ok {
		return v
	}
	return nil
}
func (km *keyMatch) muGet(k any) any {
	if v, ok := km.mu.get(k); ok {
		return v
	}
	return nil
}

// --- the song merge -----------------------------------------------------------

type songMerge struct {
	v         map[string]*version
	conflicts []map[string]any
	km        map[string]*keyMatch
	joined    map[string]*tmap

	title         any
	titleConflict map[string]any
	propIn        *tset
	propValue     *tmap
	propConflict  *tmap

	chart       []map[string]any
	unitVars    map[string][]any
	vsig        *tmap
	vindex      *tmap
	fixed       *tmap
	variants    []any
	reading     map[string]map[string]any
	sectionsOut []any // ["section", *Object] or ["region", conflict, oursModels, theirsModels]

	// voicings
	blk           map[string]*tmap
	rename        map[string]*tmap
	weak          func(side string, i, varr any) bool
	voicing       func(ver string, block *Object, varr any, baseBlock *Object) *Object
	blockIn       *tset
	blockConflict *tmap
	bname         *tmap
	bspell        *tmap
	bvoicings     *tmap
	bnotes        *tmap
}

func newSongMerge(b, o, t string) *songMerge {
	return &songMerge{
		v: map[string]*version{
			"base": newVersion("base", b),
			ours:   newVersion(ours, o),
			theirs: newVersion(theirs, t),
		},
	}
}

func (sm *songMerge) unitSame(bb, ss any) bool {
	b, s := bb.(*unit), ss.(*unit)
	if !unitMatch(b, s) {
		return false
	}
	km := sm.km[s.version]
	for i := range b.chords {
		if !eqv(km.matchGet(kt(b.chords[i])), kt(s.chords[i])) {
			return false
		}
	}
	return true
}

func (sm *songMerge) secSame(bb, ss any) bool {
	b, s := bb.(*sec), ss.(*sec)
	if !eqv(b.heading, s.heading) || len(b.units) != len(s.units) {
		return false
	}
	for i := range b.units {
		if !sm.unitSame(b.units[i], s.units[i]) {
			return false
		}
	}
	return true
}

func (sm *songMerge) run() Outcome {
	B := sm.v["base"]
	sm.km = map[string]*keyMatch{}
	sm.joined = map[string]*tmap{}
	for _, side := range sides {
		V := sm.v[side]
		var corr [][2]any
		bsecs := make([]any, len(B.secs))
		for i, s := range B.secs {
			bsecs[i] = s
		}
		vsecs := make([]any, len(V.secs))
		for i, s := range V.secs {
			vsecs[i] = s
		}
		for i, j := range pairsOf(align(bsecs, vsecs, secMatch)) {
			bu := B.secs[i].units
			vu := V.secs[j].units
			buAny := make([]any, len(bu))
			for x, u := range bu {
				buAny[x] = u
			}
			vuAny := make([]any, len(vu))
			for x, u := range vu {
				vuAny[x] = u
			}
			for p, q := range pairsOf(align(buAny, vuAny, unitMatch)) {
				bch := bu[p].chords
				vch := vu[q].chords
				n := len(bch)
				if len(vch) < n {
					n = len(vch)
				}
				for x := 0; x < n; x++ {
					corr = append(corr, [2]any{kt(bch[x]), kt(vch[x])})
				}
			}
		}
		km := newKeyMatch(B.keys, V.keys, corr)
		sm.km[side] = km
		dests := newTMap()
		for _, bv := range corr {
			s := dests.setdefault(bv[0], newTSet()).(*tset)
			s.add(km.muGet(bv[1]))
		}
		joined := newTMap()
		sm.joined[side] = joined
		for _, bAny := range dests.keys() {
			dAny, _ := dests.get(bAny)
			d := dAny.(*tset)
			if !km.match.has(bAny) && d.size() == 1 && !d.has(nil) && !d.has(bAny) {
				joined.set(bAny, d.values()[0])
			}
		}
	}

	sm.mergeMetadata()
	sm.mergeChart()
	sm.assignVariants()
	sm.readingConflicts()
	sm.mergeBlocks()
	sm.sectionsOut = sm.mergedSections()
	if len(sm.conflicts) == 0 {
		res := sm.result()
		return Outcome{Result: &res}
	}
	marked := sm.marked()
	return Outcome{Conflicts: sm.conflicts, Marked: &marked}
}

// --- metadata (§11.7) ---
func (sm *songMerge) mergeMetadata() {
	B, O, T := sm.v["base"], sm.v[ours], sm.v[theirs]
	bt, _ := B.doc.Get("title")
	ot, _ := O.doc.Get("title")
	tt, _ := T.doc.Get("title")
	sm.title = mergeValue(bt, ot, tt)
	sm.titleConflict = nil
	if isConflict(sm.title) {
		sm.titleConflict = map[string]any{"kind": "title", "base": bt, "ours": ot, "theirs": tt}
		sm.conflicts = append(sm.conflicts, sm.titleConflict)
	}
	keySet := newTSet()
	for _, k := range B.propOrder {
		keySet.add(k)
	}
	for _, k := range O.propOrder {
		keySet.add(k)
	}
	for _, k := range T.propOrder {
		keySet.add(k)
	}
	sm.propIn = newTSet()
	sm.propValue = newTMap()
	sm.propConflict = newTMap()
	for _, kAny := range keySet.values() {
		k := kAny.(string)
		a := B.propGet(k)
		x := O.propGet(k)
		y := T.propGet(k)
		if a == nil || (x != nil && y != nil) {
			sm.propIn.add(k)
			val := mergeValue(a, x, y)
			if isConflict(val) {
				sm.propConflict.set(k, map[string]any{"kind": "property", "key": k, "base": a, "ours": x, "theirs": y})
			}
			sm.propValue.set(k, val)
		} else if x == nil && y == nil {
			continue
		} else {
			var kept any = x
			if x == nil {
				kept = y
			}
			if !eqv(kept, a) {
				sm.propIn.add(k)
				sm.propValue.set(k, confl)
				sm.propConflict.set(k, map[string]any{"kind": "property", "key": k, "base": a, "ours": x, "theirs": y})
			}
		}
	}
}

func (sm *songMerge) propertyOrder() []any {
	B, O, T := sm.v["base"], sm.v[ours], sm.v[theirs]
	bo := strsToAny(B.propOrder)
	oo := strsToAny(O.propOrder)
	to := strsToAny(T.propOrder)
	return keyedOrder(bo, oo, to, sm.propIn, func(k any) any { return k })
}

func strsToAny(xs []string) []any {
	out := make([]any, len(xs))
	for i, x := range xs {
		out[i] = x
	}
	return out
}

// --- the chart (§11.8) ---
func (sm *songMerge) mergeChart() {
	B, O, T := sm.v["base"], sm.v[ours], sm.v[theirs]
	bsecs := secsToAny(B.secs)
	osecs := secsToAny(O.secs)
	tsecs := secsToAny(T.secs)
	pieces := mergeSequence(bsecs, osecs, tsecs, secMatch, sm.secSame, secEqual, "conflict", true, nil, nil)
	sm.chart = nil
	for _, pc := range pieces {
		switch pc.tag {
		case "both", "paired":
			var bsec *sec
			if pc.p1 != nil {
				bsec = pc.p1.(*sec)
			}
			sm.chart = append(sm.chart, sm.mergeSection(bsec, pc.p2.(*sec), pc.p3.(*sec)))
		case "one":
			side := pc.p1.(string)
			s := pc.p2.(*sec)
			body := make([]*piece, len(s.units))
			for i, u := range s.units {
				body[i] = &piece{tag: "one", p1: side, p2: u}
			}
			sm.chart = append(sm.chart, map[string]any{"type": "section", "base": nil, "heading": s.heading, "hconflict": nil,
				"sides": map[string]any{side: s.heading}, "body": body})
		case "common":
			o := pc.p1.(*sec)
			t := pc.p2.(*sec)
			body := make([]*piece, len(o.units))
			for i := range o.units {
				body[i] = &piece{tag: "common", p1: o.units[i], p2: t.units[i]}
			}
			sm.chart = append(sm.chart, map[string]any{"type": "section", "base": nil, "heading": o.heading, "hconflict": nil,
				"sides": map[string]any{}, "body": body})
		default: // conflict
			sm.chart = append(sm.chart, map[string]any{"type": "conflict", "base": pc.p1, ours: pc.p2, theirs: pc.p3})
		}
	}
}

func secsToAny(secs []*sec) []any {
	out := make([]any, len(secs))
	for i, s := range secs {
		out[i] = s
	}
	return out
}

func unitsToAny(us []*unit) []any {
	out := make([]any, len(us))
	for i, u := range us {
		out[i] = u
	}
	return out
}

func (sm *songMerge) mergeSection(b *sec, o, t *sec) map[string]any {
	bh := noHeading
	if b != nil {
		bh = b.heading
	}
	fields := make([]any, 4)
	for k := 0; k < 4; k++ {
		fields[k] = mergeValue(bh[k], o.heading[k], t.heading[k])
	}
	var hconflict map[string]any
	anyConflict := false
	for _, f := range fields {
		if isConflict(f) {
			anyConflict = true
		}
	}
	if anyConflict {
		sideHeading := func(s *sec) []any {
			out := make([]any, 4)
			for k := 0; k < 4; k++ {
				if isConflict(fields[k]) {
					out[k] = s.heading[k]
				} else {
					out[k] = fields[k]
				}
			}
			return out
		}
		var baseLine any
		if b != nil {
			baseLine = headingTextLine(bh)
		}
		oh := sideHeading(o)
		th := sideHeading(t)
		hconflict = map[string]any{"kind": "heading", "base": baseLine, "_ours": oh, "_theirs": th}
		hconflict["ours"] = headingTextLine(oh)
		hconflict["theirs"] = headingTextLine(th)
	}
	var bunits []any
	if b != nil {
		bunits = unitsToAny(b.units)
	}
	body := mergeSequence(bunits, unitsToAny(o.units), unitsToAny(t.units), unitMatch, sm.unitSame, unitMatch, "conflict", false, nil, nil)
	return map[string]any{"type": "section", "base": b, "heading": fields, "hconflict": hconflict,
		"sides": map[string]any{ours: o.heading, theirs: t.heading}, "body": body}
}

// --- footnote markers (§11.9) ---
func (sm *songMerge) occurrences() []*piece {
	var out []*piece
	for _, ms := range sm.chart {
		if ms["type"] == "conflict" {
			for _, side := range sides {
				for _, secAny := range ms[side].([]any) {
					for _, u := range secAny.(*sec).units {
						out = append(out, &piece{tag: "one", p1: side, p2: u})
					}
				}
			}
			continue
		}
		for _, pc := range ms["body"].([]*piece) {
			if pc.tag == "conflict" {
				for _, u := range pc.p2.([]any) {
					out = append(out, &piece{tag: "one", p1: ours, p2: u})
				}
				for _, u := range pc.p3.([]any) {
					out = append(out, &piece{tag: "one", p1: theirs, p2: u})
				}
			} else {
				out = append(out, pc)
			}
		}
	}
	return out
}

// sigsFor applies rules 1 and 2 of §11.9.4; rule 3 is left as nil for later.
func (sm *songMerge) sigsFor(pc *piece) ([][3]any, int) {
	switch pc.tag {
	case "both", "paired":
		var b *unit
		if pc.p1 != nil {
			b = pc.p1.(*unit)
		}
		o := pc.p2.(*unit)
		t := pc.p3.(*unit)
		n := len(o.chords)
		out := make([][3]any, n)
		for k := 0; k < n; k++ {
			var bk any
			if b != nil {
				bk = kt(b.chords[k])
			}
			out[k] = [3]any{bk, kt(o.chords[k]), kt(t.chords[k])}
		}
		return out, 1
	case "common":
		o := pc.p1.(*unit)
		t := pc.p2.(*unit)
		out := [][3]any{}
		for i := range o.chords {
			x := o.chords[i]
			y := t.chords[i]
			mo := sm.km[ours].muGet(kt(x))
			mt := sm.km[theirs].muGet(kt(y))
			var beta any
			if eqv(mo, mt) {
				beta = mo
			}
			out = append(out, [3]any{beta, kt(x), kt(y)})
		}
		return out, 2
	}
	return nil, 3
}

func (sm *songMerge) pieceUnit(pc *piece) *unit { return pc.p2.(*unit) }

func pieceID(pc *piece) string {
	u := pc.p2.(*unit)
	tag := pc.tag
	if tag != "one" {
		return tag + ":" + ptrID(u)
	}
	return "one:" + ptrID(u)
}

func (sm *songMerge) assignVariants() {
	rule1 := map[string]*tmap{ours: newTMap(), theirs: newTMap()}
	units := sm.occurrences()
	sigs := make([][][3]any, len(units))
	for n, pc := range units {
		s, rule := sm.sigsFor(pc)
		sigs[n] = s
		if rule == 1 || rule == 2 {
			for k, sg := range s {
				for _, sp := range []struct {
					side string
					pos  int
				}{{ours, 1}, {theirs, 2}} {
					lst := rule1[sp.side].setdefault(sg[sp.pos], []any{}).([]any)
					lst = append(lst, []any{n, k, [3]any{sg[0], sg[1], sg[2]}})
					rule1[sp.side].set(sg[sp.pos], lst)
				}
			}
		}
	}
	for n, pc := range units {
		if sigs[n] != nil {
			continue
		}
		side := pc.p1.(string)
		u := pc.p2.(*unit)
		V := sm.km[side]
		W := sm.km[other(side)]
		var out [][3]any
		for _, it := range u.chords {
			v := kt(it)
			b := V.muGet(v)
			if b != nil {
				w := W.matchGet(b)
				if side == ours {
					out = append(out, [3]any{b, v, w})
				} else {
					out = append(out, [3]any{b, w, v})
				}
				continue
			}
			foundAny, ok := rule1[side].get(v)
			if ok {
				found := foundAny.([]any)
				counts := newCounter()
				firsts := newTMap()
				for _, fAny := range found {
					f := fAny.([]any)
					sg := sgKey(f[2].([3]any))
					counts.inc(sg)
					firsts.setdefault(sg, []any{f[0], f[1]})
				}
				score := func(sg any) []any {
					fv, _ := firsts.get(sg)
					ff := fv.([]any)
					return []any{counts.get(sg), []any{-ff[0].(int), -ff[1].(int)}}
				}
				var best any
				bestSet := false
				var bestSig [3]any
				for _, fAny := range found {
					f := fAny.([]any)
					tri := f[2].([3]any)
					sg := sgKey(tri)
					if !bestSet || cmp(score(sg), score(best)) > 0 {
						best, bestSig, bestSet = sg, tri, true
					}
				}
				out = append(out, bestSig)
				continue
			}
			var w any
			if keyIdx(v) == 1 && sm.v[other(side)].keys.has(v) && !W.mu.has(v) {
				w = v
			}
			if side == ours {
				out = append(out, [3]any{nil, v, w})
			} else {
				out = append(out, [3]any{nil, w, v})
			}
		}
		sigs[n] = out
	}
	// Each occurrence's grouping, merged as a value (§11.9.4 rule 4).
	groups := make([][]any, len(units))
	for n, pc := range units {
		u := pc.p2.(*unit)
		g := make([]any, len(u.chords))
		for k, it := range u.chords {
			g[k] = []any{objString(it, "symbol"), sm.grouping(sigs[n][k])}
		}
		groups[n] = g
	}
	first := newTMap()
	membersMap := newTMap()
	pos := 0
	for n := range units {
		for k, varr := range groups[n] {
			if !first.has(varr) {
				first.set(varr, pos)
			}
			lst := membersMap.setdefault(varr, []any{}).([]any)
			lst = append(lst, sigTriAny(sigs[n][k]))
			membersMap.set(varr, lst)
			pos++
		}
	}
	sm.unitVars = map[string][]any{}
	for n, pc := range units {
		sm.unitVars[pieceID(pc)] = groups[n]
	}
	// Each variant's signature (§11.9.4).
	sm.vsig = newTMap()
	for _, varr := range membersMap.keys() {
		sgsAny, _ := membersMap.get(varr)
		sgs := sgsAny.([]any)
		grp := varr.([]any)[1].([]any)
		var beta any
		if grp[0] == "base" {
			beta = grp[1]
		} else {
			var b0 []any
			for _, sgA := range sgs {
				b0 = append(b0, sgA.([3]any)[0])
			}
			beta = mostCommon(b0)
		}
		sig := [3]any{beta, nil, nil}
		for _, sp := range []struct {
			p    int
			side string
		}{{1, ours}, {2, theirs}} {
			var keys []any
			for _, sgA := range sgs {
				keys = append(keys, sgA.([3]any)[sp.p])
			}
			var m any
			if beta != nil {
				m = sm.km[sp.side].matchGet(beta)
			}
			if m != nil && containsVal(keys, m) {
				sig[sp.p] = m
			} else {
				sig[sp.p] = mostCommon(keys)
			}
		}
		sm.vsig.set(varr, sig)
	}
	sm.vindex = newTMap()
	bySymbol := map[string][]any{}
	var symbolOrder []string
	for _, varr := range first.keys() {
		sym := varr.([]any)[0].(string)
		if _, ok := bySymbol[sym]; !ok {
			symbolOrder = append(symbolOrder, sym)
		}
		bySymbol[sym] = append(bySymbol[sym], varr)
	}
	for _, sym := range symbolOrder {
		vars_ := bySymbol[sym]
		sort.SliceStable(vars_, func(i, j int) bool {
			return cmp(sm.variantSortKey(vars_[i], first), sm.variantSortKey(vars_[j], first)) < 0
		})
		for i, varr := range vars_ {
			sm.vindex.set(varr, i+1)
		}
	}
	// Keys used only by unknown tokens are not markers (§11.9.1): fixed variants.
	sm.fixed = newTMap()
	for _, pc := range units {
		line := pc.p2.(*unit).line
		if line == nil {
			continue
		}
		for _, mEl := range objArray(line, "measures") {
			for _, itEl := range objArray(mEl.(*Object), "items") {
				it := itEl.(*Object)
				if objString(it, "type") != "unknown" {
					continue
				}
				txt := objString(it, "text")
				cm := chordTokenRE.FindStringSubmatch(txt)
				sym := txt
				if cm[1] != "" {
					sym = cm[1]
				}
				idx := 1
				if cm[2] != "" {
					n, _ := strconv.Atoi(cm[2])
					if n > 1 {
						idx = n
					}
				}
				k := []any{sym, idx}
				if keyFor(sym, idx) == txt {
					sm.fixed.set([]any{sym, []any{"fixed", k}}, k)
					sm.vsig.set([]any{sym, []any{"fixed", k}}, [3]any{k, k, k})
				}
			}
		}
	}
	var variants []any
	variants = append(variants, sm.vindex.keys()...)
	sort.SliceStable(variants, func(i, j int) bool {
		vi, _ := sm.vindex.get(variants[i])
		vj, _ := sm.vindex.get(variants[j])
		return cmp([]any{variants[i].([]any)[0], vi}, []any{variants[j].([]any)[0], vj}) < 0
	})
	fixedVars := append([]any{}, sm.fixed.keys()...)
	sort.SliceStable(fixedVars, func(i, j int) bool {
		ki, _ := sm.fixed.get(fixedVars[i])
		kj, _ := sm.fixed.get(fixedVars[j])
		return cmp(ki, kj) < 0
	})
	sm.variants = append(variants, fixedVars...)
}

// variantSortKey is [signature key indices descending, first appearance].
func (sm *songMerge) variantSortKey(varr any, first *tmap) []any {
	sigAny, _ := sm.vsig.get(varr)
	sig := sigAny.([3]any)
	var idxs []any
	for _, k := range sig {
		if k != nil {
			idxs = append(idxs, keyIdx(k))
		}
	}
	sort.SliceStable(idxs, func(i, j int) bool { return idxs[i].(int) > idxs[j].(int) })
	fv, _ := first.get(varr)
	return []any{idxs, fv}
}

func sgKey(tri [3]any) any     { return []any{tri[0], tri[1], tri[2]} }
func sigTriAny(tri [3]any) any { return tri }

func (sm *songMerge) destination(side string, k, beta any) any {
	if k == nil {
		var d any
		if beta != nil {
			if dv, ok := sm.joined[side].get(beta); ok {
				d = dv
			}
		}
		if d != nil {
			return []any{"base", d}
		}
		return nil
	}
	b := sm.km[side].muGet(k)
	if b != nil {
		return []any{"base", b}
	}
	return []any{"new", side, k}
}

func (sm *songMerge) grouping(sig [3]any) any {
	beta, o, t := sig[0], sig[1], sig[2]
	var base any
	if beta != nil {
		base = []any{"base", beta}
	}
	doo := sm.destination(ours, o, beta)
	dt := sm.destination(theirs, t, beta)
	mo := doo != nil && !eqv(doo, base)
	mt := dt != nil && !eqv(dt, base)
	if !mo && !mt {
		return base
	}
	if mo && !mt && dt != nil && sm.reshaped(theirs, beta) {
		mt = true
	}
	if mt && !mo && doo != nil && sm.reshaped(ours, beta) {
		mo = true
	}
	if !mt {
		return doo
	}
	if !mo || eqv(doo, dt) {
		return dt
	}
	return []any{"pair", doo, dt}
}

func (sm *songMerge) reshaped(side string, b any) bool {
	m := sm.km[side].matchGet(b)
	if m == nil {
		return false
	}
	ident := func(blk *Object) any {
		return []any{objString(oobj(blk, "tuning"), "id"), objString(blk, "label")}
	}
	mine := newTMap()
	for _, blkAny := range sm.v[side].blocks {
		blk := blkAny.(*Object)
		mine.set(ident(blk), blk)
	}
	for _, XAny := range sm.v["base"].blocks {
		X := XAny.(*Object)
		YAny, ok := mine.get(ident(X))
		if !ok {
			continue
		}
		Y := YAny.(*Object)
		var x, y *Object
		for _, eAny := range objArray(X, "voicings") {
			e := eAny.(*Object)
			if eqv([]any{objString(e, "symbol"), numVal(mustGet(e, "index"))}, b) {
				x = e
				break
			}
		}
		for _, eAny := range objArray(Y, "voicings") {
			e := eAny.(*Object)
			if eqv([]any{objString(e, "symbol"), numVal(mustGet(e, "index"))}, m) {
				y = e
				break
			}
		}
		if !vtextEq(voicingText(x), voicingText(y)) {
			return true
		}
	}
	return false
}

func (sm *songMerge) variantKey(symbol string, grp any) (string, int) {
	fk := []any{symbol, grp}
	if v, ok := sm.fixed.get(fk); ok {
		kk := v.([]any)
		return kk[0].(string), kk[1].(int)
	}
	v, _ := sm.vindex.get(fk)
	return symbol, v.(int)
}

// --- reading (§11.7.2) ---
func (sm *songMerge) appliedUnits(side string) []*unit {
	var out []*unit
	for _, ms := range sm.chart {
		if ms["type"] != "section" {
			continue
		}
		for _, pc := range ms["body"].([]*piece) {
			if pc.tag == "one" && pc.p1.(string) == side {
				u := pc.p2.(*unit)
				if u.kind[0] == "music" {
					out = append(out, u)
				}
			}
		}
	}
	return out
}

func (sm *songMerge) readingConflicts() {
	B := sm.v["base"]
	sm.reading = map[string]map[string]any{}
	for _, prop := range []string{"notation", "words"} {
		a := B.propGet(prop)
		for _, side := range sides {
			V := sm.v[side]
			W := sm.v[other(side)]
			x := V.propGet(prop)
			y := W.propGet(prop)
			if eqv(x, a) || !eqv(y, a) {
				continue
			}
			applied := sm.appliedUnits(other(side))
			var c map[string]any
			if prop == "notation" {
				dv := dialectOfProps(objArray(V.doc, "properties"))
				db := dialectOfProps(objArray(B.doc, "properties"))
				if dv == db || dialectOfProps(objArray(W.doc, "properties")) != db {
					continue
				}
				var symbols []any
				symSeen := map[string]bool{}
				for _, u := range applied {
					for _, it := range u.chords {
						s := objString(it, "symbol")
						if !symSeen[s] {
							cdv := parseChord(s, dv).chord
							cdb := parseChord(s, db).chord
							if !eqv(modelOrNil(cdv), modelOrNil(cdb)) {
								symbols = append(symbols, s)
								symSeen[s] = true
							}
						}
					}
				}
				if len(symbols) == 0 {
					continue
				}
				var seen []any
				seenSet := map[string]bool{}
				for _, pc := range sm.occurrences() {
					u := pc.p2.(*unit)
					for _, it := range u.chords {
						s := objString(it, "symbol")
						if symSeen[s] && !seenSet[s] {
							seen = append(seen, s)
							seenSet[s] = true
						}
					}
				}
				c = map[string]any{"kind": "reading", "key": prop, "changed": side, "symbols": seen,
					"base": a, ours: sm.v[ours].propGet(prop), theirs: sm.v[theirs].propGet(prop)}
			} else {
				if len(applied) == 0 {
					continue
				}
				c = map[string]any{"kind": "reading", "key": prop, "changed": side,
					"base": a, ours: sm.v[ours].propGet(prop), theirs: sm.v[theirs].propGet(prop)}
			}
			sm.reading[prop] = c
			sm.propIn.add(prop)
			sm.propValue.set(prop, confl)
			sm.propConflict.set(prop, c)
		}
	}
	var pkeys []string
	for _, kAny := range sm.propConflict.keys() {
		pkeys = append(pkeys, kAny.(string))
	}
	sort.SliceStable(pkeys, func(i, j int) bool { return cmpCodePoints(pkeys[i], pkeys[j]) < 0 })
	for _, k := range pkeys {
		cAny, _ := sm.propConflict.get(k)
		sm.conflicts = append(sm.conflicts, cAny.(map[string]any))
	}
}

func modelOrNil(m Model) any {
	if m == nil {
		return nil
	}
	return m
}

func (sm *songMerge) dialect() string {
	if v, ok := sm.propValue.get("notation"); ok {
		if isConflict(v) {
			return sm.v["base"].dialect
		}
		if v == nil {
			return dialectOfProps(nil)
		}
		p := NewObject()
		p.Set("key", "notation")
		p.Set("value", v)
		return dialectOfProps([]any{p})
	}
	return dialectOfProps(nil)
}

// --- voicings (§11.10) ---

var versionPos = map[string]int{"base": 0, ours: 1, theirs: 2}

func blockItems(block *Object) *tmap {
	m := newTMap()
	if block != nil {
		for _, eAny := range objArray(block, "voicings") {
			e := eAny.(*Object)
			m.set([]any{objString(e, "symbol"), numVal(mustGet(e, "index"))}, e)
		}
	}
	return m
}

func (sm *songMerge) voicingFor(ver string, block *Object, varr any, baseBlock *Object) *Object {
	sigAny, _ := sm.vsig.get(varr)
	sig := sigAny.([3]any)
	k := sig[versionPos[ver]]
	if block == nil {
		return nil
	}
	if k == nil {
		if ver != "base" && sig[0] != nil && baseBlock != nil {
			if e, ok := blockItems(baseBlock).get(sig[0]); ok {
				return e.(*Object)
			}
		}
		return nil
	}
	if e, ok := blockItems(block).get(k); ok {
		return e.(*Object)
	}
	return nil
}

func (sm *songMerge) weakAbsence(side string, i, varr any) bool {
	sigAny, _ := sm.vsig.get(varr)
	sig := sigAny.([3]any)
	beta := sig[0]
	if beta == nil {
		return false
	}
	blkAny, ok := sm.blk[side].get(i)
	if !ok {
		return false
	}
	blk := blkAny.(*Object)
	k := sig[versionPos[side]]
	m := sm.km[side].matchGet(beta)
	if eqv(k, m) {
		return false
	}
	if _, has := blockItems(blk).get(k); has {
		return false
	}
	var mEntry *Object
	if m != nil {
		if e, ok := blockItems(blk).get(m); ok {
			mEntry = e.(*Object)
		}
	}
	var baseBlk *Object
	if bb, ok := sm.blk["base"].get(i); ok {
		baseBlk = bb.(*Object)
	}
	return vtextEq(voicingText(mEntry), voicingText(sm.voicingFor("base", baseBlk, varr, nil)))
}

func blockIdent(blk *Object) any {
	return []any{objString(oobj(blk, "tuning"), "id"), objString(blk, "label")}
}

func (sm *songMerge) mergeBlocks() {
	B := sm.v["base"]

	baseBy := newTSet()
	for _, bAny := range B.blocks {
		baseBy.add(blockIdent(bAny.(*Object)))
	}
	sm.rename = map[string]*tmap{ours: newTMap(), theirs: newTMap()}
	for _, side := range sides {
		V := sm.v[side]
		sideBy := newTSet()
		for _, bAny := range V.blocks {
			sideBy.add(blockIdent(bAny.(*Object)))
		}
		var cands [][2]any
		for _, XAny := range B.blocks {
			X := XAny.(*Object)
			if sideBy.has(blockIdent(X)) {
				continue
			}
			for _, YAny := range V.blocks {
				Y := YAny.(*Object)
				if baseBy.has(blockIdent(Y)) || objString(oobj(Y, "tuning"), "id") != objString(oobj(X, "tuning"), "id") {
					continue
				}
				if !eqv(objArray(X, "notes"), objArray(Y, "notes")) {
					continue
				}
				all := true
				for _, varr := range sm.variants {
					if !vtextEq(voicingText(sm.voicingFor("base", X, varr, nil)), voicingText(sm.voicingFor(side, Y, varr, X))) {
						all = false
						break
					}
				}
				if all {
					cands = append(cands, [2]any{blockIdent(X), blockIdent(Y)})
				}
			}
		}
		for _, xy := range cands {
			x, y := xy[0], xy[1]
			nx, ny := 0, 0
			for _, c := range cands {
				if eqv(c[0], x) {
					nx++
				}
				if eqv(c[1], y) {
					ny++
				}
			}
			if nx == 1 && ny == 1 {
				sm.rename[side].set(y, x)
			}
		}
	}
	blocks := map[string]*tmap{"base": newTMap()}
	for _, bAny := range B.blocks {
		b := bAny.(*Object)
		blocks["base"].set(blockIdent(b), b)
	}
	for _, side := range sides {
		blocks[side] = newTMap()
		for _, YAny := range sm.v[side].blocks {
			Y := YAny.(*Object)
			id := blockIdent(Y)
			if ri, ok := sm.rename[side].get(id); ok {
				id = ri
			}
			blocks[side].set(id, Y)
		}
	}
	sm.blk = blocks

	ids := newTSet()
	for _, k := range blocks["base"].keys() {
		ids.add(k)
	}
	for _, k := range blocks[ours].keys() {
		ids.add(k)
	}
	for _, k := range blocks[theirs].keys() {
		ids.add(k)
	}

	changed := func(side string, i any) bool {
		bAny, _ := blocks["base"].get(i)
		sAny, _ := blocks[side].get(i)
		b := bAny.(*Object)
		s := sAny.(*Object)
		if objString(s, "label") != objString(b, "label") || !eqv(objArray(s, "notes"), objArray(b, "notes")) {
			return true
		}
		for _, varr := range sm.variants {
			if !vtextEq(voicingText(sm.voicingFor(side, s, varr, b)), voicingText(sm.voicingFor("base", b, varr, nil))) && !sm.weakAbsence(side, i, varr) {
				return true
			}
		}
		return false
	}

	sm.blockIn = newTSet()
	sm.blockConflict = newTMap()
	for _, i := range ids.values() {
		inb := blocks["base"].has(i)
		ino := blocks[ours].has(i)
		intt := blocks[theirs].has(i)
		if !inb || (ino && intt) {
			sm.blockIn.add(i)
		} else if ino || intt {
			side := ours
			if !ino {
				side = theirs
			}
			if changed(side, i) {
				sm.blockIn.add(i)
				sm.blockConflict.set(i, map[string]any{"kind": "block", "_deleted": other(side)})
			}
		}
	}
	sm.bname = newTMap()
	sm.bspell = newTMap()
	sm.bvoicings = newTMap()
	sm.bnotes = newTMap()
	for _, i := range sm.blockIn.values() {
		vers := sm.blockVers(blocks, i)
		names := map[string]any{}
		for _, k := range []string{"base", ours, theirs} {
			if vers[k] != nil {
				names[k] = labelAny(vers[k])
			} else {
				names[k] = nil
			}
		}
		name := mergeValue(names["base"], names[ours], names[theirs])
		sm.bname.set(i, []any{name, names})
		sp := map[string]any{}
		for _, k := range []string{"base", ours, theirs} {
			if vers[k] != nil {
				sp[k] = objString(oobj(vers[k], "tuning"), "text")
			} else {
				sp[k] = nil
			}
		}
		spell := mergeValue(sp["base"], sp[ours], sp[theirs])
		if isConflict(spell) {
			var opts []any
			for _, k := range []string{ours, theirs} {
				if sp[k] != nil {
					opts = append(opts, sp[k])
				}
			}
			sort.SliceStable(opts, func(a, b int) bool { return cmpCodePoints(opts[a].(string), opts[b].(string)) < 0 })
			spell = opts[0]
		}
		if spell == nil {
			spell = sp["base"]
		}
		sm.bspell.set(i, spell)
	}
	// non-conflicting blocks, in sort order
	var inOrder []any
	inOrder = append(inOrder, sm.blockIn.values()...)
	sort.SliceStable(inOrder, func(a, b int) bool { return cmpCodePoints(sm.blockSort(inOrder[a]), sm.blockSort(inOrder[b])) < 0 })
	for _, i := range inOrder {
		if sm.blockConflict.has(i) {
			continue
		}
		vers := sm.blockVers(blocks, i)
		pair, _ := sm.bname.get(i)
		name := pair.([]any)[0]
		names := pair.([]any)[1].(map[string]any)
		tuning := sm.spellOf(i)
		if isConflict(name) {
			sm.conflicts = append(sm.conflicts, map[string]any{"kind": "variation", "tuning": tuning, "base": names["base"],
				ours: names[ours], theirs: names[theirs], "_block": i})
		}
		merged := newTMap()
		for _, varr := range sm.variants {
			a := voicingText(sm.voicingFor("base", vers["base"], varr, nil))
			x := voicingText(sm.voicingFor(ours, vers[ours], varr, vers["base"]))
			y := voicingText(sm.voicingFor(theirs, vers[theirs], varr, vers["base"]))
			val := mergeValue(a, x, y)
			if isConflict(val) {
				if sm.weakAbsence(ours, i, varr) {
					val = y
				} else if sm.weakAbsence(theirs, i, varr) {
					val = x
				}
			}
			if isConflict(val) {
				sym, idx := sm.variantKey(varr.([]any)[0].(string), varr.([]any)[1])
				c := map[string]any{"kind": "voicing", "tuning": tuning, "variation": labelOr(sm.blockName(i), ""),
					"key": keyText([]any{sym, idx}), "base": a, ours: x, theirs: y, "_block": i}
				sm.conflicts = append(sm.conflicts, c)
				merged.set(varr, c)
			} else if val != nil {
				var src *Object
				for _, k := range []string{ours, theirs, "base"} {
					e := sm.voicingFor(k, vers[k], varr, vers["base"])
					if vtextEq(voicingText(e), val) {
						src = e
						break
					}
				}
				merged.set(varr, src)
			}
		}
		sm.bvoicings.set(i, merged)
		var nb, no, nt []any
		if vers["base"] != nil {
			nb = objArray(vers["base"], "notes")
		}
		if vers[ours] != nil {
			no = objArray(vers[ours], "notes")
		}
		if vers[theirs] != nil {
			nt = objArray(vers[theirs], "notes")
		}
		eq := func(x, y any) bool { return x == y }
		notes := mergeSequence(nb, no, nt, eq, eq, eq, "conflict", false, nil, nil)
		for _, pc := range notes {
			if pc.tag == "conflict" {
				sm.conflicts = append(sm.conflicts, map[string]any{"kind": "block-notes", "tuning": tuning,
					"variation": labelOr(sm.blockName(i), ""), "base": pc.p1, ours: pc.p2, theirs: pc.p3, "_pc": pc})
			}
		}
		sm.bnotes.set(i, notes)
	}
	// block-delete conflicts, filled in and appended last
	for _, i := range sm.blockConflict.keys() {
		cAny, _ := sm.blockConflict.get(i)
		c := cAny.(map[string]any)
		c["tuning"] = sm.spellOf(i)
		c["variation"] = labelOr(sm.blockName(i), "")
		c["_block"] = i
		for _, k := range []string{"base", ours, theirs} {
			if blk, ok := blocks[k].get(i); ok {
				c[k] = strings.Join(sm.sideBlockLines(k, blk.(*Object)), "\n")
			} else {
				c[k] = nil
			}
		}
		sm.conflicts = append(sm.conflicts, c)
	}
}

func (sm *songMerge) blockVers(blocks map[string]*tmap, i any) map[string]*Object {
	out := map[string]*Object{}
	for _, k := range []string{"base", ours, theirs} {
		if v, ok := blocks[k].get(i); ok {
			out[k] = v.(*Object)
		} else {
			out[k] = nil
		}
	}
	return out
}

func labelAny(b *Object) any {
	if v, ok := b.Get("label"); ok {
		return v
	}
	return nil
}

func labelOr(v any, def string) string {
	if s, ok := v.(string); ok && s != "" {
		return s
	}
	return def
}

func (sm *songMerge) spellOf(i any) any {
	v, _ := sm.bspell.get(i)
	return v
}

func (sm *songMerge) blockName(i any) any {
	pairAny, _ := sm.bname.get(i)
	pair := pairAny.([]any)
	name := pair[0]
	names := pair[1].(map[string]any)
	if isConflict(name) || name == nil {
		var sideVals []any
		for _, k := range []string{ours, theirs} {
			if names[k] != nil {
				sideVals = append(sideVals, names[k])
			}
		}
		if len(sideVals) > 0 {
			sort.SliceStable(sideVals, func(a, b int) bool { return cmpCodePoints(sideVals[a].(string), sideVals[b].(string)) < 0 })
			return sideVals[0]
		}
		return names["base"]
	}
	return name
}

func (sm *songMerge) blockSort(i any) string {
	var name any
	if sm.bname.has(i) {
		name = sm.blockName(i)
	} else {
		name = i.([]any)[1]
	}
	spellAny, ok := sm.bspell.get(i)
	var spell string
	if ok && spellAny != nil {
		spell = spellAny.(string)
	} else {
		for _, k := range []string{"base", ours, theirs} {
			if b, ok := sm.blk[k].get(i); ok {
				spell = objString(oobj(b.(*Object), "tuning"), "text")
				break
			}
		}
	}
	return "## " + labelOr(name, "Voicings") + ": " + spell
}

func (sm *songMerge) renameID(ver string, blk *Object) any {
	i := []any{objString(oobj(blk, "tuning"), "id"), objString(blk, "label")}
	if ver == "base" {
		return i
	}
	if ri, ok := sm.rename[ver].get(i); ok {
		return ri
	}
	return i
}

func (sm *songMerge) blockOrder() []any {
	var Bids, Oids, Tids []any
	for _, b := range sm.v["base"].blocks {
		Bids = append(Bids, sm.renameID("base", b.(*Object)))
	}
	for _, b := range sm.v[ours].blocks {
		Oids = append(Oids, sm.renameID(ours, b.(*Object)))
	}
	for _, b := range sm.v[theirs].blocks {
		Tids = append(Tids, sm.renameID(theirs, b.(*Object)))
	}
	all := newTSet()
	for _, x := range Bids {
		all.add(x)
	}
	for _, x := range Oids {
		all.add(x)
	}
	for _, x := range Tids {
		all.add(x)
	}
	for _, i := range all.values() {
		if !sm.bspell.has(i) {
			if !sm.bname.has(i) {
				sm.bname.set(i, []any{i.([]any)[1], map[string]any{"base": i.([]any)[1]}})
			}
		}
	}
	seq := keyedOrder(Bids, Oids, Tids, sm.blockIn, func(i any) any { return sm.blockSort(i) })
	var tunings []string
	for _, i := range seq {
		tid := i.([]any)[0].(string)
		found := false
		for _, x := range tunings {
			if x == tid {
				found = true
				break
			}
		}
		if !found {
			tunings = append(tunings, tid)
		}
	}
	tuningIdx := func(tid string) int {
		for i, x := range tunings {
			if x == tid {
				return i
			}
		}
		return len(tunings)
	}
	out := append([]any{}, seq...)
	sort.SliceStable(out, func(a, b int) bool {
		ka := []any{tuningIdx(out[a].([]any)[0].(string)), labelOr(sm.blockName(out[a]), "") != "", indexOfVal(seq, out[a])}
		kb := []any{tuningIdx(out[b].([]any)[0].(string)), labelOr(sm.blockName(out[b]), "") != "", indexOfVal(seq, out[b])}
		return cmp(ka, kb) < 0
	})
	return out
}

func (sm *songMerge) sideBlockLines(ver string, blk *Object) []string {
	lines := []string{"## " + labelOr(labelAny(blk), "Voicings") + ": " + objString(oobj(blk, "tuning"), "text")}
	type row struct {
		k    any
		line string
	}
	var rows []row
	for _, varr := range sm.variants {
		var baseBlock *Object
		if ver != "base" {
			if bb, ok := sm.blk["base"].get(sm.renameID(ver, blk)); ok {
				baseBlock = bb.(*Object)
			}
		}
		e := sm.voicingFor(ver, blk, varr, baseBlock)
		if e != nil {
			sym, idx := sm.variantKey(varr.([]any)[0].(string), varr.([]any)[1])
			rows = append(rows, row{[]any{sym, idx}, "- " + keyFor(sym, idx) + ": " + voicingText(e).(string)})
		}
	}
	sort.SliceStable(rows, func(a, b int) bool { return cmp(rows[a].k, rows[b].k) < 0 })
	for _, r := range rows {
		lines = append(lines, r.line)
	}
	for _, nEl := range objArray(blk, "notes") {
		if s, ok := nEl.(string); ok {
			lines = append(lines, s)
		}
	}
	return lines
}

// --- building the result (§11.11) and the marked text (§11.12.2) ---

func (sm *songMerge) realise(pc *piece) []any {
	u := pc.p2.(*unit)
	if u.kind[0] == "fence" {
		return []any{"fence", u.kind[1]}
	}
	if u.kind[0] != "music" {
		return []any{"line", u.kind, u.text}
	}
	line := deepCopyValue(u.line).(*Object)
	groups := sm.unitVars[pieceID(pc)]
	for idx, it := range chordsOf(line) {
		grp := groups[idx].([]any)[1]
		sym, i := sm.variantKey(objString(it, "symbol"), grp)
		it.Set("index", i)
		it.Set("key", keyFor(sym, i))
	}
	if objString(line, "kind") == "sung" {
		converge(line, lyricText(line), sm.dialect())
	}
	return []any{"line", u.kind, line}
}

func (sm *songMerge) unitLines(r []any) []string {
	if r[0] == "fence" {
		return []string{"```" + r[1].(string)}
	}
	kind := r[1].([]any)
	if kind[0] == "music" {
		return musicLines([]any{r[2].(*Object)}, sm.dialect())
	}
	return []string{r[2].(string)}
}

func (sm *songMerge) unitString(r []any) string {
	return strings.Join(sm.unitLines(r), "\n")
}

type partDesc struct {
	typ   string
	info  string
	lines []any
}

func toParts(seq []any) []*partDesc {
	var parts []*partDesc
	for _, el := range seq {
		var kind []any
		var item any
		if m, ok := el.(map[string]any); ok {
			kind = m["kind"].([]any)
			item = m
		} else {
			r := el.([]any)
			if r[0] == "fence" {
				info := r[1].(string)
				if info != "" {
					parts = append(parts, &partDesc{typ: "verbatim", info: info})
				} else {
					parts = append(parts, &partDesc{typ: "music"})
				}
				continue
			}
			kind = r[1].([]any)
			item = r[2]
		}
		want := map[string]string{"notes": "notes", "music": "music", "verbatim": "verbatim"}[kind[0].(string)]
		var cur *partDesc
		if len(parts) > 0 {
			cur = parts[len(parts)-1]
		}
		if cur == nil || cur.typ != want || (want == "verbatim" && cur.info != kind[1].(string)) {
			cur = &partDesc{typ: want}
			if want == "verbatim" {
				cur.info = kind[1].(string)
			}
			parts = append(parts, cur)
		}
		cur.lines = append(cur.lines, item)
	}
	return parts
}

func allStrings(xs []any) bool {
	for _, x := range xs {
		if _, ok := x.(string); !ok {
			return false
		}
	}
	return true
}

func joinAnyStrings(xs []any) string {
	ss := make([]string, len(xs))
	for i, x := range xs {
		ss[i], _ = x.(string)
	}
	return strings.Join(ss, "\n")
}

func (sm *songMerge) sectionModel(heading []any, seq []any) *Object {
	form := heading[0]
	name := ""
	if s, ok := heading[1].(string); ok {
		name = s
	}
	anchor := heading[2]
	times := heading[3]
	s := NewObject()
	s.Set("name", name)
	if form == "none" || form == nil {
		s.Set("heading", nil)
	} else {
		s.Set("heading", form)
	}
	s.Set("anchor", anchor)
	body := []any{}
	for _, part := range toParts(seq) {
		po := NewObject()
		switch part.typ {
		case "notes":
			po.Set("type", "notes")
			if allStrings(part.lines) {
				po.Set("text", joinAnyStrings(part.lines))
			} else {
				po.Set("text", "")
			}
			po.Set("_lines", part.lines)
		case "verbatim":
			po.Set("type", "verbatim")
			po.Set("info", part.info)
			if allStrings(part.lines) {
				po.Set("text", joinAnyStrings(part.lines))
			} else {
				po.Set("text", "")
			}
			po.Set("_lines", part.lines)
		default:
			po.Set("type", "music")
			po.Set("lines", part.lines)
		}
		body = append(body, po)
	}
	s.Set("body", body)
	s.Set("groups", []any{})
	if times != nil {
		s.Set("times", times)
	}
	return s
}

func (sm *songMerge) sideSections(side string, secs []any) []*Object {
	var out []*Object
	for _, secAny := range secs {
		s := secAny.(*sec)
		var seq []any
		for _, u := range s.units {
			seq = append(seq, sm.realise(&piece{tag: "one", p1: side, p2: u}))
		}
		out = append(out, sm.sectionModel(s.heading, seq))
	}
	return out
}

func (sm *songMerge) sectionText(s *Object, dialect string) string {
	if dialect == "" {
		dialect = sm.dialect()
	}
	blocks := chartBlocks([]any{s}, dialect)
	joined := make([]string, len(blocks))
	for i, b := range blocks {
		joined[i] = strings.Join(b, "\n")
	}
	return strings.Join(joined, "\n\n")
}

func (sm *songMerge) mergedSections() []any {
	var out []any
	for _, ms := range sm.chart {
		if ms["type"] == "conflict" {
			var baseTexts []any
			for _, secAny := range ms["base"].([]any) {
				baseTexts = append(baseTexts, sm.sectionText(secAny.(*sec).model, sm.v["base"].dialect))
			}
			c := map[string]any{"kind": "sections", "base": baseTexts}
			o := sm.sideSections(ours, ms[ours].([]any))
			t := sm.sideSections(theirs, ms[theirs].([]any))
			var ot, tt []any
			for _, s := range o {
				ot = append(ot, sm.sectionText(s, ""))
			}
			for _, s := range t {
				tt = append(tt, sm.sectionText(s, ""))
			}
			c[ours] = ot
			c[theirs] = tt
			sm.conflicts = append(sm.conflicts, c)
			out = append(out, []any{"region", c, o, t})
			continue
		}
		var seq []any
		var regions []map[string]any
		whole := false
		for _, pc := range ms["body"].([]*piece) {
			if pc.tag == "conflict" {
				var ro, rt []any
				for _, u := range pc.p2.([]any) {
					ro = append(ro, sm.realise(&piece{tag: "one", p1: ours, p2: u}))
				}
				for _, u := range pc.p3.([]any) {
					rt = append(rt, sm.realise(&piece{tag: "one", p1: theirs, p2: u}))
				}
				kindSet := newTSet()
				for _, rAny := range append(append([]any{}, ro...), rt...) {
					r := rAny.([]any)
					if r[0] == "line" {
						kind := r[1].([]any)
						if kind[0] == "music" {
							kindSet.add([]any{"music"})
						} else {
							kindSet.add(kind)
						}
					} else {
						kindSet.add([]any{"fence"})
					}
				}
				kinds := kindSet.values()
				var baseTexts, ourStrs, theirStrs []any
				for _, u := range pc.p1.([]any) {
					baseTexts = append(baseTexts, u.(*unit).text)
				}
				for _, r := range ro {
					ourStrs = append(ourStrs, sm.unitString(r.([]any)))
				}
				for _, r := range rt {
					theirStrs = append(theirStrs, sm.unitString(r.([]any)))
				}
				c := map[string]any{"kind": "chart", "base": baseTexts, ours: ourStrs, theirs: theirStrs}
				if len(kinds) != 1 || kinds[0].([]any)[0] == "fence" {
					whole = true
				}
				regions = append(regions, c)
				seq = append(seq, map[string]any{"region": c, "kind": kinds[0], ours: ro, theirs: rt})
			} else {
				seq = append(seq, sm.realise(pc))
			}
		}
		var hc map[string]any
		if hcAny := ms["hconflict"]; hcAny != nil {
			hc = hcAny.(map[string]any)
		}
		sides := ms["sides"].(map[string]any)
		if hc != nil {
			for _, sv := range []any{sides[ours], sides[theirs]} {
				if h, ok := sv.([]any); ok && (h[0] == "bracket" || h[0] == "label") {
					whole = true
				}
			}
		}
		if whole {
			way := func(side string) *Object {
				var h []any
				if hc != nil {
					h = hc["_"+side].([]any)
				} else {
					h = ms["heading"].([]any)
				}
				var sq []any
				for _, el := range seq {
					if m, ok := el.(map[string]any); ok {
						sq = append(sq, m[side].([]any)...)
					} else {
						sq = append(sq, el)
					}
				}
				return sm.sectionModel(h, sq)
			}
			o := way(ours)
			t := way(theirs)
			var baseTexts []any
			if bs := ms["base"]; bs != nil {
				baseTexts = append(baseTexts, sm.sectionText(bs.(*sec).model, sm.v["base"].dialect))
			}
			c := map[string]any{"kind": "sections", "base": baseTexts,
				ours: []any{sm.sectionText(o, "")}, theirs: []any{sm.sectionText(t, "")}}
			sm.conflicts = append(sm.conflicts, c)
			out = append(out, []any{"region", c, []*Object{o}, []*Object{t}})
			continue
		}
		for _, c := range regions {
			sm.conflicts = append(sm.conflicts, c)
		}
		if hc != nil {
			sm.conflicts = append(sm.conflicts, hc)
		}
		heading := append([]any{}, ms["heading"].([]any)...)
		if hc != nil {
			for k := range heading {
				if isConflict(heading[k]) {
					heading[k] = nil
				}
			}
			oh := hc["_ours"].([]any)
			th := hc["_theirs"].([]any)
			form := "markdown"
			if oh[0] == th[0] {
				form = oh[0].(string)
			}
			heading[0] = form
		}
		model := sm.sectionModel(heading, seq)
		if hc != nil {
			model.Set("_hconflict", hc)
		} else {
			model.Set("_hconflict", nil)
		}
		out = append(out, []any{"section", model})
	}
	return out
}

func (sm *songMerge) resultModel() *Object {
	props := []any{}
	for _, kAny := range sm.propertyOrder() {
		k := kAny.(string)
		v, _ := sm.propValue.get(k)
		p := NewObject()
		p.Set("key", k)
		p.Set("value", v)
		props = append(props, p)
	}
	var sections []any
	for _, m := range sm.sectionsOut {
		mm := m.([]any)
		s := mm[1].(*Object)
		for _, pEl := range objArray(s, "body") {
			pEl.(*Object).Delete("_lines")
		}
		s.Delete("_hconflict")
		sections = append(sections, s)
	}
	var blocks []any
	for _, i := range sm.blockOrder() {
		versAny, _ := sm.bvoicings.get(i)
		vers := versAny.(*tmap)
		blk := NewObject()
		pair, _ := sm.bname.get(i)
		blk.Set("label", pair.([]any)[0])
		tuning := deepCopyValue(oobj(sm.anyBlock(i), "tuning")).(*Object)
		tuning.Set("text", sm.spellOf(i))
		blk.Set("tuning", tuning)
		voi := []any{}
		for _, varr := range vers.keys() {
			eAny, _ := vers.get(varr)
			e := eAny.(*Object)
			sym, idx := sm.variantKey(varr.([]any)[0].(string), varr.([]any)[1])
			item := NewObject()
			item.Set("key", keyFor(sym, idx))
			item.Set("symbol", sym)
			item.Set("index", idx)
			item.Set("frets", mustGet(e, "frets"))
			if fv, ok := e.Get("fingers"); ok {
				item.Set("fingers", fv)
			}
			voi = append(voi, item)
		}
		blk.Set("voicings", voi)
		notes := []any{}
		notesAny, _ := sm.bnotes.get(i)
		for _, pc := range notesAny.([]*piece) {
			if pc.tag == "both" || pc.tag == "common" {
				notes = append(notes, pc.p1)
			} else {
				notes = append(notes, pc.p2)
			}
		}
		blk.Set("notes", notes)
		blocks = append(blocks, blk)
	}
	m := NewObject()
	m.Set("title", sm.title)
	m.Set("properties", props)
	m.Set("sections", sections)
	m.Set("blocks", blocks)
	m.Set("sung", false)
	m.Set("sungAt", nil)
	m.Set("diagnostics", []any{})
	return m
}

func (sm *songMerge) anyBlock(i any) *Object {
	for _, k := range []string{ours, theirs, "base"} {
		if b, ok := sm.blk[k].get(i); ok {
			return b.(*Object)
		}
	}
	return nil
}

func (sm *songMerge) result() string {
	text := serialize(canonicalModel(sm.resultModel()))
	return canonicalSongText(text)
}

// --- the marked text (§11.12.2) ---

func collapse(lines []string) []string {
	var out []string
	for _, ln := range lines {
		if ln == "" && len(out) > 0 && out[len(out)-1] == "" {
			continue
		}
		out = append(out, ln)
	}
	return out
}

func strsToAnySlice(xs []string) []any {
	out := make([]any, len(xs))
	for i, x := range xs {
		out[i] = x
	}
	return out
}

func (sm *songMerge) marked() string {
	var blocks [][]any
	var meta []any
	if sm.titleConflict != nil {
		c := sm.titleConflict
		var ol, tl []string
		if s, ok := c[ours].(string); ok && s != "" {
			ol = []string{headingLine(1, s)}
		}
		if s, ok := c[theirs].(string); ok && s != "" {
			tl = []string{headingLine(1, s)}
		}
		meta = append(meta, region(c, ol, tl)...)
	} else if s, ok := sm.title.(string); ok && s != "" {
		meta = append(meta, headingLine(1, s))
	}
	for _, kAny := range sm.propertyOrder() {
		k := kAny.(string)
		if cAny, ok := sm.propConflict.get(k); ok {
			c := cAny.(map[string]any)
			line := func(v any) []string {
				if v == nil {
					return nil
				}
				if vs, ok := v.(string); ok && vs != "" {
					return []string{"- " + k + ": " + vs}
				}
				return []string{"- " + k + ":"}
			}
			meta = append(meta, region(c, line(c[ours]), line(c[theirs]))...)
		} else {
			v, _ := sm.propValue.get(k)
			if vs, ok := v.(string); ok && vs != "" {
				meta = append(meta, "- "+k+": "+vs)
			} else {
				meta = append(meta, "- "+k+":")
			}
		}
	}
	if len(meta) > 0 {
		blocks = append(blocks, meta)
	}
	blocks = append(blocks, sm.markedChart()...)
	vb := sm.markedVoicings()
	if len(vb) > 0 {
		blocks = append(blocks, []any{"---"})
		blocks = append(blocks, vb...)
	}
	return finishMarked(blocks, sm.conflicts)
}

func hasRegion(m map[string]any) bool { _, ok := m["region"]; return ok }

func (sm *songMerge) markedPartLines(part *Object) []any {
	var out []any
	if objString(part, "type") == "music" {
		for _, el := range objArray(part, "lines") {
			if m, ok := el.(map[string]any); ok && hasRegion(m) {
				var ol, tl []string
				for _, r := range m[ours].([]any) {
					ol = append(ol, sm.unitLines(r.([]any))...)
				}
				for _, r := range m[theirs].([]any) {
					tl = append(tl, sm.unitLines(r.([]any))...)
				}
				out = append(out, region(m["region"].(map[string]any), ol, tl)...)
			} else {
				out = append(out, strsToAnySlice(musicLines([]any{el.(*Object)}, sm.dialect()))...)
			}
		}
		return out
	}
	typ := objString(part, "type")
	var plain []string
	lines, _ := part.Get("_lines")
	for _, el := range lines.([]any) {
		if m, ok := el.(map[string]any); ok {
			if typ == "verbatim" {
				out = append(out, strsToAnySlice(plain)...)
			} else {
				out = append(out, strsToAnySlice(collapse(plain))...)
			}
			plain = nil
			var ol, tl []string
			for _, r := range m[ours].([]any) {
				ol = append(ol, r.([]any)[2].(string))
			}
			for _, r := range m[theirs].([]any) {
				tl = append(tl, r.([]any)[2].(string))
			}
			if typ == "notes" {
				ol = collapse(ol)
				tl = collapse(tl)
			}
			out = append(out, region(m["region"].(map[string]any), ol, tl)...)
		} else {
			plain = append(plain, el.(string))
		}
	}
	if typ == "verbatim" {
		out = append(out, strsToAnySlice(plain)...)
	} else {
		out = append(out, strsToAnySlice(collapse(plain))...)
	}
	return out
}

func (sm *songMerge) markedChart() [][]any {
	var blocks [][]any
	var openFence []any
	openSet := false
	flush := func() {
		if openSet {
			blocks = append(blocks, fenceAny(openFence, ""))
			openFence = nil
			openSet = false
		}
	}
	partBlock := func(part *Object) []any {
		lines := sm.markedPartLines(part)
		switch objString(part, "type") {
		case "notes":
			return lines
		case "verbatim":
			return fenceAny(lines, objString(part, "info"))
		default:
			return fenceAny(lines, "")
		}
	}
	for _, itemAny := range sm.sectionsOut {
		item := itemAny.([]any)
		if item[0] == "region" {
			flush()
			c := item[1].(map[string]any)
			o := item[2].([]*Object)
			t := item[3].([]*Object)
			sideLines := func(models []*Object) []string {
				var lines []string
				for k, s := range models {
					if k > 0 {
						lines = append(lines, "")
					}
					lines = append(lines, strings.Split(sm.sectionText(s, ""), "\n")...)
				}
				return lines
			}
			blocks = append(blocks, region(c, sideLines(o), sideLines(t)))
			continue
		}
		s := item[1].(*Object)
		var hc map[string]any
		if hcAny, ok := s.Get("_hconflict"); ok && hcAny != nil {
			hc = hcAny.(map[string]any)
		}
		heading := objString(s, "heading")
		if heading == "bracket" || heading == "label" {
			var head string
			if heading == "bracket" {
				head = "[" + headingName(s) + "]"
			} else {
				head = objString(s, "name") + ":"
			}
			body := objArray(s, "body")
			joined := false
			var first []any
			if len(body) > 0 && objString(body[0].(*Object), "type") == "music" {
				first = objArray(body[0].(*Object), "lines")
			}
			if len(first) > 0 {
				if m, ok := first[0].(map[string]any); !ok || !hasRegion(m) {
					line0 := first[0].(*Object)
					if objString(line0, "kind") == "chart" {
						text := chartLineText(line0, sm.dialect())
						if heading == "bracket" && !countRE.MatchString(text) {
							head, joined = head+" "+text, true
						} else if heading == "label" && isChordRun(text, sm.dialect()) {
							head, joined = head+" "+text, true
						}
					}
				}
			}
			if !openSet {
				openFence = []any{head}
				openSet = true
			} else {
				openFence = append(openFence, "", head)
			}
			for idx, pAny := range body {
				part := pAny.(*Object)
				if objString(part, "type") == "music" && idx == 0 {
					p2 := NewObject()
					p2.Set("type", "music")
					ls := objArray(part, "lines")
					if joined {
						p2.Set("lines", append([]any{}, ls[1:]...))
					} else {
						p2.Set("lines", append([]any{}, ls...))
					}
					openFence = append(openFence, sm.markedPartLines(p2)...)
				} else if objString(part, "type") == "music" && len(objArray(part, "lines")) > 0 {
					flush()
					openFence = sm.markedPartLines(part)
					openSet = true
				} else {
					flush()
					blocks = append(blocks, partBlock(part))
				}
			}
			continue
		}
		flush()
		var parts [][]any
		for _, pAny := range objArray(s, "body") {
			parts = append(parts, partBlock(pAny.(*Object)))
		}
		var head []any
		if hc != nil {
			var ol, tl []string
			if hc[ours] != nil {
				ol = []string{hc[ours].(string)}
			}
			if hc[theirs] != nil {
				tl = []string{hc[theirs].(string)}
			}
			head = region(hc, ol, tl)
		} else if heading == "markdown" {
			head = []any{headingLine(2, headingName(s))}
		}
		if len(head) > 0 {
			if len(parts) > 0 {
				parts[0] = append(append([]any{}, head...), parts[0]...)
			} else {
				parts = [][]any{head}
			}
		}
		blocks = append(blocks, parts...)
	}
	flush()
	return blocks
}

func (sm *songMerge) markedVoicings() [][]any {
	var out [][]any
	for _, i := range sm.blockOrder() {
		if cAny, ok := sm.blockConflict.get(i); ok {
			c := cAny.(map[string]any)
			var o, t []string
			if c[ours] != nil {
				o = strings.Split(c[ours].(string), "\n")
			}
			if c[theirs] != nil {
				t = strings.Split(c[theirs].(string), "\n")
			}
			out = append(out, region(c, o, t))
			continue
		}
		pairAny, _ := sm.bname.get(i)
		pair := pairAny.([]any)
		name := pair[0]
		names := pair[1].(map[string]any)
		tuning := sm.spellOf(i).(string)
		var lines []any
		if isConflict(name) {
			var c map[string]any
			for _, x := range sm.conflicts {
				if x["kind"] == "variation" && eqv(x["_block"], i) {
					c = x
					break
				}
			}
			lines = region(c,
				[]string{"## " + labelOr(names[ours], "Voicings") + ": " + tuning},
				[]string{"## " + labelOr(names[theirs], "Voicings") + ": " + tuning})
		} else {
			lines = []any{"## " + labelOr(name, "Voicings") + ": " + tuning}
		}
		type row struct {
			k     any
			lines []any
		}
		var rows []row
		versAny, _ := sm.bvoicings.get(i)
		vers := versAny.(*tmap)
		for _, varr := range vers.keys() {
			eAny, _ := vers.get(varr)
			sym, idx := sm.variantKey(varr.([]any)[0].(string), varr.([]any)[1])
			k := []any{sym, idx}
			if c, ok := eAny.(map[string]any); ok && c["kind"] == "voicing" {
				item := func(v any) []string {
					if v == nil {
						return nil
					}
					return []string{"- " + keyText(k).(string) + ": " + v.(string)}
				}
				rows = append(rows, row{k, region(c, item(c[ours]), item(c[theirs]))})
			} else {
				e := eAny.(*Object)
				rows = append(rows, row{k, []any{"- " + keyText(k).(string) + ": " + voicingText(e).(string)}})
			}
		}
		sort.SliceStable(rows, func(a, b int) bool { return cmp(rows[a].k, rows[b].k) < 0 })
		for _, r := range rows {
			lines = append(lines, r.lines...)
		}
		notesAny, _ := sm.bnotes.get(i)
		for _, pc := range notesAny.([]*piece) {
			if pc.tag == "conflict" {
				var c map[string]any
				for _, x := range sm.conflicts {
					if xp, ok := x["_pc"].(*piece); ok && xp == pc {
						c = x
						break
					}
				}
				var ol, tl []string
				for _, v := range pc.p2.([]any) {
					ol = append(ol, v.(string))
				}
				for _, v := range pc.p3.([]any) {
					tl = append(tl, v.(string))
				}
				lines = append(lines, region(c, ol, tl)...)
			} else if pc.tag == "both" || pc.tag == "common" {
				lines = append(lines, pc.p1.(string))
			} else {
				lines = append(lines, pc.p2.(string))
			}
		}
		out = append(out, lines)
	}
	return out
}
