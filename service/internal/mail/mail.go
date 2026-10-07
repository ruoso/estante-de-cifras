// Package mail hands the one piece of outbound mail the service sends — the
// emailed sign-in link (workflow 13; DIRECTION §3.3 line 162, §3.6 lines
// 313–315) — to the transactional email provider over SMTP. A local catcher
// (Mailpit) stands in for the provider in development and in the e2e stack, so
// the service speaks SMTP, the universal transactional-mail transport, rather
// than a provider's bespoke HTTP API (refinement Decisions). The Mailer
// interface is the one seam the sign-in handler depends on, keeping the
// provider swappable and letting a behavior test record what would be sent.
package mail

import (
	"context"
	"fmt"
	"net/smtp"
)

// Mailer sends the sign-in link to an address. It is the only mail seam the
// service has; the sign-in handler depends on this interface, a recording fake
// stands in for it in the behavior tests, and SMTPMailer is the production
// implementation.
type Mailer interface {
	// SendSignInLink mails the single sign-in link to to. It carries no song
	// text, no secret and no address other than to and the sender (refinement
	// Constraints — no secret in content).
	SendSignInLink(ctx context.Context, to, link string) error
}

// SMTPMailer sends over SMTP with no authentication — the shape the compose
// catcher (mail:1025) and a typical transactional provider's relay both accept.
// Addr is host:port; From is the envelope and header sender.
type SMTPMailer struct {
	Addr string
	From string
}

// NewSMTP builds an SMTPMailer for the given relay address and sender.
func NewSMTP(addr, from string) *SMTPMailer {
	return &SMTPMailer{Addr: addr, From: from}
}

// SendSignInLink composes the message and hands it to the relay. Auth is nil:
// the dev catcher needs none, and a production relay on the compose network is
// reached the same way; credentials, when a provider needs them, are a later,
// provider-specific concern. The error names the transport only — never the
// address, the link or the body (no secret in logs).
func (m *SMTPMailer) SendSignInLink(_ context.Context, to, link string) error {
	msg := composeSignInMessage(m.From, to, link)
	if err := smtp.SendMail(m.Addr, nil, m.From, []string{to}, msg); err != nil {
		return fmt.Errorf("mail: sending the sign-in link over SMTP: %w", err)
	}
	return nil
}
