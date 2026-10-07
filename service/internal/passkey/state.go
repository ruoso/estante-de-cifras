package passkey

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
)

// The begin→finish state is a stateless, HMAC-signed, short-lived token, not a
// server-side SessionData store (refinement Decision 3). It seals go-webauthn's
// SessionData — the challenge, the user handle, the allowed credentials, the UV
// flag — into the opaque handle the contract returns from begin
// (CredentialCreationOptions.state) and echoes to finish, verified and
// expiry-checked there. This mirrors emaillink.Mint/Parse: the signature binds
// the blob to the server secret so it cannot be forged or edited, and a short
// expiry bounds replay. No Postgres row, no sweeper (DIRECTION §3.4).

// enc is base64url without padding so a state token is a single opaque string
// with no characters that need escaping in JSON.
var enc = base64.RawURLEncoding

// errBadState is the single, detail-free error Open returns for every rejected
// state — tampered, truncated, malformed or expired — so a caller cannot
// distinguish them and nothing about the secret leaks.
var errBadState = errors.New("passkey: the state token is not valid")

// sealed is the envelope the state token carries: the go-webauthn SessionData
// and an explicit expiry (unix seconds). The expiry is sealed inside the signed
// blob so it cannot be extended without the key.
type sealed struct {
	Session webauthn.SessionData `json:"s"`
	Exp     int64                `json:"e"`
}

// Seal signs sd into a state token that expires ttl from now:
// base64url(payload) || "." || base64url(HMAC-SHA256(payload)). The payload is
// the SessionData and the absolute expiry.
func Seal(sd *webauthn.SessionData, secret []byte, now time.Time, ttl time.Duration) (string, error) {
	payload, err := json.Marshal(sealed{Session: *sd, Exp: now.Add(ttl).Unix()})
	if err != nil {
		return "", err
	}
	return enc.EncodeToString(payload) + "." + enc.EncodeToString(sign(payload, secret)), nil
}

// Open verifies a state token against secret and returns the sealed
// SessionData. It recomputes the HMAC and compares in constant time, then
// checks the sealed expiry against now. A tampered signature, a truncated or
// malformed token, a token minted under another secret, or an expired one is
// rejected with errBadState and no detail.
func Open(state string, secret []byte, now time.Time) (*webauthn.SessionData, error) {
	payloadPart, sigPart, found := strings.Cut(state, ".")
	if !found {
		return nil, errBadState
	}
	payload, err := enc.DecodeString(payloadPart)
	if err != nil {
		return nil, errBadState
	}
	sig, err := enc.DecodeString(sigPart)
	if err != nil {
		return nil, errBadState
	}
	if !hmac.Equal(sig, sign(payload, secret)) {
		return nil, errBadState
	}
	var s sealed
	if err := json.Unmarshal(payload, &s); err != nil {
		return nil, errBadState
	}
	if now.Unix() >= s.Exp {
		return nil, errBadState
	}
	return &s.Session, nil
}

// sign is the HMAC-SHA256 of payload under secret.
func sign(payload, secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	return mac.Sum(nil)
}
