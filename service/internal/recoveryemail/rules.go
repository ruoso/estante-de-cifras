// Package recoveryemail is the pure, database-free core of the recovery email
// (workflow 13 §The recovery email): how an address is normalised before it is
// stored or compared, and what opening a verification link decides. The token
// itself is the emailed sign-in link's (emaillink.NewID/Mint/Parse, the same
// LinkLifetime); the stateful enforcement is the confirm's transaction, which
// locks the row and acts on the Outcome Decide returns. Nothing here touches
// Postgres, a clock it does not take, or a mailer, so the rules are unit-tested
// without a stack (service.recovery_email refinement).
package recoveryemail

import (
	"errors"
	"net/mail"
	"strings"
	"time"
)

// ErrMalformed is the one detail-free error Normalize returns: the address does
// not parse. It never carries the address (workflow 13, "never logged").
var ErrMalformed = errors.New("recoveryemail: the address is not well-formed")

// Normalize trims the address, parses it as a single RFC 5322 address and
// returns its bare addr-spec lowercased — the form stored in
// recovery_email_links.address and accounts.email, and compared with
// lower(email), so one mailbox is one address (Constraint 5).
func Normalize(address string) (string, error) {
	parsed, err := mail.ParseAddress(strings.TrimSpace(address))
	if err != nil {
		return "", ErrMalformed
	}
	return strings.ToLower(parsed.Address), nil
}

// Row is the stored verification link Decide reasons about: the address it
// would confirm, when it expires, and whether it has been used.
type Row struct {
	Address    string
	ExpiresAt  time.Time
	ConsumedAt *time.Time
}

// Outcome is what opening a verification link does.
type Outcome int

const (
	// Confirm — a live link for an address no other account holds: the address
	// becomes the account's email. No notice: there was no confirmed address,
	// or it was this same one.
	Confirm Outcome = iota
	// ConfirmChange — as Confirm, but a different confirmed address was in
	// effect: it is replaced, and the old address gets the link-less notice
	// (workflow 13 §Changing it).
	ConfirmChange
	// Expired — the link is past its fifteen minutes.
	Expired
	// Consumed — the link was already used once.
	Consumed
	// Taken — a live link for an address another account holds: refused, the
	// account's email unchanged (workflow 13 §Who holds an address).
	Taken
)

// Decide is the confirm's rule. A used link is Consumed and an out-of-date one
// Expired, checked before anything about the address, so a dead link never
// discloses who holds an address (refinement Decision *Taken is checked only
// for a live link*). A live link whose address another account holds is Taken.
// Otherwise it confirms — as a change when current, the account's confirmed
// email (empty for none), is a different address.
func Decide(row Row, now time.Time, heldByOther bool, current string) Outcome {
	if row.ConsumedAt != nil {
		return Consumed
	}
	if !now.Before(row.ExpiresAt) {
		return Expired
	}
	if heldByOther {
		return Taken
	}
	if current != "" && !strings.EqualFold(current, row.Address) {
		return ConfirmChange
	}
	return Confirm
}
