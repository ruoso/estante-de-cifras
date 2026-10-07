package passkey

import (
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
)

// These unit tests pin the signed begin→finish state codec (refinement
// Decision 3; the opaque `state` the contract returns and echoes,
// api/openapi.yaml:870-901). The codec is pure — no Postgres, a clock it takes
// — so sealing, opening, and the tamper/expiry refusals are tested without a
// stack.

var stateSecret = []byte("a-test-state-secret-32-bytes-xxx")

func sampleSession() *webauthn.SessionData {
	return &webauthn.SessionData{
		Challenge:        "Y2hhbGxlbmdlLWJ5dGVz",
		RelyingPartyID:   "localhost",
		UserID:           []byte{0x01, 0x02, 0x03, 0x04},
		UserVerification: "preferred",
	}
}

// TestSealOpenRoundTrip pins that a sealed SessionData opens back to the same
// value within its lifetime.
func TestSealOpenRoundTrip(t *testing.T) {
	now := time.Now()
	sd := sampleSession()

	state, err := Seal(sd, stateSecret, now, StateTTL)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}

	got, err := Open(state, stateSecret, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("Open: unexpected error: %v", err)
	}
	if got.Challenge != sd.Challenge {
		t.Errorf("Challenge = %q, want %q", got.Challenge, sd.Challenge)
	}
	if got.RelyingPartyID != sd.RelyingPartyID {
		t.Errorf("RelyingPartyID = %q, want %q", got.RelyingPartyID, sd.RelyingPartyID)
	}
	if string(got.UserID) != string(sd.UserID) {
		t.Errorf("UserID = %x, want %x", got.UserID, sd.UserID)
	}
	if got.UserVerification != sd.UserVerification {
		t.Errorf("UserVerification = %q, want %q", got.UserVerification, sd.UserVerification)
	}
}

// TestOpenRejectsTamperedState pins that flipping the payload or the signature
// is rejected (the HMAC binds the blob to the secret).
func TestOpenRejectsTamperedState(t *testing.T) {
	now := time.Now()
	state, err := Seal(sampleSession(), stateSecret, now, StateTTL)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}

	// Change the first character (a full six bits of the payload), so the
	// decoded bytes certainly differ and the HMAC no longer matches. Flipping a
	// trailing base64 character is unreliable — its low bits can be unused
	// padding that decode to the same bytes.
	b := []byte(state)
	if b[0] == 'A' {
		b[0] = 'B'
	} else {
		b[0] = 'A'
	}
	if _, err := Open(string(b), stateSecret, now); err == nil {
		t.Error("Open accepted a tampered payload, want an error")
	}

	// A token minted under a different secret is rejected too.
	if _, err := Open(state, []byte("a-different-secret-entirely-yyyy"), now); err == nil {
		t.Error("Open accepted a token minted under another secret, want an error")
	}
}

// TestOpenRejectsTruncatedOrMalformedState pins that a token missing its
// separator, with bad base64, or empty is rejected rather than panicking.
func TestOpenRejectsTruncatedOrMalformedState(t *testing.T) {
	now := time.Now()
	for _, s := range []string{"", "no-separator", "!!!.$$$", "onlyonepart."} {
		if _, err := Open(s, stateSecret, now); err == nil {
			t.Errorf("Open(%q) = nil error, want rejection", s)
		}
	}
}

// TestOpenRejectsExpiredState pins the short expiry (refinement Decision 3): a
// handle opened at or after its sealed expiry is rejected.
func TestOpenRejectsExpiredState(t *testing.T) {
	now := time.Now()
	state, err := Seal(sampleSession(), stateSecret, now, StateTTL)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	if _, err := Open(state, stateSecret, now.Add(StateTTL+time.Second)); err == nil {
		t.Error("Open accepted an expired handle, want an error")
	}
}
