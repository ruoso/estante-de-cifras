package update

// Fetching from /device/ (constraints 4–6): GET <origin>/device/<name> with
// sync's HTTP client, no cookie (the payload is public; the session goes only
// where it is needed), no redirect off the origin, only a 200, and every body
// read through its limit.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// The limits a body is read through; vars so a test can lower them.
var (
	maxManifest int64 = 64 << 10
	maxFile     int64 = 32 << 20
)

// deviceClient is client without a cookie jar and with no redirect followed
// off origin.
func deviceClient(client *http.Client, origin *url.URL) *http.Client {
	if client == nil {
		client = &http.Client{}
	}
	c := *client
	c.Jar = nil
	c.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if !sameOrigin(origin, req.URL) {
			return errors.New("redirect off the origin")
		}
		if len(via) >= 10 {
			return errors.New("too many redirects")
		}
		return nil
	}
	return &c
}

// sameOrigin reports whether u has exactly origin's scheme, host and port,
// and no credentials (design §10).
func sameOrigin(origin, u *url.URL) bool {
	return u.User == nil &&
		strings.EqualFold(u.Scheme, origin.Scheme) &&
		strings.EqualFold(u.Hostname(), origin.Hostname()) &&
		portOf(u) == portOf(origin)
}

func portOf(u *url.URL) string {
	if p := u.Port(); p != "" {
		return p
	}
	switch strings.ToLower(u.Scheme) {
	case "https":
		return "443"
	case "http":
		return "80"
	}
	return ""
}

// get fetches /device/<name> from origin, refusing an answer that is not a
// 200 or a body over limit. role names the file in an error.
func get(ctx context.Context, client *http.Client, origin *url.URL, role, name string, limit int64) ([]byte, error) {
	u := origin.ResolveReference(&url.URL{Path: "/device/" + name})
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("update: %s: request: %w", role, err)
	}
	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("update: %s: fetch: %w", role, ctx.Err())
		}
		return nil, fmt.Errorf("update: %s: fetch failed", role)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("update: %s: status %d: %w", role, resp.StatusCode, ErrStatus)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, fmt.Errorf("update: %s: read failed", role)
	}
	if int64(len(body)) > limit {
		return nil, fmt.Errorf("update: %s: %w", role, ErrTooLarge)
	}
	return body, nil
}

// getChecked fetches f and refuses a body whose SHA-256 is not f's.
func getChecked(ctx context.Context, client *http.Client, origin *url.URL, role string, f File) ([]byte, error) {
	body, err := get(ctx, client, origin, role, f.Path, maxFile)
	if err != nil {
		return nil, err
	}
	if hexSum(body) != f.SHA256 {
		return nil, fmt.Errorf("update: %s: %w", role, ErrChecksum)
	}
	return body, nil
}

func hexSum(b []byte) string {
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}
