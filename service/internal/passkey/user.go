package passkey

import (
	"github.com/go-webauthn/webauthn/webauthn"
)

// User is the webauthn.User adapter over an account and its passkeys. The
// WebAuthn user handle is the account's UUID bytes — stable and non-PII, never
// the email, so a lost or late-set recovery email never changes a credential's
// binding (refinement Decision 7). The name and display name are cosmetic,
// shown only in the authenticator UI; they fall back to a short label when the
// account has no email yet (first-run accounts carry email = NULL).
type User struct {
	// ID is the account UUID's 16 raw bytes (the WebAuthn user handle).
	ID []byte
	// Name and DisplayName are shown by the authenticator UI only.
	Name        string
	DisplayName string
	// Creds are the account's registered passkeys, used as excludeCredentials
	// on registration and as the credential set on an assertion.
	Creds []webauthn.Credential
}

// WebAuthnID returns the user handle: the account UUID bytes.
func (u *User) WebAuthnID() []byte { return u.ID }

// WebAuthnName returns a human-palatable name for the authenticator UI.
func (u *User) WebAuthnName() string { return u.Name }

// WebAuthnDisplayName returns a display name for the authenticator UI.
func (u *User) WebAuthnDisplayName() string { return u.DisplayName }

// WebAuthnCredentials returns the account's registered credentials.
func (u *User) WebAuthnCredentials() []webauthn.Credential { return u.Creds }

// displayFor is the cosmetic name shown in the authenticator UI: the account's
// email when it has one, else a short stable label derived from the account id.
// It is never used for any authentication or authorization decision (that is
// the user handle), so a null email is fine (refinement Decision 7).
func displayFor(email, accountID string) string {
	if email != "" {
		return email
	}
	return "Estante account " + accountID
}
