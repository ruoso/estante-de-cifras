// Package passkey is the go-webauthn wiring for passkey sign-in: the relying
// party configuration (RP ID and origins, the passkey-standard authenticator
// selection), the webauthn.User adapter over the accounts/passkeys registry
// rows, the credential (de)serialisation onto the passkeys columns, and the
// stateless begin→finish state codec.
//
// It owns the service's WebAuthn policy (DIRECTION §3.3 "a passkey for the one
// domain", §3.6 line 314 "go-webauthn for passkeys") and nothing about HTTP or
// the database: the server package calls BeginRegistration/FinishRegistration
// and BeginDiscoverableLogin/ValidateDiscoverableLogin through the embedded
// *webauthn.WebAuthn, seals the returned SessionData into the opaque state the
// contract echoes, and maps credentials onto the registry rows. Keeping the
// transient challenge in a signed, short-lived state token rather than a
// server-side session table matches the stateless tier (DIRECTION §3.4;
// refinement Decision 3) — Seal/Open mirror emaillink.Mint/Parse.
package passkey

import (
	"fmt"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

// StateTTL is how long a begin→finish state token stays valid: a passkey
// ceremony is finished in seconds, so a short expiry bounds replay without a
// server-side store (refinement Decision 3). It is sealed into the state and
// also set as the go-webauthn SessionData expiry, so both layers agree.
const StateTTL = 5 * time.Minute

// rpDisplayName is the Relying Party display name shown by some authenticator
// UIs. Fixed, per refinement Decision 5.
const rpDisplayName = "Estante de Cifras"

// Config is the passkey subsystem's configuration: the WebAuthn relying party
// (RP ID and the permitted origins) and the HMAC key the state codec signs
// with. RP ID and origins are config-driven because production is
// estantedecifras.app while dev and the e2e stack run on 127.0.0.1/localhost;
// a hard-coded or Host-derived RP ID would fail origin validation on one of
// them (refinement Decision 5).
type Config struct {
	// RPID is the effective domain the passkey is bound to (ESTANTE_WEBAUTHN_RP_ID).
	RPID string
	// RPOrigins are the permitted ceremony origins (derived from the public base URL).
	RPOrigins []string
	// StateSecret is the HMAC key the begin→finish state token is signed with
	// (ESTANTE_WEBAUTHN_STATE_SECRET); single-purpose, never reused for the
	// emailed-link secret (refinement Decision 4).
	StateSecret []byte
}

// RP is the configured relying party: the go-webauthn instance plus the state
// codec's signing key. The server package holds one and uses it across every
// passkey handler.
type RP struct {
	wa     *webauthn.WebAuthn
	secret []byte
}

// New builds the relying party from cfg. The authenticator selection is the
// passkey standard (refinement Decision 6): a client-side discoverable
// (resident) credential is required — authenticate/begin sends no username, so
// the credential must be discoverable — user verification is preferred (a
// platform authenticator verifies with face or finger, but a roaming key
// without a UV gesture is not locked out), and attestation is none (we store
// no attestation statement and want no device fingerprinting). The ceremony
// timeouts match StateTTL so go-webauthn's own expiry agrees with the sealed
// state's.
func New(cfg Config) (*RP, error) {
	if cfg.RPID == "" {
		return nil, fmt.Errorf("passkey: RP ID is required")
	}
	if len(cfg.RPOrigins) == 0 {
		return nil, fmt.Errorf("passkey: at least one RP origin is required")
	}
	if len(cfg.StateSecret) == 0 {
		return nil, fmt.Errorf("passkey: a state secret is required")
	}

	rrk := true
	wa, err := webauthn.New(&webauthn.Config{
		RPID:                  cfg.RPID,
		RPDisplayName:         rpDisplayName,
		RPOrigins:             cfg.RPOrigins,
		AttestationPreference: protocol.PreferNoAttestation,
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			RequireResidentKey: &rrk,
			ResidentKey:        protocol.ResidentKeyRequirementRequired,
			UserVerification:   protocol.VerificationPreferred,
		},
		Timeouts: webauthn.TimeoutsConfig{
			Login: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    StateTTL,
				TimeoutUVD: StateTTL,
			},
			Registration: webauthn.TimeoutConfig{
				Enforce:    true,
				Timeout:    StateTTL,
				TimeoutUVD: StateTTL,
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("passkey: building the relying party: %w", err)
	}
	return &RP{wa: wa, secret: cfg.StateSecret}, nil
}

// WebAuthn exposes the underlying relying party for the begin/finish ceremony
// calls the server handlers make.
func (rp *RP) WebAuthn() *webauthn.WebAuthn { return rp.wa }

// Seal signs sd into the opaque state token the contract returns from a begin
// call and echoes back to finish (CredentialCreationOptions/RequestOptions
// `state`, api/openapi.yaml:883-901). now is the clock (injected for tests).
func (rp *RP) Seal(sd *webauthn.SessionData, now time.Time) (string, error) {
	return Seal(sd, rp.secret, now, StateTTL)
}

// Open verifies a state token and returns the sealed SessionData, or an error
// when it is tampered, malformed or expired.
func (rp *RP) Open(state string, now time.Time) (*webauthn.SessionData, error) {
	return Open(state, rp.secret, now)
}

// SealFor seals sd for a named purpose (PurposeDeleteAccount); only OpenFor
// with the same purpose opens it.
func (rp *RP) SealFor(purpose string, sd *webauthn.SessionData, now time.Time) (string, error) {
	return SealFor(purpose, sd, rp.secret, now, StateTTL)
}

// OpenFor verifies a state token sealed for purpose and returns its
// SessionData, or an error when it is tampered, malformed, expired or sealed
// for another purpose.
func (rp *RP) OpenFor(purpose, state string, now time.Time) (*webauthn.SessionData, error) {
	return OpenFor(purpose, state, rp.secret, now)
}
