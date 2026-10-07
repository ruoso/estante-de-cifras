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
