package recoveryemail

import (
	"testing"
	"time"

	"estantedecifras.app/service/internal/emaillink"
)

// These unit tests pin the verification token rules of workflow 13 §The
// recovery email — single use, fifteen minutes (emaillink.LinkLifetime), one
// account per address, the change notice — and the order that keeps a dead
// link from disclosing who holds an address (service.recovery_email
// refinement, unit level; the .tji "unit (verification token rules)").

func TestDecide(t *testing.T) {
	minted := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	fresh := Row{Address: "new@estante.test", ExpiresAt: minted.Add(emaillink.LinkLifetime)}
	used := minted.Add(time.Minute)
	consumed := fresh
	consumed.ConsumedAt = &used
	within := minted.Add(time.Minute)
	atExpiry := minted.Add(emaillink.LinkLifetime)

	cases := []struct {
		name        string
		row         Row
		now         time.Time
		heldByOther bool
		current     string
		want        Outcome
	}{
		{"fresh, no current email", fresh, within, false, "", Confirm},
		{"fresh, a different current email", fresh, within, false, "old@estante.test", ConfirmChange},
		{"fresh, the same current email", fresh, within, false, "new@estante.test", Confirm},
		{"fresh, the same current email in another case", fresh, within, false, "NEW@estante.test", Confirm},
		{"expired at exactly LinkLifetime", fresh, atExpiry, false, "", Expired},
		{"consumed", consumed, within, false, "", Consumed},
		{"held by another account", fresh, within, true, "", Taken},
		{"taken wins over a change", fresh, within, true, "old@estante.test", Taken},
		{"expired wins over taken", fresh, atExpiry, true, "", Expired},
		{"consumed wins over taken", consumed, within, true, "", Consumed},
		{"consumed wins over expired", consumed, atExpiry, false, "", Consumed},
	}
	for _, c := range cases {
		if got := Decide(c.row, c.now, c.heldByOther, c.current); got != c.want {
			t.Errorf("%s: Decide = %d, want %d", c.name, got, c.want)
		}
	}
}

func TestNormalize(t *testing.T) {
	for in, want := range map[string]string{
		"Player@Estante.Test":          "player@estante.test",
		"  player@estante.test \t":     "player@estante.test",
		"Player <PLAYER@estante.test>": "player@estante.test",
	} {
		got, err := Normalize(in)
		if err != nil {
			t.Errorf("Normalize(%q): unexpected error %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("Normalize(%q) = %q, want %q", in, got, want)
		}
	}
	for _, bad := range []string{"", "   ", "not-an-address", "@estante.test", "a@b@c"} {
		if _, err := Normalize(bad); err == nil {
			t.Errorf("Normalize(%q): want an error, got none", bad)
		}
	}
}
