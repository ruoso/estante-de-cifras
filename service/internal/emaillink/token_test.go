package emaillink

import (
	"testing"
	"time"
)

// Pins the .tji note's unit clause "signing, expiry, single use": Mint/Parse
// round-trip, a flipped signature byte and a wrong secret rejected, and
// CheckState's fresh/expired/consumed decision (service.email_links
// refinement, unit level).

var testSecret = []byte("a-test-signing-secret")

// TestMintParseRoundTrip pins that a token minted for an id verifies back to
// exactly that id under the same secret.
func TestMintParseRoundTrip(t *testing.T) {
	id, err := NewID()
	if err != nil {
		t.Fatalf("NewID: %v", err)
	}
	token := Mint(id, testSecret)

	got, ok := Parse(token, testSecret)
	if !ok {
		t.Fatal("Parse rejected a freshly minted token, want ok")
	}
	if got != id {
		t.Errorf("Parse id = %q, want %q", got, id)
	}
}

// TestParseRejectsFlippedSignatureByte pins that tampering with the signature
// is caught: the token no longer verifies.
func TestParseRejectsFlippedSignatureByte(t *testing.T) {
	id, err := NewID()
	if err != nil {
		t.Fatalf("NewID: %v", err)
	}
	token := Mint(id, testSecret)

	// Flip the final character of the signature half; it stays valid base64url
	// (a different symbol), so this exercises the HMAC check, not the decoder.
	b := []byte(token)
	last := b[len(b)-1]
	if last == 'A' {
		b[len(b)-1] = 'B'
	} else {
		b[len(b)-1] = 'A'
	}
	if _, ok := Parse(string(b), testSecret); ok {
		t.Error("Parse accepted a token with a flipped signature byte, want rejection")
	}
}

// TestParseRejectsWrongSecret pins that a token minted under one secret does
// not verify under another — the secret is what makes a link unforgeable.
func TestParseRejectsWrongSecret(t *testing.T) {
	id, err := NewID()
	if err != nil {
		t.Fatalf("NewID: %v", err)
	}
	token := Mint(id, testSecret)

	if _, ok := Parse(token, []byte("a-different-secret")); ok {
		t.Error("Parse accepted a token under a different secret, want rejection")
	}
}

// TestParseRejectsMalformedToken pins that a token of the wrong shape or with
// undecodable halves is rejected rather than panicking.
func TestParseRejectsMalformedToken(t *testing.T) {
	for _, bad := range []string{"", "no-dot", ".", "!!!.###", Mint("x", testSecret) + ".extra"} {
		if _, ok := Parse(bad, testSecret); ok {
			t.Errorf("Parse(%q) = ok, want rejection", bad)
		}
	}
}

// TestCheckState pins the pure fresh/expired/consumed decision CheckState
// makes — the single-use and expiry logic mirrored for the unit level.
func TestCheckState(t *testing.T) {
	now := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)
	consumed := now.Add(-time.Minute)

	cases := []struct {
		name string
		link Link
		want State
	}{
		{"fresh before expiry", Link{ExpiresAt: now.Add(time.Minute)}, Fresh},
		{"expired after expiry", Link{ExpiresAt: now.Add(-time.Minute)}, Expired},
		{"expired exactly at expiry", Link{ExpiresAt: now}, Expired},
		{"consumed is consumed", Link{ExpiresAt: now.Add(time.Minute), ConsumedAt: &consumed}, Consumed},
		{"consumed takes precedence over expired", Link{ExpiresAt: now.Add(-time.Minute), ConsumedAt: &consumed}, Consumed},
	}
	for _, c := range cases {
		if got := CheckState(c.link, now); got != c.want {
			t.Errorf("%s: CheckState = %d, want %d", c.name, got, c.want)
		}
	}
}
