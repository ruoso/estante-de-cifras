package passkey

import (
	"fmt"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
)

// The passkeys table (0001_registry.sql:46-59) holds exactly the WebAuthn
// credential go-webauthn stores; this file maps a webauthn.Credential onto
// those columns and back, with no migration (refinement Decision 2). Only the
// fields the service needs to verify a later assertion and to list/remove a
// passkey are persisted: the credential id, the public key, the sign count,
// the AAGUID, the transports and the backup flags.

// Row is one passkeys row. CreatedAt and LastUsedAt are set by the database;
// Label is optional. CredentialID is unique across the instance.
type Row struct {
	ID             string
	AccountID      string
	CredentialID   []byte
	PublicKey      []byte
	SignCount      int64
	AAGUID         []byte
	Transports     []string
	BackupEligible bool
	BackupState    bool
	Label          *string
	CreatedAt      time.Time
	LastUsedAt     *time.Time
}

// NewRow maps a freshly-registered webauthn.Credential onto a passkeys row for
// accountID, carrying the optional label.
func NewRow(accountID string, cred *webauthn.Credential, label *string) Row {
	return Row{
		AccountID:      accountID,
		CredentialID:   cred.ID,
		PublicKey:      cred.PublicKey,
		SignCount:      int64(cred.Authenticator.SignCount),
		AAGUID:         cred.Authenticator.AAGUID,
		Transports:     transportsToStrings(cred.Transport),
		BackupEligible: cred.Flags.BackupEligible,
		BackupState:    cred.Flags.BackupState,
		Label:          label,
	}
}

// Credential rebuilds the webauthn.Credential a stored row represents, so
// go-webauthn can verify an assertion against it and advance its sign count.
func (r Row) Credential() webauthn.Credential {
	cred := webauthn.Credential{
		ID:        r.CredentialID,
		PublicKey: r.PublicKey,
		Transport: transportsFromStrings(r.Transports),
	}
	cred.Authenticator.SignCount = uint32(r.SignCount)
	cred.Authenticator.AAGUID = r.AAGUID
	cred.Flags.BackupEligible = r.BackupEligible
	cred.Flags.BackupState = r.BackupState
	return cred
}

// transportsToStrings flattens WebAuthn transports to the text[] column.
func transportsToStrings(ts []protocol.AuthenticatorTransport) []string {
	if len(ts) == 0 {
		return nil
	}
	out := make([]string, len(ts))
	for i, t := range ts {
		out[i] = string(t)
	}
	return out
}

// transportsFromStrings reads the text[] column back into WebAuthn transports.
func transportsFromStrings(ss []string) []protocol.AuthenticatorTransport {
	if len(ss) == 0 {
		return nil
	}
	out := make([]protocol.AuthenticatorTransport, len(ss))
	for i, s := range ss {
		out[i] = protocol.AuthenticatorTransport(s)
	}
	return out
}

// HandleFromAccountID turns an account UUID string into the 16-byte WebAuthn
// user handle. The handle is the account id's bytes, so it is stable and
// non-PII (refinement Decision 7).
func HandleFromAccountID(accountID string) ([]byte, error) {
	id, err := uuid.Parse(accountID)
	if err != nil {
		return nil, fmt.Errorf("passkey: parsing account id as a UUID: %w", err)
	}
	b := id // copy
	return b[:], nil
}

// AccountIDFromHandle turns a 16-byte WebAuthn user handle back into the
// account UUID string. It is the inverse of HandleFromAccountID, used at
// discoverable-login finish to identify the account the authenticator offered.
func AccountIDFromHandle(handle []byte) (string, error) {
	id, err := uuid.FromBytes(handle)
	if err != nil {
		return "", fmt.Errorf("passkey: user handle is not a UUID: %w", err)
	}
	return id.String(), nil
}

// NewAccountID mints a fresh account UUID. A registration with no session
// generates the id at begin so the WebAuthn user handle is stable across
// begin→finish, and inserts the accounts row under that id at finish
// (refinement Decision 7).
func NewAccountID() string {
	return uuid.NewString()
}

// UserFor builds the webauthn.User adapter for an account from its id, optional
// email and stored passkey rows.
func UserFor(accountID, email string, rows []Row) (*User, error) {
	handle, err := HandleFromAccountID(accountID)
	if err != nil {
		return nil, err
	}
	creds := make([]webauthn.Credential, len(rows))
	for i, r := range rows {
		creds[i] = r.Credential()
	}
	display := displayFor(email, accountID)
	return &User{ID: handle, Name: display, DisplayName: display, Creds: creds}, nil
}
