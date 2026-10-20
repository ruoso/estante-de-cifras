// Package mail hands the service's outbound mail — the emailed sign-in link
// (workflow 13; DIRECTION §3.3 line 162, §3.6 lines 313–315), and the recovery
// email's verification link and change notice (workflow 13 §The recovery
// email) — to the transactional email provider over SMTP. A local catcher
// (Mailpit) stands in for the provider in development and in the e2e stack, so
// the service speaks SMTP, the universal transactional-mail transport, rather
// than a provider's bespoke HTTP API (refinement Decisions). The Mailer
// interface is the one seam the handlers depend on, keeping the
// provider swappable and letting a behavior test record what would be sent.
package mail

import (
	"context"
	"fmt"
	"net"
	"net/smtp"
)

// Mailer sends the service's mail: the sign-in link, and the recovery email's
// verification link and change notice. It is the only mail seam the service has; the sign-in handler depends on this interface, a recording fake
// stands in for it in the behavior tests, and SMTPMailer is the production
// implementation.
type Mailer interface {
	// SendSignInLink mails the single sign-in link to to. It carries no song
	// text, no secret and no address other than to and the sender (refinement
	// Constraints — no secret in content).
	SendSignInLink(ctx context.Context, to, link string) error
	// SendRecoveryEmailLink mails the single verification link that confirms
	// to as the account's recovery email (workflow 13 §Setting it). It carries
	// no address but to and the sender, and says it does not sign in.
	SendRecoveryEmailLink(ctx context.Context, to, link string) error
	// SendRecoveryEmailChanged tells to, the account's previous recovery email,
	// that it was replaced. It carries no link and no address but to and the
	// sender — not the new one (workflow 13 §Changing it).
	SendRecoveryEmailChanged(ctx context.Context, to string) error
}

// SMTPMailer sends over SMTP — with no authentication to the compose catcher
// (mail:1025), and with SMTP AUTH PLAIN to a transactional provider's relay
// (Postmark/Resend/SES-style submission on port 587) when Username and
// Password are set (launch.email). Addr is host:port; From is the envelope and
// header sender. Password is a secret and is never logged.
type SMTPMailer struct {
	Addr     string
	From     string
	Username string
	Password string
}

// NewSMTP builds an SMTPMailer for the given relay address and sender. It is
// unauthenticated — the dev and e2e catcher's shape; WithAuth adds the
// provider's credentials.
func NewSMTP(addr, from string) *SMTPMailer {
	return &SMTPMailer{Addr: addr, From: from}
}

// WithAuth sets the relay credentials (launch.email). Empty username and
// password leave the mailer unauthenticated, so main can pass the config
// through unconditionally; config.Load has already refused exactly one being
// set.
func (m *SMTPMailer) WithAuth(username, password string) *SMTPMailer {
	m.Username = username
	m.Password = password
	return m
}

// auth is the SMTP authentication the relay is offered: nil with no
// credentials (the catcher needs none), PLAIN against the host part of Addr
// with them. smtp.SendMail upgrades the connection with STARTTLS whenever the
// relay advertises it, and smtp.PlainAuth refuses to send the credentials over
// a connection that is neither TLS nor to localhost — so a misconfigured relay
// fails the send rather than leaking the password in clear (launch.email).
func (m *SMTPMailer) auth() smtp.Auth {
	if m.Username == "" && m.Password == "" {
		return nil
	}
	host, _, err := net.SplitHostPort(m.Addr)
	if err != nil {
		// An Addr with no port: PlainAuth checks the server name against this
		// host, so the whole of Addr is the best stand-in; the dial itself will
		// fail on the missing port first.
		host = m.Addr
	}
	return smtp.PlainAuth("", m.Username, m.Password, host)
}

// send hands one composed message for to to the relay, authenticated when the
// mailer carries credentials. what names the mail in the error, which names
// the transport only — never the address, the link, the body or the
// credentials (no secret in logs).
func (m *SMTPMailer) send(what, to string, msg []byte) error {
	if err := smtp.SendMail(m.Addr, m.auth(), m.From, []string{to}, msg); err != nil {
		return fmt.Errorf("mail: sending the %s over SMTP: %w", what, err)
	}
	return nil
}

// SendSignInLink composes the message and hands it to the relay.
func (m *SMTPMailer) SendSignInLink(_ context.Context, to, link string) error {
	return m.send("sign-in link", to, composeSignInMessage(m.From, to, link))
}

// SendRecoveryEmailLink composes the verification mail and hands it to the
// relay.
func (m *SMTPMailer) SendRecoveryEmailLink(_ context.Context, to, link string) error {
	return m.send("recovery email link", to, composeRecoveryEmailLinkMessage(m.From, to, link))
}

// SendRecoveryEmailChanged composes the change notice and hands it to the
// relay.
func (m *SMTPMailer) SendRecoveryEmailChanged(_ context.Context, to string) error {
	return m.send("recovery email notice", to, composeRecoveryEmailChangedMessage(m.From, to))
}
