package mail

import (
	"regexp"
	"strings"
	"testing"
)

// Pins the no-secret-in-content rule and DIRECTION §3.3 line 162 (the sign-in
// link is mailed from the service): composeSignInMessage produces a subject and
// a body carrying exactly the one sign-in link and no other address or token
// (service.email_links refinement, unit level).

var urlRE = regexp.MustCompile(`https?://\S+`)

func TestComposeSignInMessageCarriesExactlyTheLink(t *testing.T) {
	const (
		from = "no-reply@estante.test"
		to   = "player@estante.test"
		link = "https://estante.test/sign-in/YWJj.ZGVm"
	)

	msg := string(composeSignInMessage(from, to, link))

	// The subject is present and names the purpose, carrying no address/token.
	if !strings.Contains(msg, "Subject: "+signInSubject) {
		t.Errorf("message has no %q subject header:\n%s", signInSubject, msg)
	}

	// Split headers from body on the first blank line; assert the body carries
	// exactly one URL, and that it is the sign-in link — no second link, no
	// stray token leaked into the content.
	_, body, found := strings.Cut(msg, "\r\n\r\n")
	if !found {
		t.Fatalf("message has no header/body separator:\n%s", msg)
	}
	urls := urlRE.FindAllString(body, -1)
	if len(urls) != 1 {
		t.Fatalf("body carries %d URLs, want exactly 1 (the sign-in link):\n%s", len(urls), body)
	}
	// FindAllString can keep trailing CR; compare on the trimmed match.
	if got := strings.TrimRight(urls[0], "\r\n"); got != link {
		t.Errorf("body URL = %q, want the sign-in link %q", got, link)
	}
}
