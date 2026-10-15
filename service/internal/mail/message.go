package mail

import "fmt"

// signInSubject is the subject line of the sign-in mail. It names the purpose
// and carries no address or token.
const signInSubject = "Your Estante de Cifras sign-in link"

// composeSignInMessage builds the RFC 5322 message bytes for the sign-in mail:
// the From/To/Subject headers and a short plain-text body carrying exactly the
// one sign-in link and nothing else — no second URL, no address beyond the
// headers, no secret (refinement Constraints; the no-secret-in-content rule).
// It is pure, so the message's shape is unit-tested without a relay.
func composeSignInMessage(from, to, link string) []byte {
	body := "" +
		"Tap the link below to sign in to Estante de Cifras. " +
		"It works once and expires in 15 minutes.\r\n" +
		"\r\n" +
		link + "\r\n" +
		"\r\n" +
		"If you did not ask to sign in, you can ignore this message.\r\n"

	msg := fmt.Sprintf(""+
		"From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/plain; charset=utf-8\r\n"+
		"\r\n"+
		"%s", from, to, signInSubject, body)
	return []byte(msg)
}

// recoveryEmailLinkSubject and recoveryEmailChangedSubject are the subject
// lines of the recovery email's two mails. They name the purpose and carry no
// address or token.
const (
	recoveryEmailLinkSubject    = "Confirm your Estante de Cifras recovery email"
	recoveryEmailChangedSubject = "Your Estante de Cifras recovery email was changed"
)

// composeRecoveryEmailLinkMessage builds the verification mail: exactly the one
// link, saying it confirms this address as the account's recovery email, that
// it does not sign in, and that it expires in fifteen minutes (workflow 13
// §Setting it, §Confirming it). No second URL, no address beyond the headers.
func composeRecoveryEmailLinkMessage(from, to, link string) []byte {
	body := "" +
		"Tap the link below to confirm this address as the recovery email of " +
		"your Estante de Cifras account. It does not sign you in. " +
		"It works once and expires in 15 minutes.\r\n" +
		"\r\n" +
		link + "\r\n" +
		"\r\n" +
		"If you did not ask for this, you can ignore this message.\r\n"
	return composeMessage(from, to, recoveryEmailLinkSubject, body)
}

// composeRecoveryEmailChangedMessage builds the notice the previous recovery
// email gets once a new one is confirmed: no link, no address but its
// recipient's (not the new one), nothing to do (workflow 13 §Changing it).
func composeRecoveryEmailChangedMessage(from, to string) []byte {
	body := "" +
		"The recovery email of your Estante de Cifras account was changed, " +
		"so this address is no longer it. There is nothing you need to do.\r\n"
	return composeMessage(from, to, recoveryEmailChangedSubject, body)
}

// composeMessage wraps a plain-text body in the From/To/Subject headers.
func composeMessage(from, to, subject, body string) []byte {
	return []byte(fmt.Sprintf(""+
		"From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/plain; charset=utf-8\r\n"+
		"\r\n"+
		"%s", from, to, subject, body))
}
