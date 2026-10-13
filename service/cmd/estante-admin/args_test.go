package main

import (
	"testing"

	"estantedecifras.app/service/internal/admin"
)

// a stable, valid UUID for the book-id argument.
const testBookID = "123e4567-e89b-12d3-a456-426614174000"

// TestParseArgsValid pins the command contract (refinement Constraints §1): the
// three subcommands parse to their admin.Action, with the book id and reason —
// and the three actions it accepts are exactly the book_notices.action CHECK of
// migration 0004. Pins the unit-level acceptance criterion.
func TestParseArgsValid(t *testing.T) {
	cases := []struct {
		subcommand string
		want       admin.Action
	}{
		{"take-down", admin.ActionTakeDown},
		{"withdraw-invitations", admin.ActionWithdrawInvitations},
		{"remove-members", admin.ActionRemoveMembers},
	}
	for _, c := range cases {
		t.Run(c.subcommand, func(t *testing.T) {
			got, err := parseArgs([]string{c.subcommand, testBookID, "--reason", "a copyright notice"})
			if err != nil {
				t.Fatalf("parseArgs returned error: %v", err)
			}
			if got.action != c.want {
				t.Errorf("action = %q, want %q", got.action, c.want)
			}
			if got.bookID != testBookID {
				t.Errorf("bookID = %q, want %q", got.bookID, testBookID)
			}
			if got.reason != "a copyright notice" {
				t.Errorf("reason = %q, want %q", got.reason, "a copyright notice")
			}
		})
	}
}

// TestParseArgsReasonEquals accepts --reason=<text> as well as --reason <text>.
func TestParseArgsReasonEquals(t *testing.T) {
	got, err := parseArgs([]string{"take-down", testBookID, "--reason=DMCA 2026-10"})
	if err != nil {
		t.Fatalf("parseArgs returned error: %v", err)
	}
	if got.reason != "DMCA 2026-10" {
		t.Errorf("reason = %q, want %q", got.reason, "DMCA 2026-10")
	}
}

// TestParseArgsInvalid pins the refusals: an unknown action, a missing book id, a
// non-UUID book id, and a missing or empty --reason each return an error and no
// command (refinement Constraints §1 — "changes nothing").
func TestParseArgsInvalid(t *testing.T) {
	cases := []struct {
		name string
		argv []string
	}{
		{"no args", nil},
		{"unknown action", []string{"delete-everything", testBookID, "--reason", "x"}},
		{"missing book id", []string{"take-down", "--reason", "x"}},
		{"non-uuid book id", []string{"take-down", "not-a-uuid", "--reason", "x"}},
		{"missing reason", []string{"take-down", testBookID}},
		{"empty reason", []string{"take-down", testBookID, "--reason", ""}},
		{"empty reason equals", []string{"take-down", testBookID, "--reason="}},
		{"reason without value", []string{"take-down", testBookID, "--reason"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := parseArgs(c.argv); err == nil {
				t.Errorf("parseArgs(%q) = nil error, want an error", c.argv)
			}
		})
	}
}
