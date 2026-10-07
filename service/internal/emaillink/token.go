// Package emaillink is the pure, database-free core of the emailed sign-in
// link (workflow 13, the WebAuthn fallback and account-recovery path). It mints
// and verifies the signed token a link carries and decides a stored link's
// state (fresh, expired, consumed). Everything here is a pure function of its
// inputs — no Postgres, no clock it does not take, no net/smtp — so the signing,
// expiry and single-use *decision* logic is unit-tested without a stack
// (service.email_links refinement, Decisions). The stateful *enforcement* of
// single-use is the atomic UPDATE the server runs against email_login_links;
// CheckState mirrors that guard for the unit level.
package emaillink

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
	"time"
)

// LinkLifetime is how long a minted link stays redeemable. Workflow 13 says
// "short-lived" without a number; 15 minutes is the common magic-link default,
// and one value keeps the fallback and recovery paths identical (refinement
// Decisions — a config knob is easy to add later if a real need appears).
const LinkLifetime = 15 * time.Minute

// enc is base64url without padding, so a token is a single URL path segment
// (no '/', '+' or '=') that drops cleanly into ${PUBLIC_BASE_URL}/sign-in/<token>.
// Decoding is strict: a RawURLEncoding token's final symbol carries leftover
// padding bits the lenient decoder silently discards, so without Strict two
// distinct token strings (e.g. a signature ending 'A' vs 'B') decode to the same
// bytes and both verify — token malleability. Strict rejects any non-canonical
// encoding, so only the exact minted string is accepted. Encoding is unaffected.
var enc = base64.RawURLEncoding.Strict()

// NewID returns a fresh, opaque link id: 128 bits of randomness as hex. It is
// the email_login_links primary key and the value the token signs; it is never
// the secret, so a database leak of the id yields no usable link without the
// server's signing key (refinement Decisions).
func NewID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

// Mint builds the token a link carries: base64url(id) || "." ||
// base64url(HMAC-SHA256(secret, id)). The id is opaque and stored in the row;
// the HMAC binds it to the server secret so a token cannot be forged or its id
// swapped without the key (refinement Decisions).
func Mint(id string, secret []byte) string {
	return enc.EncodeToString([]byte(id)) + "." + enc.EncodeToString(sign(id, secret))
}

// Parse verifies a token against the secret and returns the id it carries. It
// recomputes the HMAC and compares in constant time (crypto/hmac.Equal), so a
// tampered signature or a token minted under a different secret is rejected
// (ok == false) and no timing distinguishes them. A malformed token — wrong
// shape, bad base64 — is rejected the same way.
func Parse(token string, secret []byte) (id string, ok bool) {
	idPart, sigPart, found := strings.Cut(token, ".")
	if !found {
		return "", false
	}
	idBytes, err := enc.DecodeString(idPart)
	if err != nil {
		return "", false
	}
	sig, err := enc.DecodeString(sigPart)
	if err != nil {
		return "", false
	}
	if !hmac.Equal(sig, sign(string(idBytes), secret)) {
		return "", false
	}
	return string(idBytes), true
}

// sign is the HMAC-SHA256 of the id under the secret.
func sign(id string, secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(id))
	return mac.Sum(nil)
}

// State is a stored link's redeemability at a moment in time.
type State int

const (
	// Fresh — unconsumed and unexpired: redeemable.
	Fresh State = iota
	// Expired — past its expires_at: refused.
	Expired
	// Consumed — already redeemed once: refused (single-use).
	Consumed
)

// Link is the stored row CheckState reasons about: when it expires and whether
// it has been consumed. ConsumedAt is nil until the first redeem.
type Link struct {
	ID         string
	AccountID  string
	ExpiresAt  time.Time
	ConsumedAt *time.Time
}

// CheckState is the pure decision the atomic redeem UPDATE encodes: a link is
// Consumed once consumed_at is set (checked first, so a reused link is reported
// as reused even past its expiry), Expired once now is at or past expires_at,
// and Fresh otherwise. The server relies on the single atomic UPDATE for the
// race-free enforcement; this mirrors its guard for the unit level (refinement
// Decisions).
func CheckState(l Link, now time.Time) State {
	if l.ConsumedAt != nil {
		return Consumed
	}
	if !now.Before(l.ExpiresAt) {
		return Expired
	}
	return Fresh
}
