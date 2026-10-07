// Package webauthntest is a minimal software WebAuthn authenticator for the
// service's unit and behavior tests: it plays the role a platform or roaming
// authenticator (and the browser) would, producing the attestation and
// assertion JSON go-webauthn verifies. There is no off-the-shelf standalone
// authenticator for Go, so this is a small purpose-built helper — like the
// recording mailer before it — not a runtime dependency of the service
// (service.passkeys Decision 10). It supports exactly what the passkeys task
// needs: ES256 (the WebAuthn default), `none` attestation, discoverable
// (resident) credentials, an advancing signature counter, and a deliberately
// tampered assertion for the rejection tests.
//
// It is intentionally not in a _test.go file: both the passkey unit tests and
// the server behavior tests import it, so it must be an ordinary package. It is
// imported only from tests and never wired into the binary.
package webauthntest

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math/big"

	"github.com/fxamacker/cbor/v2"
	"github.com/go-webauthn/webauthn/protocol"
)

// WebAuthn authenticator-data flags (§6.1).
const (
	flagUserPresent  = 0x01
	flagUserVerified = 0x04
	flagAttestedData = 0x40
)

// COSE key labels and values for an ES256 EC2 public key (RFC 8152).
const (
	coseKeyType   = 1  // kty
	coseAlg       = 3  // alg
	coseCurve     = -1 // crv (EC2)
	coseXCoord    = -2
	coseYCoord    = -3
	coseKeyEC2    = 2  // kty: EC2
	coseAlgES256  = -7 // alg: ES256
	coseCurveP256 = 1  // crv: P-256
)

var b64 = base64.RawURLEncoding

// Credential is one resident credential the authenticator holds: its id, its
// ES256 key pair, the user handle it was registered against, the relying-party
// id it belongs to, and the signature counter it advances on each assertion.
type Credential struct {
	ID         []byte
	key        *ecdsa.PrivateKey
	UserHandle []byte
	rpID       string
	SignCount  uint32
}

// Authenticator is a software authenticator bound to one ceremony origin (the
// value it writes into clientDataJSON, which the relying party matches against
// its configured RP origins). It accumulates the credentials it creates so it
// can later sign assertions with them, exactly as a resident-key authenticator
// does.
type Authenticator struct {
	origin string
	creds  []*Credential
}

// New returns an authenticator whose assertions and attestations claim origin.
func New(origin string) *Authenticator {
	return &Authenticator{origin: origin}
}

// clientData is the JSON the client (browser) collects and the authenticator
// signs over. crossOrigin is always false here (one origin, DIRECTION §3.3).
type clientData struct {
	Type        string `json:"type"`
	Challenge   string `json:"challenge"`
	Origin      string `json:"origin"`
	CrossOrigin bool   `json:"crossOrigin"`
}

// attestationObject is the CBOR structure a `none`-attestation registration
// returns: the raw authenticator data, the format, and an empty statement.
type attestationObject struct {
	AuthData []byte         `cbor:"authData"`
	Fmt      string         `cbor:"fmt"`
	AttStmt  map[string]any `cbor:"attStmt"`
}

// Create plays navigator.credentials.create() for the given creation options:
// it mints an ES256 resident credential, builds `none`-attestation authenticator
// data over it, and returns the registration response JSON the finish handler
// forwards to go-webauthn. The returned *Credential is retained so a later Get
// can sign with it.
func (a *Authenticator) Create(opts *protocol.CredentialCreation) ([]byte, *Credential, error) {
	rpID := opts.Response.RelyingParty.ID
	userHandle, err := decodeUserHandle(opts.Response.User.ID)
	if err != nil {
		return nil, nil, err
	}

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, err
	}
	credID := make([]byte, 20)
	if _, err := rand.Read(credID); err != nil {
		return nil, nil, err
	}
	cred := &Credential{ID: credID, key: key, UserHandle: userHandle, rpID: rpID, SignCount: 0}

	cdj, err := json.Marshal(clientData{
		Type:      "webauthn.create",
		Challenge: opts.Response.Challenge.String(),
		Origin:    a.origin,
	})
	if err != nil {
		return nil, nil, err
	}

	authData := a.registrationAuthData(cred)
	attObj, err := cbor.Marshal(attestationObject{
		AuthData: authData,
		Fmt:      "none",
		AttStmt:  map[string]any{},
	})
	if err != nil {
		return nil, nil, err
	}

	resp := map[string]any{
		"id":    b64.EncodeToString(credID),
		"rawId": b64.EncodeToString(credID),
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    b64.EncodeToString(cdj),
			"attestationObject": b64.EncodeToString(attObj),
		},
		"clientExtensionResults":  map[string]any{},
		"authenticatorAttachment": "platform",
	}
	out, err := json.Marshal(resp)
	if err != nil {
		return nil, nil, err
	}
	a.creds = append(a.creds, cred)
	return out, cred, nil
}

// Get plays navigator.credentials.get() for the given request options: it finds
// a resident credential for the relying party, advances its signature counter,
// signs the assertion, and returns the assertion response JSON the finish
// handler forwards to go-webauthn. Discoverable sign-in sends no allowList, so
// the authenticator offers its own resident credential and its user handle.
func (a *Authenticator) Get(opts *protocol.CredentialAssertion) ([]byte, error) {
	cred := a.residentFor(opts.Response.RelyingPartyID)
	if cred == nil {
		return nil, fmt.Errorf("webauthntest: no resident credential for rpId %q", opts.Response.RelyingPartyID)
	}
	return a.assertion(cred, opts.Response.Challenge.String(), false)
}

// GetTampered is Get with the signature corrupted, for the "a bad signature is
// refused" assertion-rejection tests.
func (a *Authenticator) GetTampered(opts *protocol.CredentialAssertion) ([]byte, error) {
	cred := a.residentFor(opts.Response.RelyingPartyID)
	if cred == nil {
		return nil, fmt.Errorf("webauthntest: no resident credential for rpId %q", opts.Response.RelyingPartyID)
	}
	return a.assertion(cred, opts.Response.Challenge.String(), true)
}

// assertion builds and signs one get() response for cred. When tamper is set,
// the signature bytes are flipped so verification fails.
func (a *Authenticator) assertion(cred *Credential, challenge string, tamper bool) ([]byte, error) {
	cdj, err := json.Marshal(clientData{
		Type:      "webauthn.get",
		Challenge: challenge,
		Origin:    a.origin,
	})
	if err != nil {
		return nil, err
	}

	cred.SignCount++
	authData := assertionAuthData(cred.rpID, cred.SignCount)

	clientDataHash := sha256.Sum256(cdj)
	signed := append(append([]byte{}, authData...), clientDataHash[:]...)
	digest := sha256.Sum256(signed)
	sig, err := ecdsa.SignASN1(rand.Reader, cred.key, digest[:])
	if err != nil {
		return nil, err
	}
	if tamper {
		sig[len(sig)-1] ^= 0xff
	}

	resp := map[string]any{
		"id":    b64.EncodeToString(cred.ID),
		"rawId": b64.EncodeToString(cred.ID),
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    b64.EncodeToString(cdj),
			"authenticatorData": b64.EncodeToString(authData),
			"signature":         b64.EncodeToString(sig),
			"userHandle":        b64.EncodeToString(cred.UserHandle),
		},
		"clientExtensionResults": map[string]any{},
	}
	return json.Marshal(resp)
}

// residentFor returns the first credential this authenticator holds for rpID.
func (a *Authenticator) residentFor(rpID string) *Credential {
	for _, c := range a.creds {
		if c.rpID == rpID {
			return c
		}
	}
	return nil
}

// registrationAuthData builds the authenticator data for a registration: the
// RP ID hash, the UP|UV|AT flags, a zero signature counter, and the attested
// credential data (a zero AAGUID, the credential id, and the COSE public key).
func (a *Authenticator) registrationAuthData(cred *Credential) []byte {
	rpIDHash := sha256.Sum256([]byte(cred.rpID))

	var buf []byte
	buf = append(buf, rpIDHash[:]...)
	buf = append(buf, flagUserPresent|flagUserVerified|flagAttestedData)
	buf = appendUint32(buf, 0) // signature counter starts at zero

	var aaguid [16]byte // all-zero AAGUID: privacy-preserving, no fingerprint
	buf = append(buf, aaguid[:]...)
	buf = appendUint16(buf, uint16(len(cred.ID)))
	buf = append(buf, cred.ID...)
	buf = append(buf, cosePublicKey(&cred.key.PublicKey)...)
	return buf
}

// assertionAuthData builds the authenticator data for an assertion: the RP ID
// hash, the UP|UV flags, and the advancing signature counter (no attested
// credential data).
func assertionAuthData(rpID string, signCount uint32) []byte {
	rpIDHash := sha256.Sum256([]byte(rpID))
	var buf []byte
	buf = append(buf, rpIDHash[:]...)
	buf = append(buf, flagUserPresent|flagUserVerified)
	buf = appendUint32(buf, signCount)
	return buf
}

// cosePublicKey CBOR-encodes an ES256 EC2 public key in COSE_Key form, the
// shape go-webauthn's webauthncose parser expects.
func cosePublicKey(pub *ecdsa.PublicKey) []byte {
	key := map[int]any{
		coseKeyType: coseKeyEC2,
		coseAlg:     coseAlgES256,
		coseCurve:   coseCurveP256,
		coseXCoord:  pad32(pub.X),
		coseYCoord:  pad32(pub.Y),
	}
	// fxamacker's default encoding is deterministic (canonical) for integer
	// keys; go-webauthn decodes by key regardless of order.
	b, err := cbor.Marshal(key)
	if err != nil {
		// A fixed, small map cannot fail to encode; a panic here is a test bug.
		panic(fmt.Sprintf("webauthntest: encoding COSE key: %v", err))
	}
	return b
}

// pad32 left-pads a coordinate to the fixed 32-byte width an EC P-256 field
// element has, as COSE requires.
func pad32(n *big.Int) []byte {
	b := n.Bytes()
	if len(b) >= 32 {
		return b
	}
	out := make([]byte, 32)
	copy(out[32-len(b):], b)
	return out
}

func appendUint16(b []byte, v uint16) []byte {
	var x [2]byte
	binary.BigEndian.PutUint16(x[:], v)
	return append(b, x[:]...)
}

func appendUint32(b []byte, v uint32) []byte {
	var x [4]byte
	binary.BigEndian.PutUint32(x[:], v)
	return append(b, x[:]...)
}

// CredentialCreationFrom rebuilds the *protocol.CredentialCreation a begin
// response's `publicKey` object represents, so a black-box test that only has
// the JSON options (as a device would) can drive Create. It wraps the options
// back into the {publicKey:…} envelope the type unmarshals from.
func CredentialCreationFrom(publicKey []byte) (*protocol.CredentialCreation, error) {
	var cc protocol.CredentialCreation
	if err := json.Unmarshal(wrapPublicKey(publicKey), &cc); err != nil {
		return nil, fmt.Errorf("webauthntest: decoding creation options: %w", err)
	}
	return &cc, nil
}

// CredentialAssertionFrom rebuilds the *protocol.CredentialAssertion a begin
// response's `publicKey` object represents, the assertion counterpart of
// CredentialCreationFrom.
func CredentialAssertionFrom(publicKey []byte) (*protocol.CredentialAssertion, error) {
	var ca protocol.CredentialAssertion
	if err := json.Unmarshal(wrapPublicKey(publicKey), &ca); err != nil {
		return nil, fmt.Errorf("webauthntest: decoding assertion options: %w", err)
	}
	return &ca, nil
}

func wrapPublicKey(publicKey []byte) []byte {
	out := make([]byte, 0, len(publicKey)+16)
	out = append(out, []byte(`{"publicKey":`)...)
	out = append(out, publicKey...)
	out = append(out, '}')
	return out
}

// decodeUserHandle reads the user.id value go-webauthn put in the creation
// options, which may be a typed URLEncodedBase64/[]byte or a base64url string.
func decodeUserHandle(id any) ([]byte, error) {
	switch v := id.(type) {
	case protocol.URLEncodedBase64:
		return []byte(v), nil
	case []byte:
		return v, nil
	case string:
		return b64.DecodeString(v)
	default:
		return nil, fmt.Errorf("webauthntest: unexpected user.id type %T", id)
	}
}
