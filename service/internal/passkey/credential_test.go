package passkey

import (
	"bytes"
	"testing"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

// These unit tests pin the webauthn.Credential ↔ passkeys-columns mapping
// (0001_registry.sql:46-59; refinement Decision 2) and the webauthn.User
// adapter (Decision 7). No DB: the mapping is a pure function of the row.

// TestCredentialRowRoundTrip pins that every passkeys column survives a
// Credential → Row → Credential round-trip: the credential id, the public key,
// the sign count, the AAGUID, the transports and the backup flags.
func TestCredentialRowRoundTrip(t *testing.T) {
	label := "my laptop"
	cred := &webauthn.Credential{
		ID:        []byte{0xaa, 0xbb, 0xcc},
		PublicKey: []byte{0x01, 0x02, 0x03, 0x04},
		Transport: []protocol.AuthenticatorTransport{protocol.Internal, protocol.Hybrid},
	}
	cred.Authenticator.SignCount = 42
	cred.Authenticator.AAGUID = bytes.Repeat([]byte{0x7}, 16)
	cred.Flags.BackupEligible = true
	cred.Flags.BackupState = true

	row := NewRow("acct-1", cred, &label)
	if row.AccountID != "acct-1" {
		t.Errorf("AccountID = %q, want acct-1", row.AccountID)
	}
	if row.Label == nil || *row.Label != label {
		t.Errorf("Label = %v, want %q", row.Label, label)
	}
	if row.SignCount != 42 {
		t.Errorf("SignCount = %d, want 42", row.SignCount)
	}
	if !row.BackupEligible || !row.BackupState {
		t.Errorf("backup flags = (%v,%v), want (true,true)", row.BackupEligible, row.BackupState)
	}
	if len(row.Transports) != 2 || row.Transports[0] != "internal" || row.Transports[1] != "hybrid" {
		t.Errorf("Transports = %v, want [internal hybrid]", row.Transports)
	}

	got := row.Credential()
	if !bytes.Equal(got.ID, cred.ID) {
		t.Errorf("ID = %x, want %x", got.ID, cred.ID)
	}
	if !bytes.Equal(got.PublicKey, cred.PublicKey) {
		t.Errorf("PublicKey = %x, want %x", got.PublicKey, cred.PublicKey)
	}
	if got.Authenticator.SignCount != 42 {
		t.Errorf("SignCount = %d, want 42", got.Authenticator.SignCount)
	}
	if !bytes.Equal(got.Authenticator.AAGUID, cred.Authenticator.AAGUID) {
		t.Errorf("AAGUID = %x, want %x", got.Authenticator.AAGUID, cred.Authenticator.AAGUID)
	}
	if !got.Flags.BackupEligible || !got.Flags.BackupState {
		t.Errorf("backup flags = (%v,%v), want (true,true)", got.Flags.BackupEligible, got.Flags.BackupState)
	}
	if len(got.Transport) != 2 || got.Transport[0] != protocol.Internal || got.Transport[1] != protocol.Hybrid {
		t.Errorf("Transport = %v, want [internal hybrid]", got.Transport)
	}
}

// TestHandleAccountIDRoundTrip pins that the WebAuthn user handle is the
// account UUID's bytes and round-trips losslessly (refinement Decision 7).
func TestHandleAccountIDRoundTrip(t *testing.T) {
	id := NewAccountID()
	handle, err := HandleFromAccountID(id)
	if err != nil {
		t.Fatalf("HandleFromAccountID: %v", err)
	}
	if len(handle) != 16 {
		t.Errorf("handle length = %d, want 16", len(handle))
	}
	back, err := AccountIDFromHandle(handle)
	if err != nil {
		t.Fatalf("AccountIDFromHandle: %v", err)
	}
	if back != id {
		t.Errorf("round-tripped account id = %q, want %q", back, id)
	}
}

// TestAccountIDFromHandleRejectsNonUUID pins that a handle that is not 16 bytes
// is refused, so a junk user handle at authenticate/finish never resolves.
func TestAccountIDFromHandleRejectsNonUUID(t *testing.T) {
	if _, err := AccountIDFromHandle([]byte{0x01, 0x02}); err == nil {
		t.Error("AccountIDFromHandle accepted a non-UUID handle, want an error")
	}
}

// TestUserForExposesIDAndCredentials pins the webauthn.User adapter: the handle
// is the account id's bytes, and the credentials are the stored rows. The
// display name falls back to a non-email label when the account has no email
// (first-run accounts carry email = NULL, refinement Decision 7).
func TestUserForExposesIDAndCredentials(t *testing.T) {
	id := NewAccountID()
	rows := []Row{
		{CredentialID: []byte{0x01}, PublicKey: []byte{0x02}},
		{CredentialID: []byte{0x03}, PublicKey: []byte{0x04}},
	}
	u, err := UserFor(id, "", rows)
	if err != nil {
		t.Fatalf("UserFor: %v", err)
	}

	handle, _ := HandleFromAccountID(id)
	if !bytes.Equal(u.WebAuthnID(), handle) {
		t.Errorf("WebAuthnID = %x, want %x", u.WebAuthnID(), handle)
	}
	if len(u.WebAuthnCredentials()) != 2 {
		t.Errorf("credentials = %d, want 2", len(u.WebAuthnCredentials()))
	}
	if u.WebAuthnName() == "" || u.WebAuthnDisplayName() == "" {
		t.Error("display name is empty, want a non-email label for an account with no email")
	}

	withEmail, err := UserFor(id, "player@estante.test", nil)
	if err != nil {
		t.Fatalf("UserFor: %v", err)
	}
	if withEmail.WebAuthnName() != "player@estante.test" {
		t.Errorf("WebAuthnName = %q, want the email when present", withEmail.WebAuthnName())
	}
}
