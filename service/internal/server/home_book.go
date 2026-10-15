package server

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"estantedecifras.app/service/internal/book"
	"estantedecifras.app/service/internal/session"
)

// This file implements the account's home book on the service (api/openapi.yaml
// /api/account/home-book; docs/home-book-format.md §1, §8; workflows 1, 13): the
// one settings repository every account has, told to a signed-in device so it
// attaches it as its remote and a new device clones it first. It is materialised
// on the first request — a books row of kind 'home' and an empty bare repository
// — and every later request, from any session, concurrently or not, answers the
// same one (the partial unique index of migration 0005). The service seeds no
// commit: the home book starts local and the device pushes it (workflow 1).

// homeBookJSON is the account's home book (api/openapi.yaml HomeBook).
type homeBookJSON struct {
	ID     string `json:"id"`
	GitURL string `json:"gitUrl"`
}

// handleGetHomeBook implements GET /api/account/home-book (getHomeBook): the
// caller's home book, provisioned on the first call. Provisioning is one
// transaction: the INSERT … ON CONFLICT DO NOTHING either returns a fresh id —
// git init runs inside the open transaction, and a filesystem failure rolls the
// row back and removes any partial directory, as createBook does — or returns
// nothing because the home book exists (or a concurrent first request has just
// committed it, the index having held this one until then), and the row is read.
// It spends no book-creation rate limit and counts against no book cap: it makes
// at most one row ever per account (service.home_book Constraint 8).
func handleGetHomeBook(api *APIDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		accountID, ok, err := session.Resolve(ctx, api.DB, r)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not find the home book.")
			return
		}
		if !ok {
			writeUnauthorized(w)
			return
		}

		store := book.Store{Root: api.BooksRoot}

		tx, err := api.DB.Begin(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "Could not find the home book.")
			return
		}
		defer tx.Rollback(ctx)

		var id string
		err = tx.QueryRow(ctx, `
			INSERT INTO books (owner_id, kind) VALUES ($1, 'home')
			ON CONFLICT (owner_id) WHERE kind = 'home' DO NOTHING
			RETURNING id`, accountID).Scan(&id)
		switch {
		case err == nil:
			// A fresh home book: its empty repository, inside the transaction.
			if err := store.InitBare(ctx, id); err != nil {
				_ = store.Remove(id)
				writeError(w, http.StatusInternalServerError, "internal", "Could not find the home book.")
				return
			}
			if err := tx.Commit(ctx); err != nil {
				_ = store.Remove(id)
				writeError(w, http.StatusInternalServerError, "internal", "Could not find the home book.")
				return
			}
		case errors.Is(err, pgx.ErrNoRows):
			// It already exists: a new statement in READ COMMITTED sees the row
			// the conflicting transaction committed.
			if err := tx.QueryRow(ctx,
				`SELECT id FROM books WHERE owner_id = $1 AND kind = 'home'`, accountID).Scan(&id); err != nil {
				writeError(w, http.StatusInternalServerError, "internal", "Could not find the home book.")
				return
			}
		default:
			writeError(w, http.StatusInternalServerError, "internal", "Could not find the home book.")
			return
		}

		writeJSON(w, http.StatusOK, homeBookJSON{ID: id, GitURL: gitURL(api.PublicBaseURL, id)})
	}
}
