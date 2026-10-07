package hook

// Unit test for the object-reachability layer's pure parts — no git, no DB.
// Pins workflow 14 "No stowaways" (docs/workflows/14-file-view.md:98-101) as
// pure logic: the object-list parsing both git commands produce, and the
// three-set determination "quarantined minus introduced minus already-had"
// ("One object more, and the push is refused"; "excluding what the repository
// already had"). The reachability and enumeration themselves need real git and
// a real quarantine, so they live at the behavior level
// (cmd/pre-receive/stowaways_test.go).

import (
	"reflect"
	"sort"
	"strings"
	"testing"
)

func keys(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// TestParseRevListObjects pins (1): `git rev-list --objects` output — bare
// "<sha>" lines (commits), "<sha> SP <path>" lines (trees and blobs), and blank
// lines — parses into an object-name set keyed on the first field, the path
// discarded.
func TestParseRevListObjects(t *testing.T) {
	const commit = "1111111111111111111111111111111111111111"
	const tree = "2222222222222222222222222222222222222222"
	const blob = "3333333333333333333333333333333333333333"
	in := commit + "\n" +
		tree + " \n" + // a tree whose path git prints empty
		blob + " a-cancao.cifra.md\n" +
		"\n" // a trailing blank line
	got, err := ParseRevListObjects(strings.NewReader(in))
	if err != nil {
		t.Fatalf("ParseRevListObjects: %v", err)
	}
	want := []string{commit, tree, blob}
	sort.Strings(want)
	if gotKeys := keys(got); !reflect.DeepEqual(gotKeys, want) {
		t.Errorf("object set = %v, want %v", gotKeys, want)
	}
}

// TestParseObjectNames pins (2): `cat-file --batch-check='%(objectname)'`
// output — one sha per line — parses into a set; blank lines are ignored.
func TestParseObjectNames(t *testing.T) {
	const a = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	const b = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	const c = "cccccccccccccccccccccccccccccccccccccccc"
	in := a + "\n" + b + "\n\n" + c + "\n"
	got, err := ParseObjectNames(strings.NewReader(in))
	if err != nil {
		t.Fatalf("ParseObjectNames: %v", err)
	}
	want := []string{a, b, c}
	sort.Strings(want)
	if gotKeys := keys(got); !reflect.DeepEqual(gotKeys, want) {
		t.Errorf("object set = %v, want %v", gotKeys, want)
	}
}

// set is a tiny constructor for the three-set determination cases.
func set(names ...string) map[string]struct{} {
	m := make(map[string]struct{}, len(names))
	for _, n := range names {
		m[n] = struct{}{}
	}
	return m
}

// TestStowawayReason pins (3): the determination over three sets.
func TestStowawayReason(t *testing.T) {
	const commit = "1111111111111111111111111111111111111111"
	const tree = "2222222222222222222222222222222222222222"
	const blob = "3333333333333333333333333333333333333333"
	const stowaway = "4444444444444444444444444444444444444444"
	const existing = "5555555555555555555555555555555555555555"

	t.Run("no surplus accepts (every quarantined object is introduced)", func(t *testing.T) {
		quarantined := set(commit, tree, blob)
		introduced := set(commit, tree, blob)
		if reason := StowawayReason(quarantined, introduced, nil); reason != "" {
			t.Errorf("reason = %q, want accepted (empty)", reason)
		}
	})

	t.Run("a redundant re-send the repository already had is not a stowaway", func(t *testing.T) {
		// The quarantine carries one object outside the introduced set, but the
		// repository already had it (a non-thin re-send) — permitted by
		// "excluding what the repository already had".
		quarantined := set(commit, tree, blob, existing)
		introduced := set(commit, tree, blob)
		alreadyHad := set(existing)
		if reason := StowawayReason(quarantined, introduced, alreadyHad); reason != "" {
			t.Errorf("reason = %q, want accepted (empty)", reason)
		}
	})

	t.Run("one object more is refused, the count named", func(t *testing.T) {
		quarantined := set(commit, tree, blob, stowaway)
		introduced := set(commit, tree, blob)
		reason := StowawayReason(quarantined, introduced, nil)
		if reason == "" {
			t.Fatal("reason = empty, want a refusal naming the surplus")
		}
		if !strings.Contains(reason, "1 object") {
			t.Errorf("reason = %q, want it to name the count (1 object)", reason)
		}
		if !strings.Contains(reason, "stowaway") {
			t.Errorf("reason = %q, want it to name the stowaway fault", reason)
		}
		// The ids themselves are never reported (content SHAs, not song text,
		// but the contract is: count only).
		if strings.Contains(reason, stowaway) {
			t.Errorf("reason = %q, should not list object ids, only the count", reason)
		}
	})

	t.Run("several stowaways are counted together", func(t *testing.T) {
		const second = "6666666666666666666666666666666666666666"
		quarantined := set(commit, tree, blob, stowaway, second, existing)
		introduced := set(commit, tree, blob)
		alreadyHad := set(existing) // the re-send is excused, the two stowaways are not
		reason := StowawayReason(quarantined, introduced, alreadyHad)
		if !strings.Contains(reason, "2 object") {
			t.Errorf("reason = %q, want it to name 2 objects", reason)
		}
	})
}
