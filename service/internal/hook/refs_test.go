package hook

import (
	"strings"
	"testing"
)

// TestCheckStructure pins the pure refs-and-history classification — no git, no
// DB — against workflow 14 "One ref." (docs/workflows/14-file-view.md:94-95)
// and the no-deletion clause: refs/heads/main is the only accepted ref name,
// every other ref is rejected by name, the all-zero new value is a deletion,
// and the all-zero old value is a creation (ancestry not required).
func TestCheckStructure(t *testing.T) {
	const sha = "1111111111111111111111111111111111111111"
	const sha2 = "2222222222222222222222222222222222222222"

	cases := []struct {
		name         string
		u            RefUpdate
		wantReason   string // substring; "" = accepted so far
		wantAncestry bool
	}{
		{
			name: "update to main needs an ancestry check",
			u:    RefUpdate{Old: sha, New: sha2, Ref: MainRef},
			// Structurally fine; the fast-forward test decides acceptance.
			wantReason:   "",
			wantAncestry: true,
		},
		{
			name:         "initial creation of main is accepted without ancestry",
			u:            RefUpdate{Old: ZeroSHA, New: sha, Ref: MainRef},
			wantReason:   "",
			wantAncestry: false,
		},
		{
			name:         "deletion of main is refused",
			u:            RefUpdate{Old: sha, New: ZeroSHA, Ref: MainRef},
			wantReason:   "deleting the branch is not allowed",
			wantAncestry: false,
		},
		{
			name:         "a tag is refused by name",
			u:            RefUpdate{Old: ZeroSHA, New: sha, Ref: "refs/tags/v1"},
			wantReason:   "refs/tags/v1: only refs/heads/main",
			wantAncestry: false,
		},
		{
			name:         "a note is refused by name",
			u:            RefUpdate{Old: ZeroSHA, New: sha, Ref: "refs/notes/commits"},
			wantReason:   "refs/notes/commits: only refs/heads/main",
			wantAncestry: false,
		},
		{
			name:         "another branch is refused by name",
			u:            RefUpdate{Old: ZeroSHA, New: sha, Ref: "refs/heads/draft"},
			wantReason:   "refs/heads/draft: only refs/heads/main",
			wantAncestry: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			reason, needsAncestry := CheckStructure(tc.u)
			if tc.wantReason == "" {
				if reason != "" {
					t.Errorf("reason = %q, want accepted (empty)", reason)
				}
			} else if !strings.Contains(reason, tc.wantReason) {
				t.Errorf("reason = %q, want it to contain %q", reason, tc.wantReason)
			}
			if needsAncestry != tc.wantAncestry {
				t.Errorf("needsAncestry = %v, want %v", needsAncestry, tc.wantAncestry)
			}
		})
	}
}

// TestParseUpdates pins the stdin parser: well-formed lines split into triples,
// every line is consumed, and a malformed line is an error.
func TestParseUpdates(t *testing.T) {
	const a = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	const b = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

	t.Run("several well-formed lines become triples", func(t *testing.T) {
		in := a + " " + b + " refs/heads/main\n" +
			ZeroSHA + " " + a + " refs/tags/v1\n"
		got, err := ParseUpdates(strings.NewReader(in))
		if err != nil {
			t.Fatalf("ParseUpdates: %v", err)
		}
		want := []RefUpdate{
			{Old: a, New: b, Ref: "refs/heads/main"},
			{Old: ZeroSHA, New: a, Ref: "refs/tags/v1"},
		}
		if len(got) != len(want) {
			t.Fatalf("got %d updates, want %d", len(got), len(want))
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("update %d = %+v, want %+v", i, got[i], want[i])
			}
		}
	})

	t.Run("a malformed line is an error", func(t *testing.T) {
		for _, in := range []string{
			a + " refs/heads/main\n",             // only two fields
			a + " " + b + "\n",                   // missing ref
			a + " " + b + " refs/heads/main x\n", // a stray fourth field
		} {
			if _, err := ParseUpdates(strings.NewReader(in)); err == nil {
				t.Errorf("ParseUpdates(%q) = nil error, want a malformed-input error", in)
			}
		}
	})
}
