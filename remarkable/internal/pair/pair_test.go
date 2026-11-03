package pair

// unit — the reader's side of pairing against an httptest fake of the two
// endpoints (reader.pairing; docs/remarkable-reader.md §5.1 *On the device*;
// workflow 19 §Pairing; the note's "the poll: pending, approved, expired").

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	gosync "sync"
	"testing"
	"time"
)

const (
	testCode    = "KQ7-4TM"
	testPoll    = "poll-token-0123456789-secret"
	testSession = "session-0123456789-secret"
)

// fakeService answers begin and poll as the test scripts them: begin with
// beginStatus (201 the contract's answer), each poll with the next of polls
// (the last repeated).
type fakeService struct {
	srv *httptest.Server

	mu          gosync.Mutex
	beginStatus int
	polls       []func(w http.ResponseWriter)
	pollCount   int
	tokens      []string
}

func newFake(t *testing.T) *fakeService {
	t.Helper()
	f := &fakeService{beginStatus: http.StatusCreated}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/devices/pair/begin", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		status := f.beginStatus
		f.mu.Unlock()
		if status != http.StatusCreated {
			w.WriteHeader(status)
			w.Write([]byte(`{"code":"rate_limited","message":"slow down"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"code": testCode, "url": "https://estantedecifras.app/pair",
			"pollToken": testPoll, "expiresAt": "2026-11-02T14:42:00Z",
		})
	})
	mux.HandleFunc("POST /api/devices/pair/poll", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			PollToken string `json:"pollToken"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		f.mu.Lock()
		f.tokens = append(f.tokens, body.PollToken)
		i := min(f.pollCount, len(f.polls)-1)
		f.pollCount++
		answer := f.polls[i]
		f.mu.Unlock()
		answer(w)
	})
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func answerJSON(status int, body string) func(http.ResponseWriter) {
	return func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		w.Write([]byte(body))
	}
}

var (
	pending  = answerJSON(200, `{"status":"pending"}`)
	approved = answerJSON(200, `{"status":"approved","session":"`+testSession+`"}`)
	expired  = answerJSON(200, `{"status":"expired"}`)
	unknown  = answerJSON(404, `{"code":"pair_token_unknown","message":"no such pairing"}`)
	limited  = answerJSON(429, `{"code":"rate_limited","message":"slow down"}`)
)

func (f *fakeService) script(polls ...func(http.ResponseWriter)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.polls = polls
}

func (f *fakeService) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.pollCount
}

// fakeClock: each wait advances it by the wait, at once.
type fakeClock struct {
	mu  gosync.Mutex
	now time.Time
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) After(d time.Duration) <-chan time.Time {
	c.mu.Lock()
	c.now = c.now.Add(d)
	now := c.now
	c.mu.Unlock()
	ch := make(chan time.Time, 1)
	ch <- now
	return ch
}

func client(t *testing.T, f *fakeService) (*Client, *fakeClock) {
	t.Helper()
	origin, err := ParseOrigin(f.srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	clock := &fakeClock{now: time.Date(2026, 11, 2, 14, 32, 0, 0, time.UTC)}
	return &Client{Origin: origin, HTTP: f.srv.Client(), Now: clock.Now, After: clock.After}, clock
}

func begin(t *testing.T, c *Client) *Pairing {
	t.Helper()
	p, err := c.Begin(context.Background())
	if err != nil {
		t.Fatalf("Begin: %v", err)
	}
	return p
}

// §5.1, workflow 19 §Pairing: begin answers the code, its address and its
// end; the poll token is not in what the frontend is sent.
func TestBeginAnswersTheCode(t *testing.T) {
	f := newFake(t)
	c, _ := client(t, f)
	p := begin(t, c)
	want := Code{Code: testCode, URL: "https://estantedecifras.app/pair", ExpiresAt: "2026-11-02T14:42:00Z"}
	if p.Code() != want {
		t.Errorf("code %+v, want %+v", p.Code(), want)
	}
	raw, err := json.Marshal(p.Code())
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), testPoll) {
		t.Errorf("the code the frontend sees carries the poll token: %s", raw)
	}
	var keys map[string]any
	json.Unmarshal(raw, &keys)
	if len(keys) != 3 {
		t.Errorf("the code carries %v, want code, url, expiresAt", keys)
	}
	for _, s := range []string{fmt.Sprint(p), fmt.Sprintf("%v %+v %#v", p, p, p)} {
		if strings.Contains(s, testPoll) || strings.Contains(s, testCode) {
			t.Errorf("a pairing formatted shows a secret: %s", s)
		}
	}
}

// The poll: pending keeps polling; approved answers the session, delivered
// once (a poll after it is not made).
func TestPollPendingThenApproved(t *testing.T) {
	f := newFake(t)
	f.script(pending, pending, approved, unknown)
	c, _ := client(t, f)
	p := begin(t, c)
	session, err := c.Wait(context.Background(), p)
	if err != nil {
		t.Fatalf("Wait: %v", err)
	}
	if session != testSession {
		t.Errorf("session %q", session)
	}
	if n := f.count(); n != 3 {
		t.Errorf("polled %d times, want 3 (pending, pending, approved)", n)
	}
	for _, tok := range f.tokens {
		if tok != testPoll {
			t.Errorf("polled with %q, want the begin's token", tok)
		}
	}
}

// The poll: expired ends it as expired.
func TestPollExpired(t *testing.T) {
	f := newFake(t)
	f.script(pending, expired)
	c, _ := client(t, f)
	_, err := c.Wait(context.Background(), begin(t, c))
	if !errors.Is(err, ErrExpired) {
		t.Fatalf("Wait: %v, want expired", err)
	}
	if n := f.count(); n != 2 {
		t.Errorf("polled %d times after expired", n)
	}
}

// 404 pair_token_unknown is expired: polling again cannot pair.
func TestPollUnknownTokenIsExpired(t *testing.T) {
	f := newFake(t)
	f.script(unknown)
	c, _ := client(t, f)
	_, err := c.Wait(context.Background(), begin(t, c))
	if !errors.Is(err, ErrExpired) {
		t.Fatalf("Wait: %v, want expired", err)
	}
	if n := f.count(); n != 1 {
		t.Errorf("polled %d times, want 1", n)
	}
}

// Constraint 3: a poll the network does not answer, a 429 or a 5xx, is tried
// again every interval until ten minutes from begin, then expired — on a fake
// clock.
func TestPollRetriesUntilTenMinutes(t *testing.T) {
	f := newFake(t)
	c, clock := client(t, f)
	start := clock.Now()
	p := begin(t, c)
	f.script(limited, answerJSON(503, `oops`), answerJSON(200, `not json`))
	_, err := c.Wait(context.Background(), p)
	if !errors.Is(err, ErrExpired) {
		t.Fatalf("Wait: %v, want expired", err)
	}
	elapsed := clock.Now().Sub(start)
	if elapsed < Lifetime || elapsed > Lifetime+DefaultInterval {
		t.Errorf("gave up after %v, want ten minutes", elapsed)
	}
	want := int(Lifetime / DefaultInterval)
	if n := f.count(); n != want {
		t.Errorf("polled %d times, want %d (every three seconds for ten minutes)", n, want)
	}

	// The network itself not answering: the same.
	g := newFake(t)
	c2, clock2 := client(t, g)
	p2 := begin(t, c2)
	g.srv.Close()
	start2 := clock2.Now()
	if _, err := c2.Wait(context.Background(), p2); !errors.Is(err, ErrExpired) {
		t.Fatalf("Wait with no network: %v, want expired", err)
	}
	if clock2.Now().Sub(start2) < Lifetime {
		t.Errorf("gave up after %v with no network, want ten minutes", clock2.Now().Sub(start2))
	}
}

// Constraint 4: no network at begin is offline.
func TestBeginOfflineSaysOffline(t *testing.T) {
	f := newFake(t)
	c, _ := client(t, f)
	f.srv.Close()
	_, err := c.Begin(context.Background())
	if !errors.Is(err, ErrOffline) {
		t.Fatalf("Begin: %v, want offline", err)
	}
}

// Decision 4: a begin the service refuses (429, 5xx) is said as expired.
func TestBeginRefusedSaysExpired(t *testing.T) {
	for _, status := range []int{http.StatusTooManyRequests, http.StatusInternalServerError} {
		f := newFake(t)
		f.beginStatus = status
		c, _ := client(t, f)
		_, err := c.Begin(context.Background())
		if !errors.Is(err, ErrExpired) || errors.Is(err, ErrOffline) {
			t.Errorf("Begin answered %d: %v, want expired", status, err)
		}
	}
}

// Constraints 2 and 11: no error names the code, the poll token or the
// session.
func TestPairingErrorsCarryNoSecret(t *testing.T) {
	var errs []error
	f := newFake(t)
	c, _ := client(t, f)
	for _, script := range [][]func(http.ResponseWriter){
		{expired}, {unknown}, {limited},
		{answerJSON(200, `{"status":"approved"}`)},
		{answerJSON(200, `{"status":"bogus","session":"`+testSession+`"}`)},
	} {
		f.script(script...)
		_, err := c.Wait(context.Background(), begin(t, c))
		errs = append(errs, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := c.Wait(ctx, begin(t, c))
	errs = append(errs, err)
	f.beginStatus = http.StatusTooManyRequests
	_, err = c.Begin(context.Background())
	errs = append(errs, err)
	f.srv.Close()
	_, err = c.Begin(context.Background())
	errs = append(errs, err)
	for _, err := range errs {
		if err == nil {
			t.Fatal("a pairing that did not pair answered no error")
		}
		msg := fmt.Sprintf("%v %+v", err, err)
		for _, secret := range []string{testCode, testPoll, testSession} {
			if strings.Contains(msg, secret) {
				t.Errorf("error %q carries a secret", msg)
			}
		}
	}
}

// Constraint 1: an origin is http(s)://host[:port], nothing more.
func TestParseOrigin(t *testing.T) {
	for _, ok := range []string{"https://estantedecifras.app", "http://localhost:8080", "https://example.test/"} {
		u, err := ParseOrigin(ok)
		if err != nil {
			t.Errorf("%s: %v", ok, err)
			continue
		}
		if s := OriginString(u); strings.HasSuffix(s, "/") {
			t.Errorf("%s kept as %s", ok, s)
		}
	}
	for _, bad := range []string{"", "estantedecifras.app", "ftp://example.test", "https://", "https://u:p@example.test",
		"https://example.test/pair", "https://example.test?x=1", "mailto:a@b"} {
		if _, err := ParseOrigin(bad); err == nil {
			t.Errorf("%q accepted", bad)
		} else if bad != "" && strings.Contains(err.Error(), bad) {
			t.Errorf("error echoes the value: %v", err)
		}
	}
}
