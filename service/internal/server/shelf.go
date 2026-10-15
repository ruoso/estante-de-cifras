package server

import (
	"context"
	"net/http"
	"regexp"

	"estantedecifras.app/service/internal/book"
	"estantedecifras.app/service/internal/session"
)

// shelf.go implements the shelf change check (api/openapi.yaml
// /api/shelf/change-check, operationId changeCheck; workflow 8; DIRECTION §3.3,
// §3.4). A device, each time it syncs, posts its whole shelf — every book with
// the head it currently holds — in one request, and learns in a single
// round-trip which books have news, so it spends a git fetch only on a book
// that moved (DIRECTION §3.3 lines 194-196). The endpoint is read-only: it
// changes no registry row and no repository, spawns no receive-pack and runs no
// hook (Constraint 7).
//
// Per the contract the endpoint answers only 200 / 400 / 401: a session is
// required (401 with no session), a malformed body is 400, and every real
// answer — including a book the caller cannot access — lives in the 200 body,
// never in an HTTP status. A batched request spans many books with mixed
// access, which no single status could express (service.change_check Decision).
//
// A book the caller cannot access is answered by the caller's own supplied
// head, not by server state (service.change_check Decision): a non-null head
// means the device cloned it, i.e. was a member of it, so losing access is
// "no longer shared with you" → gone (workflow 8 §Losing access); a null head
// is the just-added-or-never-synced case → omitted. This honors both contract
// clauses at once and leaks nothing — a nonexistent id and a real private book
// the caller cannot see are answered identically, because the gone/omit branch
// depends only on the client's head (contract: "never confirms a private book
// exists").

// gitShaPattern mirrors the contract's GitSha (api/openapi.yaml): 40 hex for
// SHA-1, 64 for SHA-256. A supplied head that is neither null nor a well-formed
// GitSha is a malformed request (Constraint 5).
var gitShaPattern = regexp.MustCompile(`^[0-9a-f]{40}([0-9a-f]{24})?$`)

// maxShelfBooks is the contract's ChangeCheckRequest.maxItems — the largest
// shelf one request may carry (api/openapi.yaml).
const maxShelfBooks = 500

// shelfBookHeadReq is one entry of ChangeCheckRequest.books (api/openapi.yaml
// ShelfBookHead): the book id and the head this device has, or null when it has
// nothing yet. Head is a pointer so a missing or null head (nil) is told apart
// from a present SHA.
type shelfBookHeadReq struct {
	BookID string  `json:"bookId"`
	Head   *string `json:"head"`
}

// changeCheckRequest is ChangeCheckRequest (api/openapi.yaml): the device's
// whole shelf, each book with its head.
type changeCheckRequest struct {
	Books []shelfBookHeadReq `json:"books"`
}

// shelfBookChange is one ShelfBookChange (api/openapi.yaml): a book with news.
// Status is changed (with its new head), unchanged (reported only for a fork's
// original — sync.fork_follow) or gone (no head). A fork the caller can access
// may carry OriginalNewSaves (≥ 1) or OriginalGone (workflow 11 §Following the
// original); both are omitted otherwise.
type shelfBookChange struct {
	BookID           string  `json:"bookId"`
	Status           string  `json:"status"`
	Head             *string `json:"head,omitempty"`
	OriginalNewSaves int     `json:"originalNewSaves,omitempty"`
	OriginalGone     bool    `json:"originalGone,omitempty"`
}

// changeCheckResponse is ChangeCheckResponse (api/openapi.yaml): only the books
// with news. Books is always a non-nil slice so an empty answer is {"books":[]},
// never {"books":null}.
type changeCheckResponse struct {
	Books []shelfBookChange `json:"books"`
}

// handleChangeCheck implements POST /api/shelf/change-check (changeCheck). It
// resolves the session, decodes and validates the batched body, resolves access
// for the whole shelf in one registry query (the resolveBookAccess predicate
// over id = ANY), reads refs/heads/main once per accessible book, and returns
// only the books with news.
func handleChangeCheck(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not run the change check.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		var req changeCheckRequest
		if err := decodeStrict(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}
		if len(req.Books) > maxShelfBooks {
			writeError(w, http.StatusBadRequest, "bad_request", "A change check carries at most 500 books.")
			return
		}
		for _, b := range req.Books {
			if b.Head != nil && !gitShaPattern.MatchString(*b.Head) {
				writeError(w, http.StatusBadRequest, "bad_request", "A head must be null or a git object id.")
				return
			}
		}

		// Resolve access for the whole shelf in one query, not one round-trip per
		// book (service.change_check Decision; DIRECTION §3.4 sizes the instance
		// on one ref read per book, not one DB round-trip per book). A non-UUID id
		// cannot be a real book and is dropped before the query; it stays
		// unresolved and is treated as inaccessible, exactly like a private book
		// the caller cannot see.
		uuidIDs := make([]string, 0, len(req.Books))
		seen := make(map[string]bool, len(req.Books))
		for _, b := range req.Books {
			if isUUID(b.BookID) && !seen[b.BookID] {
				seen[b.BookID] = true
				uuidIDs = append(uuidIDs, b.BookID)
			}
		}

		accessible, err := accessibleBooks(ctx, api, accountID, uuidIDs)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not run the change check.")
			return
		}

		// A fork follows its original (workflow 11 §Following the original;
		// sync.fork_follow). For the accessible forks only — an inaccessible fork
		// is answered exactly as any book and never carries a fork field
		// (Constraint 4) — learn which originals the caller can still access, in
		// one more query over the same predicate. Only the original the service
		// recorded at fork time is ever consulted (one step — workflow 11 lines
		// 37-38), so a fork of a fork never reports its grand-original.
		var originalIDs []string
		for _, b := range accessible {
			if b.original != "" {
				originalIDs = append(originalIDs, b.original)
			}
		}
		originalAccessible, err := accessibleBooks(ctx, api, accountID, originalIDs)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not run the change check.")
			return
		}

		// One ref read per accessible book, cached so a book listed twice is read
		// once (Constraint 2). heads holds the resolved SHA (ok=false for an empty
		// book with no refs/heads/main yet).
		store := book.Store{Root: api.BooksRoot}
		type headResult struct {
			sha string
			ok  bool
		}
		heads := make(map[string]headResult, len(accessible))
		for id := range accessible {
			sha, ok, err := store.ResolveHead(ctx, id)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not run the change check.")
				return
			}
			heads[id] = headResult{sha: sha, ok: ok}
		}

		// The fork fields, computed once per accessible fork. An original the
		// caller can no longer access — removed from it, soft-deleted, taken down
		// — or no longer recorded at all (its owner's account deleted nulled
		// original_book_id; is_fork remembers it was a fork) is gone, all four
		// answered alike. Otherwise the count of the original's saves the fork's
		// pushed main lacks (CountNewSaves answers 0 when either main is absent).
		type forkResult struct {
			newSaves int
			gone     bool
		}
		forks := make(map[string]forkResult)
		for id, b := range accessible {
			if !b.isFork {
				continue
			}
			if b.original == "" || !originalAccessible[b.original].ok {
				forks[id] = forkResult{gone: true}
				continue
			}
			n, err := store.CountNewSaves(ctx, b.original, id)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not run the change check.")
				return
			}
			forks[id] = forkResult{newSaves: n}
		}

		out := changeCheckResponse{Books: []shelfBookChange{}}
		for _, b := range req.Books {
			if accessible[b.BookID].ok {
				h := heads[b.BookID]
				if !h.ok {
					// An empty book with no main yet: nothing truthful to report,
					// whether or not the device claims a head (Constraint 4).
					continue
				}
				entry := shelfBookChange{BookID: b.BookID, Status: "unchanged"}
				if b.Head == nil || *b.Head != h.sha {
					sha := h.sha
					entry.Status = "changed"
					entry.Head = &sha
				}
				f := forks[b.BookID]
				entry.OriginalNewSaves = f.newSaves
				entry.OriginalGone = f.gone
				// In step and nothing from its original: omitted.
				if entry.Status == "changed" || entry.OriginalNewSaves > 0 || entry.OriginalGone {
					out.Books = append(out.Books, entry)
				}
				continue
			}
			// Not accessible — not a member, or deleted / taken down. A non-null
			// head is a book the device cloned and has lost access to → gone; a
			// null head is just-added-or-never-synced → omitted. The branch reads
			// only the client's head, so it leaks nothing (Decision).
			if b.Head != nil {
				out.Books = append(out.Books, shelfBookChange{BookID: b.BookID, Status: "gone"})
			}
		}

		writeJSON(w, http.StatusOK, out)
	}
}

// accessBook is one book the caller may access, with what the change check
// needs to follow a fork's original: whether the row was made by a fork
// (is_fork) and the original it recorded ("" when original_book_id is NULL).
type accessBook struct {
	ok       bool
	isFork   bool
	original string
}

// accessibleBooks returns the subset of ids the account may access as a live
// book — owner or member of a book that is not deleted and not taken down — in
// one query, reusing the resolveBookAccess predicate (books.go) over
// id = ANY($ids). Access is binary here: the change check needs only "can the
// caller read this book", not the role the git hook reads. A missing id reads
// as the zero accessBook (ok false). An empty id list skips the query.
func accessibleBooks(ctx context.Context, api *APIDeps, accountID string, ids []string) (map[string]accessBook, error) {
	accessible := make(map[string]accessBook, len(ids))
	if len(ids) == 0 {
		return accessible, nil
	}
	rows, err := api.DB.Query(ctx, `
		SELECT b.id, b.is_fork, COALESCE(b.original_book_id::text, '')
		FROM books b
		LEFT JOIN memberships m ON m.book_id = b.id AND m.account_id = $2
		WHERE b.id = ANY($1::uuid[])
		  AND b.deleted_at IS NULL
		  AND b.taken_down_reason IS NULL
		  AND (b.owner_id = $2 OR m.account_id = $2)`,
		ids, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, original string
		var isFork bool
		if err := rows.Scan(&id, &isFork, &original); err != nil {
			return nil, err
		}
		accessible[id] = accessBook{ok: true, isFork: isFork, original: original}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return accessible, nil
}
