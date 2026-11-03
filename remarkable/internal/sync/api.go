package sync

// The two API reads a pass makes (api/openapi.yaml): getHomeBook and
// changeCheck; and signOut, which ends this device's session when the person
// signs it out (reader.pairing). Nothing here writes to the account: changeCheck is a POST by
// the contract and a read by its meaning. The session cookie goes only to the
// session's origin, and no error carries it, or a link, or a book's words.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// cookieName is the service's session cookie (openapi.yaml estante_session).
const cookieName = "estante_session"

// The failures of an API read, for a pass to tell apart.
var (
	// errSignedOut: the service answered 401 — the session no longer holds.
	errSignedOut = errors.New("signed out")
	// errOffline: the service could not be reached, or did not answer well.
	errOffline = errors.New("offline")
)

// maxAPIBody bounds what an API answer may be.
const maxAPIBody = 4 << 20

type api struct {
	client *http.Client
	origin *url.URL
	token  string
}

// homeBook is getHomeBook's answer.
type homeBook struct {
	ID     string `json:"id"`
	GitURL string `json:"gitUrl"`
}

// shelfHead is one book and the head this device has (null for none).
type shelfHead struct {
	BookID string  `json:"bookId"`
	Head   *string `json:"head"`
}

// bookChange is one book with news.
type bookChange struct {
	BookID string `json:"bookId"`
	Status string `json:"status"`
	Head   string `json:"head"`
}

// call makes one request to the origin and decodes the JSON answer. step
// names the call in an error, which carries only the step and a status.
func (a *api) call(ctx context.Context, step, method, path string, body, out any) error {
	u := a.origin.ResolveReference(&url.URL{Path: path})
	var rd io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("sync: %s: encode: %w", step, err)
		}
		rd = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, u.String(), rd)
	if err != nil {
		return fmt.Errorf("sync: %s: %w", step, errOffline)
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.AddCookie(&http.Cookie{Name: cookieName, Value: a.token})
	resp, err := a.client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return fmt.Errorf("sync: %s: %w", step, ctx.Err())
		}
		return fmt.Errorf("sync: %s: %w", step, errOffline)
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusUnauthorized:
		return fmt.Errorf("sync: %s: %w", step, errSignedOut)
	case resp.StatusCode != http.StatusOK:
		return fmt.Errorf("sync: %s: status %d: %w", step, resp.StatusCode, errOffline)
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, maxAPIBody)).Decode(out); err != nil {
		return fmt.Errorf("sync: %s: answer is not the contract's: %w", step, errOffline)
	}
	return nil
}

// getHomeBook: GET /api/account/home-book.
func (a *api) getHomeBook(ctx context.Context) (homeBook, error) {
	var hb homeBook
	if err := a.call(ctx, "homeBook", http.MethodGet, "/api/account/home-book", nil, &hb); err != nil {
		return homeBook{}, err
	}
	if hb.ID == "" || hb.GitURL == "" {
		return homeBook{}, fmt.Errorf("sync: homeBook: answer is not the contract's: %w", errOffline)
	}
	return hb, nil
}

// changeCheck: POST /api/shelf/change-check with every shelf book and its
// head, answered by book id.
func (a *api) changeCheck(ctx context.Context, heads []shelfHead) (map[string]bookChange, error) {
	if heads == nil {
		heads = []shelfHead{}
	}
	var resp struct {
		Books []bookChange `json:"books"`
	}
	if err := a.call(ctx, "changeCheck", http.MethodPost, "/api/shelf/change-check",
		struct {
			Books []shelfHead `json:"books"`
		}{heads}, &resp); err != nil {
		return nil, err
	}
	out := make(map[string]bookChange, len(resp.Books))
	for _, c := range resp.Books {
		out[c.BookID] = c
	}
	return out, nil
}

// signOut: POST /api/auth/signout — ends this device's session with the
// service. Any answer is an answer: 204 ends it, 401 says it had ended.
func (a *api) signOut(ctx context.Context) error {
	u := a.origin.ResolveReference(&url.URL{Path: "/api/auth/signout"})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), nil)
	if err != nil {
		return fmt.Errorf("sync: signOut: %w", errOffline)
	}
	req.Header.Set("Accept", "application/json")
	req.AddCookie(&http.Cookie{Name: cookieName, Value: a.token})
	resp, err := a.client.Do(req)
	if err != nil {
		return fmt.Errorf("sync: signOut: %w", errOffline)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, io.LimitReader(resp.Body, maxAPIBody))
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusUnauthorized {
		return fmt.Errorf("sync: signOut: status %d: %w", resp.StatusCode, errOffline)
	}
	return nil
}
