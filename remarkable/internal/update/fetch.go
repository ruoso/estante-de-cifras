package update

// Fetching a release (§8, §10): GET with sync's HTTP client, no cookie (a
// release is public; the session goes only to the service), only https, and
// redirects followed only to GitHub — releases/latest/download answers with
// a redirect to the release's asset on GitHub's asset hosts — only a 200,
// and every body read through its limit.

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

// releaseHost reports whether u is one GitHub serves releases from: github.com
// and its asset hosts (objects. and release-assets.githubusercontent.com).
// A test lets its own server through.
var releaseHost = func(u *url.URL) bool {
	if u.Scheme != "https" || u.User != nil {
		return false
	}
	h := strings.ToLower(u.Hostname())
	return h == "github.com" || strings.HasSuffix(h, ".githubusercontent.com")
}

// releaseClient is client without a cookie jar, following redirects only to
// a release host.
func releaseClient(client *http.Client) *http.Client {
	if client == nil {
		client = &http.Client{}
	}
	c := *client
	c.Jar = nil
	c.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if !releaseHost(req.URL) {
			return errors.New("redirect off GitHub")
		}
		if len(via) >= 10 {
			return errors.New("too many redirects")
		}
		return nil
	}
	return &c
}

// get fetches raw, refusing a URL off GitHub, an answer that is not a 200 or a
// body over limit. role names the file in an error.
func get(ctx context.Context, client *http.Client, raw, role string, limit int64) ([]byte, error) {
	u, err := url.Parse(raw)
	if err != nil || !releaseHost(u) {
		return nil, fmt.Errorf("update: %s: not a release URL", role)
	}
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

func hexSum(b []byte) string {
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}
