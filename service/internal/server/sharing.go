package server

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"estantedecifras.app/service/internal/book"
	"estantedecifras.app/service/internal/ratelimit"
	"estantedecifras.app/service/internal/session"
)

// This file implements the Sharing API (api/openapi.yaml /api/books/{bookId}/
// members[/{userId}], /api/books/{bookId}/invitations[/{invitationId}] and
// /api/invitations/{token}/accept; workflow 10): the member-and-invitation
// operations that open a private book (service.books) to other people. Each
// handler opens with the inline session.Resolve gate (no book without an
// account — DIRECTION §3.3) and the 404-vs-403 ladder from books.go: a caller
// who is neither owner nor member is 404 (never confirming a private book to a
// stranger), a non-owner member acting as owner is 403.
//
// The weight is in the rules, not the SQL (service.sharing Effort): the
// fifty-member cap is the service's, counted under a books-row lock inside the
// accept transaction so the fifty-first cannot slip in between a count and an
// insert; an invitation's token is a random secret stored hashed and shown
// once; accept is idempotent; who-sees-whom is filtered server-side because the
// copyright framing makes the service the enforcement point, never the client.

// maxMembersPerBook is the fifty-member cap, a code constant beside the books
// quotas (books.go) rather than a schema constraint: the owner is never a
// membership row, so the cap is a plain count(*) of memberships the service
// serializes at accept (workflow 10 lines 28-38; DIRECTION §3.3 lines 175-176).
const maxMembersPerBook = 50

// --- Pure rule helpers (unit-tested in sharing_test.go) ----------------------

// resolveExpiry turns an ExpiryChoice into an absolute deadline relative to now,
// or nil for "until-withdrawn" (api/openapi.yaml ExpiryChoice; workflow 10 lines
// 49-51). The instant is resolved and stored once at creation so a later change
// to what "a month" means cannot move an existing invitation's deadline
// (service.sharing Decisions). A choice outside the enum yields nil; the handler
// validates the enum before calling.
func resolveExpiry(choice string, now time.Time) *time.Time {
	var d time.Duration
	switch choice {
	case "day":
		d = 24 * time.Hour
	case "week":
		d = 7 * 24 * time.Hour
	case "month":
		d = 30 * 24 * time.Hour
	default: // "until-withdrawn" (and anything unvalidated) has no deadline
		return nil
	}
	t := now.Add(d)
	return &t
}

// newInvitationToken mints a high-entropy random token and returns the raw
// secret (carried once in the invitation link) alongside its hash (stored in
// invitations.token, NOT NULL UNIQUE). The raw token is the capability and is
// never stored, so a registry leak cannot expose a live invitation link
// (service.sharing Decisions; 0002_email_links.sql header note).
func newInvitationToken() (raw, hash string, err error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(b[:])
	return raw, hashToken(raw), nil
}

// hashToken reproduces the stored hash of a raw token so accept can look up the
// invitation row by hash (SHA-256, hex). It must match newInvitationToken.
func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// memberEntry is one member for the who-sees-whom filter: the opaque account id
// and the role ("owner" assembled from books.owner_id, else the membership
// role).
type memberEntry struct {
	userID string
	role   string
}

// visibleMembers applies who-sees-whom server-side (workflow 10 lines 71-75;
// api/openapi.yaml listMembers): the owner sees every member; any other caller
// sees the owner and the editors but not the other readers. The filter is the
// service's because a reader's identity must never reach a client that may not
// see it, regardless of what the UI draws (DIRECTION §3.3; service.sharing
// Decisions). count and limit stay the true numbers for every caller.
func visibleMembers(callerRole string, members []memberEntry) []memberEntry {
	if callerRole == "owner" {
		return members
	}
	visible := make([]memberEntry, 0, len(members))
	for _, m := range members {
		if m.role == "owner" || m.role == "editor" {
			visible = append(visible, m)
		}
	}
	return visible
}

// --- JSON shapes (api/openapi.yaml Sharing schemas) --------------------------

// memberJSON is one entry in a MemberList (api/openapi.yaml Member). displayName
// is omitted: accounts hold no name, and authorship uses a no-real-email address
// (DIRECTION §3.3 lines 164-169; service.sharing Decisions).
type memberJSON struct {
	UserID      string `json:"userId"`
	Role        string `json:"role"`
	DisplayName string `json:"displayName,omitempty"`
}

type memberListJSON struct {
	Members []memberJSON `json:"members"`
	Count   int          `json:"count"`
	Limit   int          `json:"limit"`
}

// joinerJSON is one joiner in an Invitation's "who joined" set (api/openapi.yaml
// Joiner). displayName is omitted for the same reason as memberJSON.
type joinerJSON struct {
	UserID   string    `json:"userId"`
	JoinedAt time.Time `json:"joinedAt"`
}

// invitationJSON is one invitation (api/openapi.yaml Invitation). URL is present
// only at creation — the raw token is unrecoverable afterwards — so it is
// omitempty and left unset by listInvitations (service.sharing Decisions).
// ExpiresAt and UseLimit are nullable (null for until-withdrawn / unlimited).
type invitationJSON struct {
	ID          string       `json:"id"`
	URL         string       `json:"url,omitempty"`
	Role        string       `json:"role"`
	Expiry      string       `json:"expiry"`
	ExpiresAt   *time.Time   `json:"expiresAt"`
	UseLimit    *int         `json:"useLimit"`
	Joined      []joinerJSON `json:"joined"`
	JoinedCount int          `json:"joinedCount"`
	Withdrawn   bool         `json:"withdrawn"`
	CreatedAt   time.Time    `json:"createdAt"`
}

type invitationListJSON struct {
	Invitations []invitationJSON `json:"invitations"`
}

// isInvitableRole reports whether s is a role an invitation or a role change may
// grant (api/openapi.yaml InvitableRole: editor, reader; the owner is never
// assigned a role this way).
func isInvitableRole(s string) bool {
	return s == "editor" || s == "reader"
}

// isExpiryChoice reports whether s is a valid ExpiryChoice (api/openapi.yaml).
func isExpiryChoice(s string) bool {
	switch s {
	case "day", "week", "month", "until-withdrawn":
		return true
	}
	return false
}

// requireOwner runs the shared owner-only gate for the five owner operations:
// the session, the UUID shape of the book id, and the 404-vs-403 ladder over
// resolveBookAccess. It writes the response and returns ok=false when the caller
// may not proceed; on ok=true the caller is the owner of a live book. action is
// the short verb used in the internal-error message (e.g. "create the
// invitation").
func (api *APIDeps) requireOwner(w http.ResponseWriter, r *http.Request, action string) (accountID, bookID string, ok bool) {
	ctx := r.Context()
	accountID, signedIn, err := session.Resolve(ctx, api.DB, r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not "+action+".")
		return "", "", false
	}
	if !signedIn {
		writeUnauthorized(w)
		return "", "", false
	}

	bookID = r.PathValue("bookId")
	if !isUUID(bookID) {
		writeError(w, http.StatusNotFound, "not_found", "No such book.")
		return "", "", false
	}

	access, found, err := resolveBookAccess(ctx, api.DB, bookID, accountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "Could not "+action+".")
		return "", "", false
	}
	if !found || access.kind == "home" {
		// Neither owner nor member: never confirm a private book to a stranger.
		// The account's home book is not a book on the sharing surface, even to
		// its owner — "no invitations, no members beyond the one owner"
		// (docs/home-book-format.md §1; service.home_book).
		writeError(w, http.StatusNotFound, "not_found", "No such book.")
		return "", "", false
	}
	if access.role != "owner" {
		// A member who is not the owner lacks the role for this action.
		writeError(w, http.StatusForbidden, "forbidden", "Only the book's owner can do that.")
		return "", "", false
	}
	return accountID, bookID, true
}

// --- Invitations -------------------------------------------------------------

// handleCreateInvitation implements POST /api/books/{bookId}/invitations
// (createInvitation, workflow 10 lines 40-61): owner only. It mints an
// invitation for a role, a resolved expiry and an optional use-limit, stores the
// token hashed, and returns 201 with the raw token carried once in the link.
// Creating an invitation on a full book is allowed — the link simply refuses
// joins until the owner removes someone (service.sharing Decisions).
func handleCreateInvitation(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		_, bookID, ok := api.requireOwner(w, r, "create the invitation")
		if !ok {
			return
		}

		var req struct {
			Role     string `json:"role"`
			Expiry   string `json:"expiry"`
			UseLimit *int   `json:"useLimit"`
		}
		if err := decodeStrict(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}
		if !isInvitableRole(req.Role) {
			writeError(w, http.StatusBadRequest, "bad_request", "An invitation grants the editor or reader role.")
			return
		}
		if req.Expiry == "" {
			req.Expiry = "week" // the schema default (api/openapi.yaml ExpiryChoice)
		}
		if !isExpiryChoice(req.Expiry) {
			writeError(w, http.StatusBadRequest, "bad_request", "That expiry is not a valid choice.")
			return
		}
		if req.UseLimit != nil && *req.UseLimit < 1 {
			writeError(w, http.StatusBadRequest, "bad_request", "A use limit is at least one.")
			return
		}

		raw, hash, err := newInvitationToken()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not create the invitation.")
			return
		}
		expiresAt := resolveExpiry(req.Expiry, time.Now())

		var id string
		var createdAt time.Time
		if err := api.DB.QueryRow(ctx,
			`INSERT INTO invitations (token, book_id, role, expiry, expires_at, uses_remaining)
			 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
			hash, bookID, req.Role, req.Expiry, expiresAt, req.UseLimit,
		).Scan(&id, &createdAt); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not create the invitation.")
			return
		}

		writeJSON(w, http.StatusCreated, invitationJSON{
			ID:          id,
			URL:         invitationURL(api.PublicBaseURL, raw),
			Role:        req.Role,
			Expiry:      req.Expiry,
			ExpiresAt:   expiresAt,
			UseLimit:    req.UseLimit,
			Joined:      []joinerJSON{},
			JoinedCount: 0,
			Withdrawn:   false,
			CreatedAt:   createdAt,
		})
	}
}

// invitationURL composes the shareable link the owner sends (service.sharing
// acceptance #1): <PublicBaseURL>/i/<raw-token>. It is the only time the raw
// token is ever returned.
func invitationURL(base, raw string) string {
	return strings.TrimRight(base, "/") + "/i/" + raw
}

// handleListInvitations implements GET /api/books/{bookId}/invitations
// (listInvitations, workflow 10 lines 54-55, 71-72): owner only. Each invitation
// carries its role, resolved expiry, remaining uses, who joined through it, and
// its withdrawn flag — url is omitted, the raw token being unrecoverable by
// design (service.sharing Decisions).
func handleListInvitations(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		_, bookID, ok := api.requireOwner(w, r, "list the invitations")
		if !ok {
			return
		}

		rows, err := api.DB.Query(ctx,
			`SELECT id, role::text, expiry::text, expires_at, uses_remaining, created_at, withdrawn_at
			 FROM invitations WHERE book_id = $1 ORDER BY created_at`, bookID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list the invitations.")
			return
		}
		defer rows.Close()

		list := invitationListJSON{Invitations: []invitationJSON{}}
		for rows.Next() {
			var inv invitationJSON
			var withdrawnAt *time.Time
			if err := rows.Scan(&inv.ID, &inv.Role, &inv.Expiry, &inv.ExpiresAt, &inv.UseLimit, &inv.CreatedAt, &withdrawnAt); err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not list the invitations.")
				return
			}
			inv.Withdrawn = withdrawnAt != nil
			inv.Joined = []joinerJSON{}
			list.Invitations = append(list.Invitations, inv)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list the invitations.")
			return
		}
		rows.Close() // free the connection before the per-invitation join queries

		// Who joined through each invitation, in one pass (the invitation count is
		// small; invitations_book_id_idx bounds the first query). A separate query
		// keeps the join rows off the aggregate above.
		for i := range list.Invitations {
			jrows, err := api.DB.Query(ctx,
				`SELECT account_id, joined_at FROM invitation_joins WHERE invitation_id = $1 ORDER BY joined_at`,
				list.Invitations[i].ID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not list the invitations.")
				return
			}
			for jrows.Next() {
				var j joinerJSON
				if err := jrows.Scan(&j.UserID, &j.JoinedAt); err != nil {
					jrows.Close()
					writeError(w, http.StatusInternalServerError, "internal", "Could not list the invitations.")
					return
				}
				list.Invitations[i].Joined = append(list.Invitations[i].Joined, j)
			}
			jrows.Close()
			if err := jrows.Err(); err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not list the invitations.")
				return
			}
			list.Invitations[i].JoinedCount = len(list.Invitations[i].Joined)
		}

		writeJSON(w, http.StatusOK, list)
	}
}

// handleWithdrawInvitation implements DELETE
// /api/books/{bookId}/invitations/{invitationId} (withdrawInvitation, workflow
// 10 lines 52-53): owner only. It sets withdrawn_at so nobody new joins, while
// those who already joined stay members. An unknown invitation on an owned book
// is 404; a re-withdrawal is idempotent (204).
func handleWithdrawInvitation(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		_, bookID, ok := api.requireOwner(w, r, "withdraw the invitation")
		if !ok {
			return
		}

		invitationID := r.PathValue("invitationId")
		if !isUUID(invitationID) {
			writeError(w, http.StatusNotFound, "not_found", "No such invitation.")
			return
		}

		tag, err := api.DB.Exec(ctx,
			`UPDATE invitations SET withdrawn_at = now()
			 WHERE id = $1 AND book_id = $2 AND withdrawn_at IS NULL`, invitationID, bookID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not withdraw the invitation.")
			return
		}
		if tag.RowsAffected() == 0 {
			// Either the invitation is not on this book (404) or it is already
			// withdrawn (idempotent 204); one existence query tells them apart.
			var one int
			err := api.DB.QueryRow(ctx, `SELECT 1 FROM invitations WHERE id = $1 AND book_id = $2`, invitationID, bookID).Scan(&one)
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusNotFound, "not_found", "No such invitation.")
				return
			}
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not withdraw the invitation.")
				return
			}
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// handleAcceptInvitation implements POST /api/invitations/{token}/accept
// (acceptInvitation, workflow 10 lines 56-61): any signed-in account, no prior
// membership. It admits the caller at the invitation's role and puts the book on
// their shelf. The whole decision runs in one transaction under a books-row lock
// so the fifty-member cap holds against concurrent accepts, and it is idempotent
// — a forwarded link opened twice by the same person (or the owner) is harmless
// and consumes no use (service.sharing Constraints, Decisions).
func handleAcceptInvitation(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, signedIn, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not accept the invitation.")
			return
		}
		if !signedIn {
			writeUnauthorized(w)
			return
		}

		// Invitation acceptance is rate-limited per account, keyed on the account
		// id the session yielded — never the path token, which stays out of logs
		// (service.rate_limits Constraint 6; redactInvitationToken).
		if !rateAllow(w, api.Limiter, ratelimit.InviteAccept, accountID) {
			return
		}

		token := r.PathValue("token")
		if token == "" {
			writeError(w, http.StatusNotFound, "not_found", "No such invitation.")
			return
		}

		bookID, err := api.acceptInvitationTx(ctx, hashToken(token), accountID)
		if err != nil {
			var conflict acceptConflict
			switch {
			case errors.Is(err, errInvitationNotFound):
				writeError(w, http.StatusNotFound, "not_found", "No such invitation.")
			case errors.As(err, &conflict):
				writeError(w, http.StatusConflict, string(conflict), conflict.message())
			default:
				writeError(w, http.StatusInternalServerError, "internal", "Could not accept the invitation.")
			}
			return
		}

		// The book is now on the caller's shelf — compose it exactly as listBooks
		// does (title from the README, the caller's role, the git URL, the fork's
		// original). resolveBookAccess yields the caller's effective role.
		store := book.Store{Root: api.BooksRoot}
		access, found, err := resolveBookAccess(ctx, api.DB, bookID, accountID)
		if err != nil || !found {
			writeError(w, http.StatusInternalServerError, "internal", "Could not accept the invitation.")
			return
		}
		bj, err := api.composeBookJSON(ctx, store, bookID, access.role)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not accept the invitation.")
			return
		}
		writeJSON(w, http.StatusOK, bj)
	}
}

// errInvitationNotFound is the accept path's "no such invitation" — an unknown
// token hash, or the invitation's book gone (soft-deleted) — both answered 404.
var errInvitationNotFound = errors.New("invitation not found")

// acceptConflict is one of the four 409 reasons an accept is refused, carrying
// the contract's machine-readable code (api/openapi.yaml acceptInvitation
// lines 557-558).
type acceptConflict string

const (
	conflictWithdrawn acceptConflict = "invitation_withdrawn"
	conflictExpired   acceptConflict = "invitation_expired"
	conflictExhausted acceptConflict = "invitation_exhausted"
	conflictBookFull  acceptConflict = "book_full"
)

func (c acceptConflict) Error() string { return string(c) }

func (c acceptConflict) message() string {
	switch c {
	case conflictWithdrawn:
		return "This invitation has been withdrawn."
	case conflictExpired:
		return "This invitation has expired."
	case conflictExhausted:
		return "This invitation has no uses left."
	case conflictBookFull:
		return "This book has reached its fifty-member limit."
	default:
		return "This invitation cannot be accepted."
	}
}

// acceptInvitationTx runs the serialized, idempotent accept against a single
// transaction, returning the book id on success. The order under the books-row
// lock (service.sharing Constraints): resolve the invitation by token hash; lock
// the book; if the caller already has access (owner or member) return it
// idempotently without touching anything; otherwise refuse withdrawn, expired,
// exhausted or full, then insert the membership and the join and decrement a
// finite use only when a membership row was actually inserted.
func (api *APIDeps) acceptInvitationTx(ctx context.Context, tokenHash, accountID string) (bookID string, err error) {
	tx, err := api.DB.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var invitationID, role string
	var expiresAt, withdrawnAt *time.Time
	var usesRemaining *int
	err = tx.QueryRow(ctx,
		`SELECT id, book_id, role::text, expires_at, uses_remaining, withdrawn_at
		 FROM invitations WHERE token = $1`, tokenHash).
		Scan(&invitationID, &bookID, &role, &expiresAt, &usesRemaining, &withdrawnAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errInvitationNotFound
	}
	if err != nil {
		return "", err
	}

	// Lock the book row so two concurrent accepts cannot both pass a count of 49
	// (service.sharing Decisions). A soft-deleted book has no live row: its
	// invitation resolves to nothing to accept. A home book is never shared, so
	// an invitation onto one (which requireOwner never mints) is refused as
	// unknown — defence in depth (service.home_book).
	var ownerID, kind string
	err = tx.QueryRow(ctx,
		`SELECT owner_id, kind FROM books WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, bookID).Scan(&ownerID, &kind)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errInvitationNotFound
	}
	if err != nil {
		return "", err
	}
	if kind == "home" {
		return "", errInvitationNotFound
	}

	// Already-has-access is an idempotent no-op: the owner, or an existing
	// member (possibly admitted through another invitation). Withdrawal, expiry,
	// exhaustion and the full-book cap bear only on a *new* join, so someone
	// already in is never refused (workflow 10 lines 52-53: those who joined
	// stay members).
	if accountID == ownerID {
		return bookID, tx.Commit(ctx)
	}
	member, err := isMember(ctx, tx, bookID, accountID)
	if err != nil {
		return "", err
	}
	if member {
		return bookID, tx.Commit(ctx)
	}

	// A genuine new join: the four refusals, in order.
	if withdrawnAt != nil {
		return "", conflictWithdrawn
	}
	if expiresAt != nil && expiresAt.Before(time.Now()) {
		return "", conflictExpired
	}
	if usesRemaining != nil && *usesRemaining <= 0 {
		return "", conflictExhausted
	}
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM memberships WHERE book_id = $1`, bookID).Scan(&count); err != nil {
		return "", err
	}
	if count >= maxMembersPerBook {
		return "", conflictBookFull
	}

	tag, err := tx.Exec(ctx,
		`INSERT INTO memberships (book_id, account_id, role) VALUES ($1, $2, $3)
		 ON CONFLICT (book_id, account_id) DO NOTHING`, bookID, accountID, role)
	if err != nil {
		return "", err
	}
	inserted := tag.RowsAffected() == 1

	if _, err := tx.Exec(ctx,
		`INSERT INTO invitation_joins (invitation_id, account_id) VALUES ($1, $2)
		 ON CONFLICT (invitation_id, account_id) DO NOTHING`, invitationID, accountID); err != nil {
		return "", err
	}

	// Decrement a finite use only when a membership was actually inserted, so a
	// repeat accept consumes nothing (service.sharing Constraints). The CHECK
	// (uses_remaining >= 0) backstops it; the pre-check above keeps it off zero.
	if inserted && usesRemaining != nil {
		if _, err := tx.Exec(ctx, `UPDATE invitations SET uses_remaining = uses_remaining - 1 WHERE id = $1`, invitationID); err != nil {
			return "", err
		}
	}

	return bookID, tx.Commit(ctx)
}

// composeBookJSON builds a Book for the shelf exactly as listBooks does (book.go):
// the title read from the README (placeholder when there is no commit), the
// caller's role, the git URL, and the fork's single-level original when present.
func (api *APIDeps) composeBookJSON(ctx context.Context, store book.Store, id, role string) (bookJSON, error) {
	var originalID *string
	if err := api.DB.QueryRow(ctx, `SELECT original_book_id FROM books WHERE id = $1`, id).Scan(&originalID); err != nil {
		return bookJSON{}, err
	}
	title, found := store.ReadTitle(ctx, id)
	if !found {
		title = book.PlaceholderTitle
	}
	bj := bookJSON{
		ID:         id,
		Title:      title,
		Role:       role,
		Visibility: "private",
		GitURL:     gitURL(api.PublicBaseURL, id),
	}
	if originalID != nil {
		bj.Original = &originalJSON{BookID: *originalID}
		if ot, ok := store.ReadTitle(ctx, *originalID); ok {
			bj.Original.Title = &ot
		}
	}
	return bj, nil
}

// --- Members -----------------------------------------------------------------

// handleListMembers implements GET /api/books/{bookId}/members (listMembers,
// workflow 10 lines 71-75): open to any member. It returns the members the
// caller may see — the owner sees all, a non-owner sees the owner and the
// editors only — with the true count (members besides the owner) against the
// fixed limit of fifty. The filter is server-side (service.sharing Decisions).
func handleListMembers(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, signedIn, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list the members.")
			return
		}
		if !signedIn {
			writeUnauthorized(w)
			return
		}

		bookID := r.PathValue("bookId")
		if !isUUID(bookID) {
			writeError(w, http.StatusNotFound, "not_found", "No such book.")
			return
		}

		access, found, err := resolveBookAccess(ctx, api.DB, bookID, accountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list the members.")
			return
		}
		if !found || access.kind == "home" {
			// A stranger is told the book does not exist (never confirming it);
			// the home book has no members to list, even to its owner
			// (service.home_book).
			writeError(w, http.StatusNotFound, "not_found", "No such book.")
			return
		}

		// The owner is books.owner_id, never a membership row (schema), so it is
		// prepended with role "owner"; count is the membership rows only.
		entries := []memberEntry{{userID: access.ownerID, role: "owner"}}
		rows, err := api.DB.Query(ctx, `SELECT account_id, role::text FROM memberships WHERE book_id = $1 ORDER BY created_at`, bookID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list the members.")
			return
		}
		defer rows.Close()
		count := 0
		for rows.Next() {
			var e memberEntry
			if err := rows.Scan(&e.userID, &e.role); err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not list the members.")
				return
			}
			entries = append(entries, e)
			count++
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not list the members.")
			return
		}

		visible := visibleMembers(access.role, entries)
		out := memberListJSON{Members: make([]memberJSON, 0, len(visible)), Count: count, Limit: maxMembersPerBook}
		for _, e := range visible {
			out.Members = append(out.Members, memberJSON{UserID: e.userID, Role: e.role})
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// handleChangeMemberRole implements PATCH /api/books/{bookId}/members/{userId}
// (changeMemberRole, workflow 10 lines 63-69, 77-85): owner only. It moves a
// member between editor and reader; the new role governs the member's next
// request, read lazily by resolveBookAccess (service.sharing Decisions). The
// owner is never assigned a role this way, and a userId with no membership row
// (including the owner's own id) is 404.
func handleChangeMemberRole(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		_, bookID, ok := api.requireOwner(w, r, "change the member")
		if !ok {
			return
		}

		userID := r.PathValue("userId")
		if !isUUID(userID) {
			writeError(w, http.StatusNotFound, "not_found", "No such member.")
			return
		}

		var req struct {
			Role string `json:"role"`
		}
		if err := decodeStrict(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request", "The request body did not conform.")
			return
		}
		if !isInvitableRole(req.Role) {
			writeError(w, http.StatusBadRequest, "bad_request", "A member is an editor or a reader.")
			return
		}

		tag, err := api.DB.Exec(ctx, `UPDATE memberships SET role = $3 WHERE book_id = $1 AND account_id = $2`, bookID, userID, req.Role)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not change the member.")
			return
		}
		if tag.RowsAffected() == 0 {
			// No membership row for this user (the owner has none either): 404.
			writeError(w, http.StatusNotFound, "not_found", "No such member.")
			return
		}

		writeJSON(w, http.StatusOK, memberJSON{UserID: userID, Role: req.Role})
	}
}

// handleRemoveMember implements DELETE /api/books/{bookId}/members/{userId}
// (removeMember, workflow 10 lines 77-85): owner only. It drops the membership;
// the book then resolves inaccessible to that account at its next request (its
// listBooks omits it, its push is refused by git), lazily, with nothing in
// flight to interrupt (service.sharing Decisions). The historical
// invitation_joins rows are left untouched — the owner's "who joined" record is
// history (workflow 10 line 52).
func handleRemoveMember(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		_, bookID, ok := api.requireOwner(w, r, "remove the member")
		if !ok {
			return
		}

		userID := r.PathValue("userId")
		if !isUUID(userID) {
			writeError(w, http.StatusNotFound, "not_found", "No such member.")
			return
		}

		tag, err := api.DB.Exec(ctx, `DELETE FROM memberships WHERE book_id = $1 AND account_id = $2`, bookID, userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not remove the member.")
			return
		}
		if tag.RowsAffected() == 0 {
			writeError(w, http.StatusNotFound, "not_found", "No such member.")
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
