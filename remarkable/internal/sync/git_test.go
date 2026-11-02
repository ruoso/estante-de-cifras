package sync

// unit — the session goes to the one origin only, and no token in a string
// or an error (reader.sync; docs/remarkable-reader.md §10).

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	gosync "sync"
	"testing"
)

// TestAuthCarriesNoToken pins design §10: the auth method's String() and
// Name(), a clone's error and a pass's errors never carry the token.
func TestAuthCarriesNoToken(t *testing.T) {
	a := &cookieAuth{token: testToken}
	for _, s := range []string{a.String(), a.Name(), fmt.Sprintf("%v", a), fmt.Sprintf("%s", a)} {
		if strings.Contains(s, testToken) {
			t.Errorf("%q carries the token", s)
		}
	}
	req := httptest.NewRequest(http.MethodGet, "http://x.test/", nil)
	a.SetAuth(req)
	if c, err := req.Cookie(cookieName); err != nil || c.Value != testToken {
		t.Errorf("SetAuth set no session cookie: %v", err)
	}

	// A clone of a repository the service does not have: the error names the
	// step and the id, nothing more.
	f := newFakeService(t)
	g := newGitClient(f.srv.Client(), testToken)
	tmp := filepath.Join(t.TempDir(), "clone")
	repo, err := initBare(tmp)
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(f.url("no-such-book"))
	_, err = g.fetchMain(context.Background(), repo, u)
	if err == nil {
		t.Fatal("a clone of an absent repository succeeded")
	}
	if strings.Contains(err.Error(), testToken) {
		t.Errorf("clone error %q carries the token", err)
	}
	// What a pass makes of it: a status, with the id and no words of the
	// remote's.
	f.push(f.homeID, map[string]string{shelfFile: shelfJSON(shelfBook{id: "no-such-book", link: f.url("no-such-book"), position: 1})})
	res := mustPass(t, newTestSyncer(t, f, newTestStore(t, f), newFakeEngine()))
	wantStatus(t, res, "no-such-book", Failed)

	// A pass's errors: the service unreachable, then answering 401.
	st := newTestStore(t, f)
	s := newTestSyncer(t, f, st, newFakeEngine())
	f.setUnauthorized(true)
	if _, err := s.Pass(context.Background()); err == nil || strings.Contains(err.Error(), testToken) {
		t.Errorf("signed-out error %v", err)
	}
	f.srv.Close()
	if _, err := s.Pass(context.Background()); err == nil || strings.Contains(err.Error(), testToken) || strings.Contains(err.Error(), f.srv.URL) {
		t.Errorf("offline error %v", err)
	}
}

// countingServer records whether anything reached it.
func countingServer(t *testing.T) (*httptest.Server, func() int) {
	t.Helper()
	var mu gosync.Mutex
	n := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		n++
		mu.Unlock()
		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)
	return srv, func() int { mu.Lock(); defer mu.Unlock(); return n }
}

// TestOtherOriginRefused pins design §10 "the one origin only": a link on
// another host, or http for an https origin, is refused and nothing is sent
// to it.
func TestOtherOriginRefused(t *testing.T) {
	origin, _ := url.Parse("https://estante.test")
	for link, want := range map[string]bool{
		"https://estante.test/git/b1":      true,
		"https://ESTANTE.test:443/git/b1":  true,
		"/git/b1":                          true,
		"http://estante.test/git/b1":       false,
		"https://estante.test:8443/git/b1": false,
		"https://other.test/git/b1":        false,
		"https://estante.test.evil/git/b1": false,
		"https://user:pw@estante.test/git": false,
		"//other.test/git/b1":              false,
		"ftp://estante.test/git/b1":        false,
		"https://estante.test\x00/git/b1":  false,
	} {
		if _, got := sameOrigin(origin, link); got != want {
			t.Errorf("%q: %v, want %v", link, got, want)
		}
	}

	t.Run("another host", func(t *testing.T) {
		f := newFakeService(t)
		other, hits := countingServer(t)
		f.newRepo(bookB)
		f.push(bookB, map[string]string{"road.cifra.md": songTwo})
		f.push(f.homeID, map[string]string{shelfFile: shelfJSON(
			shelfBook{id: bookA, link: other.URL + "/git/" + bookA, position: 1},
			shelfBook{id: bookB, link: f.url(bookB), position: 2},
		)})
		s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
		res := mustPass(t, s)
		wantStatus(t, res, bookA, Refused)
		wantStatus(t, res, bookB, Cloned)
		if n := hits(); n != 0 {
			t.Errorf("%d requests reached the other host", n)
		}
		if exists(bookDir(t, s, bookA)) {
			t.Error("a refused book has a clone")
		}
	})

	t.Run("http for an https origin", func(t *testing.T) {
		f := newTLSFakeService(t)
		f.newRepo(bookA)
		f.push(bookA, map[string]string{"lanterns.cifra.md": songOne})
		plain := "http://" + strings.TrimPrefix(f.srv.URL, "https://") + "/git/" + bookA
		f.push(f.homeID, map[string]string{shelfFile: shelfJSON(shelfBook{id: bookA, link: plain, position: 1})})
		s := newTestSyncer(t, f, newTestStore(t, f), newFakeEngine())
		res := mustPass(t, s)
		if res.Home.Status != Cloned {
			t.Fatalf("home over https: %s", res.Home.Status)
		}
		wantStatus(t, res, bookA, Refused)
		if got := f.requestsFor(bookA); len(got) != 0 {
			t.Errorf("requests for the refused book: %+v", got)
		}
		if exists(bookDir(t, s, bookA)) {
			t.Error("a refused book has a clone")
		}
	})
}

// TestBadSessionOriginSendsNothing pins that a session whose origin is not
// an http(s) origin sends nothing.
func TestBadSessionOriginSendsNothing(t *testing.T) {
	for _, o := range []string{"", "estante.test", "ftp://estante.test", "https://u:p@estante.test"} {
		if _, err := parseOrigin(o); err == nil {
			t.Errorf("%q read as an origin", o)
		}
	}
	if _, err := parseOrigin("https://estante.test/"); err != nil {
		t.Errorf("an https origin refused: %v", err)
	}
}
