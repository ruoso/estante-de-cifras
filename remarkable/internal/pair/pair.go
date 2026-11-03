// Package pair is the reader's side of pairing with an account
// (reader.pairing; docs/remarkable-reader.md §5.1 *On the device*, workflow 19
// §Pairing): it begins a pairing with the service at one origin, answers the
// code the person types on their phone or computer, and polls with the poll
// token only it holds until the code is approved, has expired, or its ten
// minutes are over.
//
// The poll token is a secret: it lives in a Pairing's unexported field, in
// memory only, and never reaches a message to the frontend, a file, a log or
// an error. The session an approval delivers is handed to the caller, which
// keeps it in the store; it is never in an error either. The code is on the
// screen, but never in an error or a log. Errors name the step and, at most,
// an HTTP status.
//
// Speaks only the API contract (api/openapi.yaml beginDevicePairing,
// pollDevicePairing); no code is shared with the service.
package pair

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// DefaultOrigin is the service the reader pairs with unless told otherwise:
// www, where the site is served. The bare estantedecifras.app only forwards
// there (DIRECTION §3.3), and a forwarded POST arrives as a GET.
const DefaultOrigin = "https://www.estantedecifras.app"

// DefaultInterval is how often the poll asks: every three seconds, well under
// the service's 120 a minute per client.
const DefaultInterval = 3 * time.Second

// Lifetime is how long a code holds (the service's ten minutes): unanswered
// polls are retried until this long after begin, then the code has expired.
const Lifetime = 10 * time.Minute

// requestTimeout bounds one begin or poll request.
const requestTimeout = 30 * time.Second

// maxBody bounds an answer.
const maxBody = 64 << 10

// The ends of a pairing that is not approved, for errors.Is. Workflow 19
// §Pairing has two sentences for them: the offline one and the expired one.
var (
	// ErrOffline: the service could not be reached to begin.
	ErrOffline = errors.New("offline")
	// ErrExpired: the code expired — the service said so, forgot the token,
	// refused to begin (a 429, a 5xx, a malformed answer: Decision 4), or the
	// ten minutes passed with no answer.
	ErrExpired = errors.New("the code expired")
)

// errUnanswered is a poll the network or the service did not answer well
// (a transport error, a 429, a 5xx, a malformed answer): tried again.
var errUnanswered = errors.New("unanswered")

// Code is what the person is shown: the code, the address to type it at and
// when it expires (RFC 3339). It holds no secret.
type Code struct {
	Code      string `json:"code"`
	URL       string `json:"url"`
	ExpiresAt string `json:"expiresAt"`
}

// Pairing is a pairing begun: the code shown and, unexported, the poll token
// and when it began. Dropping it drops the token.
type Pairing struct {
	code      Code
	pollToken string
	begun     time.Time
}

// Code is what the person is shown.
func (p *Pairing) Code() Code { return p.code }

// String names a pairing without its code or token, so a %v never leaks one.
func (p *Pairing) String() string { return "pairing" }

// GoString is String, for %#v.
func (p *Pairing) GoString() string { return "pairing" }

// Client pairs with one origin. The zero values of its seams are the real
// ones.
type Client struct {
	// Origin is the service, scheme://host[:port].
	Origin *url.URL
	// HTTP makes the requests (http.DefaultClient when nil).
	HTTP *http.Client
	// Interval is the poll's period (DefaultInterval when zero).
	Interval time.Duration
	// Now is the clock the ten minutes are counted on (time.Now, monotonic,
	// when nil).
	Now func() time.Time
	// After waits d (time.After when nil); a test's fake clock advances here.
	After func(d time.Duration) <-chan time.Time
}

// ParseOrigin reads an origin: http(s)://host[:port], nothing else — no
// user, path, query or fragment. The error never echoes the value.
func ParseOrigin(s string) (*url.URL, error) {
	u, err := url.Parse(s)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") ||
		u.User != nil || (u.Path != "" && u.Path != "/") || u.RawQuery != "" || u.Fragment != "" || u.Opaque != "" {
		return nil, errors.New("not an http(s) origin")
	}
	return &url.URL{Scheme: u.Scheme, Host: u.Host}, nil
}

// OriginString is u as the session keeps it: scheme://host[:port].
func OriginString(u *url.URL) string { return u.Scheme + "://" + u.Host }

func (c *Client) http() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}

func (c *Client) now() time.Time {
	if c.Now != nil {
		return c.Now()
	}
	return time.Now()
}

func (c *Client) after(d time.Duration) <-chan time.Time {
	if c.After != nil {
		return c.After(d)
	}
	return time.After(d)
}

func (c *Client) interval() time.Duration {
	if c.Interval > 0 {
		return c.Interval
	}
	return DefaultInterval
}

// post makes one POST to path with body (nil: none) and answers the status
// and up to maxBody of the answer. A transport failure is errUnanswered (or
// ctx's error once ctx has ended).
func (c *Client) post(ctx context.Context, path string, body any) (int, []byte, error) {
	rctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()
	var rd io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return 0, nil, errUnanswered
		}
		rd = bytes.NewReader(raw)
	}
	u := c.Origin.ResolveReference(&url.URL{Path: path})
	req, err := http.NewRequestWithContext(rctx, http.MethodPost, u.String(), rd)
	if err != nil {
		return 0, nil, errUnanswered
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http().Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return 0, nil, ctx.Err()
		}
		return 0, nil, errUnanswered
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxBody))
	if err != nil {
		if ctx.Err() != nil {
			return 0, nil, ctx.Err()
		}
		return 0, nil, errUnanswered
	}
	return resp.StatusCode, raw, nil
}

// Begin begins a pairing (POST /api/devices/pair/begin): the code to show
// and the poll token, kept in the Pairing. No network: ErrOffline. A refusal
// or an answer that is not the contract's: ErrExpired (Decision 4).
func (c *Client) Begin(ctx context.Context) (*Pairing, error) {
	begun := c.now()
	status, raw, err := c.post(ctx, "/api/devices/pair/begin", nil)
	switch {
	case errors.Is(err, errUnanswered):
		return nil, fmt.Errorf("pair: begin: %w", ErrOffline)
	case err != nil:
		return nil, fmt.Errorf("pair: begin: %w", err)
	case status != http.StatusCreated:
		return nil, fmt.Errorf("pair: begin: status %d: %w", status, ErrExpired)
	}
	var a struct {
		Code      string `json:"code"`
		URL       string `json:"url"`
		PollToken string `json:"pollToken"`
		ExpiresAt string `json:"expiresAt"`
	}
	if json.Unmarshal(raw, &a) != nil || a.Code == "" || a.URL == "" || a.PollToken == "" || a.ExpiresAt == "" {
		return nil, fmt.Errorf("pair: begin: answer is not the contract's: %w", ErrExpired)
	}
	if _, err := time.Parse(time.RFC3339, a.ExpiresAt); err != nil {
		return nil, fmt.Errorf("pair: begin: answer is not the contract's: %w", ErrExpired)
	}
	return &Pairing{
		code:      Code{Code: a.Code, URL: a.URL, ExpiresAt: a.ExpiresAt},
		pollToken: a.PollToken,
		begun:     begun,
	}, nil
}

// poll asks once (POST /api/devices/pair/poll): the session once approved,
// "" while pending; ErrExpired when the service says expired or forgot the
// token (404 pair_token_unknown); errUnanswered for anything to try again.
func (c *Client) poll(ctx context.Context, p *Pairing) (string, error) {
	status, raw, err := c.post(ctx, "/api/devices/pair/poll", struct {
		PollToken string `json:"pollToken"`
	}{p.pollToken})
	switch {
	case err != nil:
		return "", err
	case status == http.StatusNotFound, status == http.StatusBadRequest:
		// The token is unknown (never given, or its session delivered), or
		// the request is one the service will never accept: polling again
		// cannot pair.
		return "", ErrExpired
	case status != http.StatusOK:
		return "", errUnanswered
	}
	var a struct {
		Status  string `json:"status"`
		Session string `json:"session"`
	}
	if json.Unmarshal(raw, &a) != nil {
		return "", errUnanswered
	}
	switch {
	case a.Status == "pending":
		return "", nil
	case a.Status == "expired":
		return "", ErrExpired
	case a.Status == "approved" && a.Session != "":
		return a.Session, nil
	}
	return "", errUnanswered
}

// Wait polls p every Interval until the code is approved, and answers the
// session (delivered once by the service). It answers ErrExpired when the
// service says so or forgets the token, or when polls go unanswered until
// Lifetime after begin; ctx's error when ctx ends.
func (c *Client) Wait(ctx context.Context, p *Pairing) (string, error) {
	for {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-c.after(c.interval()):
		}
		session, err := c.poll(ctx, p)
		switch {
		case err == nil && session != "":
			return session, nil
		case errors.Is(err, ErrExpired):
			return "", fmt.Errorf("pair: poll: %w", ErrExpired)
		case ctx.Err() != nil:
			return "", ctx.Err()
		case errors.Is(err, errUnanswered):
			if c.now().Sub(p.begun) >= Lifetime {
				return "", fmt.Errorf("pair: poll: no answer for ten minutes: %w", ErrExpired)
			}
		}
	}
}
