package mail

import (
	"net/smtp"
	"strings"
	"testing"
)

// Pins the relay authentication seam (launch.email): with no credentials the
// mailer offers no SMTP AUTH (the Mailpit catcher in dev and e2e), with them it
// offers PLAIN bound to the host part of Addr — and that PLAIN refuses to send
// the credentials over a connection that is neither TLS nor to localhost.

func TestSMTPMailerAuthIsNilWithoutCredentials(t *testing.T) {
	m := NewSMTP("mail:1025", "no-reply@estante.test")
	if a := m.auth(); a != nil {
		t.Errorf("auth() = %#v, want nil for the unauthenticated catcher", a)
	}
	if a := m.WithAuth("", "").auth(); a != nil {
		t.Errorf("auth() with empty credentials = %#v, want nil", a)
	}
}

func TestSMTPMailerAuthIsPlainWithCredentials(t *testing.T) {
	const password = "a-very-secret-smtp-password"
	a := NewSMTP("smtp.provider.test:587", "no-reply@estante.test").
		WithAuth("relay-user", password).auth()
	if a == nil {
		t.Fatal("auth() = nil, want PLAIN with credentials set")
	}

	// Over STARTTLS to the configured host: PLAIN, carrying the credentials.
	mech, resp, err := a.Start(&smtp.ServerInfo{Name: "smtp.provider.test", TLS: true, Auth: []string{"PLAIN"}})
	if err != nil {
		t.Fatalf("Start over TLS: unexpected error: %v", err)
	}
	if mech != "PLAIN" {
		t.Errorf("mechanism = %q, want PLAIN", mech)
	}
	if want := "\x00relay-user\x00" + password; string(resp) != want {
		t.Error("PLAIN response does not carry the configured credentials")
	}

	// In clear to a non-localhost relay: refused, so the password never leaves
	// unencrypted.
	if _, _, err := a.Start(&smtp.ServerInfo{Name: "smtp.provider.test", TLS: false, Auth: []string{"PLAIN"}}); err == nil {
		t.Error("Start without TLS: want refusal, got nil")
	} else if strings.Contains(err.Error(), password) {
		t.Error("refusal carries the SMTP password")
	}

	// A server answering as another host: refused (the host is taken from Addr).
	if _, _, err := a.Start(&smtp.ServerInfo{Name: "elsewhere.test", TLS: true, Auth: []string{"PLAIN"}}); err == nil {
		t.Error("Start against another host: want refusal, got nil")
	}
}
