package passkey

import (
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"estantedecifras.app/service/internal/webauthntest"
)

// These unit tests pin "the go-webauthn wiring with a software authenticator"
// (the .tji note; DIRECTION §3.6 line 314): the relying-party config builder,
// and a begin→finish ceremony driven end-to-end by the Go software
// authenticator (ES256, `none` attestation) with no database.

const (
	testRPID     = "localhost"
	testOrigin   = "https://localhost"
	testRPSecret = "a-unit-test-state-secret-xxxxxxx"
)

func newTestRP(t *testing.T) *RP {
	t.Helper()
	rp, err := New(Config{
		RPID:        testRPID,
		RPOrigins:   []string{testOrigin},
		StateSecret: []byte(testRPSecret),
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return rp
}

// TestNewConfiguresRelyingParty pins the config builder: the RP ID and origins
// come from config, with the passkey-standard selection (resident key required,
// user verification preferred, attestation none — refinement Decision 6).
func TestNewConfiguresRelyingParty(t *testing.T) {
	rp := newTestRP(t)
	cfg := rp.WebAuthn().Config

	if cfg.RPID != testRPID {
		t.Errorf("RPID = %q, want %q", cfg.RPID, testRPID)
	}
	if len(cfg.RPOrigins) != 1 || cfg.RPOrigins[0] != testOrigin {
		t.Errorf("RPOrigins = %v, want [%q]", cfg.RPOrigins, testOrigin)
	}
	if cfg.AttestationPreference != protocol.PreferNoAttestation {
		t.Errorf("AttestationPreference = %q, want none", cfg.AttestationPreference)
	}
	if cfg.AuthenticatorSelection.ResidentKey != protocol.ResidentKeyRequirementRequired {
		t.Errorf("ResidentKey = %q, want required", cfg.AuthenticatorSelection.ResidentKey)
	}
	if cfg.AuthenticatorSelection.UserVerification != protocol.VerificationPreferred {
		t.Errorf("UserVerification = %q, want preferred", cfg.AuthenticatorSelection.UserVerification)
	}
}

// TestNewRejectsIncompleteConfig pins that a missing RP ID, origin or state
// secret is refused (fail-fast, no guessed values).
func TestNewRejectsIncompleteConfig(t *testing.T) {
	cases := []Config{
		{RPOrigins: []string{testOrigin}, StateSecret: []byte("s")},
		{RPID: testRPID, StateSecret: []byte("s")},
		{RPID: testRPID, RPOrigins: []string{testOrigin}},
	}
	for i, c := range cases {
		if _, err := New(c); err == nil {
			t.Errorf("case %d: New accepted an incomplete config, want an error", i)
		}
	}
}

// TestRegisterThenAuthenticate pins the full ceremony with the software
// authenticator: a registration yields a verifiable credential, and an
// assertion against it verifies.
func TestRegisterThenAuthenticate(t *testing.T) {
	rp := newTestRP(t)
	auth := webauthntest.New(testOrigin)

	user := userWithCreds(t, nil)
	cred := registerFor(t, rp, auth, user)

	// Sign in with the registered credential via discoverable login. The login
	// user is the same account (same handle) that registered the credential.
	user.Creds = []webauthn.Credential{*cred}
	assertion, sd, err := rp.WebAuthn().BeginDiscoverableLogin()
	if err != nil {
		t.Fatalf("BeginDiscoverableLogin: %v", err)
	}
	assertJSON, err := auth.Get(assertion)
	if err != nil {
		t.Fatalf("authenticator Get: %v", err)
	}
	parsed, err := protocol.ParseCredentialRequestResponseBytes(assertJSON)
	if err != nil {
		t.Fatalf("ParseCredentialRequestResponseBytes: %v", err)
	}
	handler := func(_, _ []byte) (webauthn.User, error) { return user, nil }
	if _, err := rp.WebAuthn().ValidateDiscoverableLogin(handler, *sd, parsed); err != nil {
		t.Fatalf("ValidateDiscoverableLogin: unexpected error: %v", err)
	}
}

// TestAdvancingSignCountAccepted pins that a second assertion with a higher
// sign count is accepted (the software authenticator advances its counter).
func TestAdvancingSignCountAccepted(t *testing.T) {
	rp := newTestRP(t)
	auth := webauthntest.New(testOrigin)
	user := userWithCreds(t, nil)
	cred := registerFor(t, rp, auth, user)

	stored := *cred
	for i := 0; i < 2; i++ {
		user.Creds = []webauthn.Credential{stored}
		assertion, sd, err := rp.WebAuthn().BeginDiscoverableLogin()
		if err != nil {
			t.Fatalf("BeginDiscoverableLogin: %v", err)
		}
		assertJSON, err := auth.Get(assertion)
		if err != nil {
			t.Fatalf("authenticator Get: %v", err)
		}
		parsed, err := protocol.ParseCredentialRequestResponseBytes(assertJSON)
		if err != nil {
			t.Fatalf("Parse: %v", err)
		}
		handler := func(_, _ []byte) (webauthn.User, error) { return user, nil }
		out, err := rp.WebAuthn().ValidateDiscoverableLogin(handler, *sd, parsed)
		if err != nil {
			t.Fatalf("login %d: unexpected error: %v", i, err)
		}
		// Persist the advanced counter, as the service does, so the next login
		// is checked against it.
		stored.Authenticator.SignCount = out.Authenticator.SignCount
	}
	if stored.Authenticator.SignCount < 2 {
		t.Errorf("sign count = %d after two logins, want it to have advanced", stored.Authenticator.SignCount)
	}
}

// TestTamperedAssertionRejected pins that a corrupted signature is refused.
func TestTamperedAssertionRejected(t *testing.T) {
	rp := newTestRP(t)
	auth := webauthntest.New(testOrigin)
	user := userWithCreds(t, nil)
	cred := registerFor(t, rp, auth, user)

	user.Creds = []webauthn.Credential{*cred}
	assertion, sd, err := rp.WebAuthn().BeginDiscoverableLogin()
	if err != nil {
		t.Fatalf("BeginDiscoverableLogin: %v", err)
	}
	assertJSON, err := auth.GetTampered(assertion)
	if err != nil {
		t.Fatalf("authenticator GetTampered: %v", err)
	}
	parsed, err := protocol.ParseCredentialRequestResponseBytes(assertJSON)
	if err != nil {
		// A tampered signature may fail to parse or to verify; both are a refusal.
		return
	}
	handler := func(_, _ []byte) (webauthn.User, error) { return user, nil }
	if _, err := rp.WebAuthn().ValidateDiscoverableLogin(handler, *sd, parsed); err == nil {
		t.Error("ValidateDiscoverableLogin accepted a tampered assertion, want an error")
	}
}

// registerFor runs a begin→finish registration for user with the software
// authenticator and returns the verified credential.
func registerFor(t *testing.T, rp *RP, auth *webauthntest.Authenticator, user *User) *webauthn.Credential {
	t.Helper()

	creation, sd, err := rp.WebAuthn().BeginRegistration(user)
	if err != nil {
		t.Fatalf("BeginRegistration: %v", err)
	}
	// The sealed state round-trips the session data.
	state, err := rp.Seal(sd, time.Now())
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	opened, err := rp.Open(state, time.Now())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	credJSON, _, err := auth.Create(creation)
	if err != nil {
		t.Fatalf("authenticator Create: %v", err)
	}
	parsed, err := protocol.ParseCredentialCreationResponseBytes(credJSON)
	if err != nil {
		t.Fatalf("ParseCredentialCreationResponseBytes: %v", err)
	}
	cred, err := rp.WebAuthn().CreateCredential(user, *opened, parsed)
	if err != nil {
		t.Fatalf("CreateCredential: unexpected error: %v", err)
	}
	return cred
}

// userWithCreds builds a User with a fresh account handle and the given
// credentials.
func userWithCreds(t *testing.T, creds []webauthn.Credential) *User {
	t.Helper()
	u, err := UserFor(NewAccountID(), "", nil)
	if err != nil {
		t.Fatalf("UserFor: %v", err)
	}
	u.Creds = creds
	return u
}
