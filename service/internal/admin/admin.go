// Package admin is the operator's three moderation actions behind workflow 10's
// "A copyright notice": withdraw a book's invitations, remove its members, or
// take the book down. They are a server-side operator tool, not an app feature
// and not an HTTP endpoint (workflow 10 line 106; refinement Decisions) — the
// thin command in service/cmd/estante-admin parses arguments and opens the pool,
// and these functions do the work, so the real operations are testable against
// real Postgres without a main.
//
// Each action is one transaction: the mutation and the book_notices record
// commit together, so a notice without its effect — or an effect without its
// notice — is impossible (refinement Constraints). The notice is the durable
// record behind "the owner is told why" (migration 0004_book_notices.sql); for a
// take-down the reason also reaches the book's owner and members over the git
// refusal (service/internal/server/git.go). The actions move registry rows and a
// book-lifecycle flag; they never parse a song, so there is no cifra.md work and
// no song text to keep out of logs here — the reason is legal text, stored in a
// table (refinement Repository, Standing rules).
package admin

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// Action is a book_notices.action value — the three moderation actions, matching
// the CHECK in migration 0004_book_notices.sql and the command's subcommands.
type Action string

const (
	ActionTakeDown            Action = "take_down"
	ActionWithdrawInvitations Action = "withdraw_invitations"
	ActionRemoveMembers       Action = "remove_members"
)

// ErrNoBook is returned when the target is not a live (non-deleted) book — an
// unknown id or a book the owner has already deleted. The operator is given a
// clear message and nothing is written (refinement Constraints: "a deleted book
// is already gone — refuse with a message, write nothing").
var ErrNoBook = errors.New("no such live book")

// ErrEmptyReason is returned when the reason is empty. Every action requires a
// non-empty reason — it is the durable record's point — and the command's
// argument parser enforces it too (refinement Constraints §1); the guard here is
// the operation's own invariant, so a caller cannot record an empty notice.
var ErrEmptyReason = errors.New("a reason is required")

// Beginner is the subset of the pgx pool/transaction surface these operations
// need: the ability to open a transaction. Both *pgxpool.Pool and pgx.Tx satisfy
// it, so the command passes its pool and a test can pass either.
type Beginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// TakeDown sets books.taken_down_reason to the operator's reason and records a
// take_down notice, in one transaction. The book stops being reachable for
// everyone (its repository stays on the volume); its owner and members learn why
// at their next git request, and it shows gone on every shelf. A deleted book is
// already gone (ErrNoBook, no write); a re-run overwrites the reason and records
// a fresh notice. Pins workflow 10 lines 103-106, 111-113.
func TakeDown(ctx context.Context, db Beginner, bookID, reason string) error {
	if reason == "" {
		return ErrEmptyReason
	}
	return inTx(ctx, db, func(tx pgx.Tx) error {
		var ownerID string
		err := tx.QueryRow(ctx,
			`UPDATE books SET taken_down_reason = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING owner_id`,
			bookID, reason).Scan(&ownerID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoBook
		}
		if err != nil {
			return err
		}
		return insertNotice(ctx, tx, bookID, ownerID, ActionTakeDown, reason)
	})
}

// WithdrawInvitations sets withdrawn_at on every one of the book's invitations
// that is not already withdrawn, and records a withdraw_invitations notice, in
// one transaction. Nobody new joins through any of them; those who already
// joined stay members (workflow 10 lines 52-53). It is idempotent: a re-run
// withdraws nothing new and records no new notice (the notice is written only
// when the action actually withdrew an invitation — refinement Decisions). An
// unknown or deleted book is ErrNoBook with no write.
func WithdrawInvitations(ctx context.Context, db Beginner, bookID, reason string) error {
	if reason == "" {
		return ErrEmptyReason
	}
	return inTx(ctx, db, func(tx pgx.Tx) error {
		ownerID, err := liveBookOwner(ctx, tx, bookID)
		if err != nil {
			return err
		}
		tag, err := tx.Exec(ctx,
			`UPDATE invitations SET withdrawn_at = now() WHERE book_id = $1 AND withdrawn_at IS NULL`,
			bookID)
		if err != nil {
			return err
		}
		// Idempotent: a re-run that withdraws nothing new records no notice, so a
		// repeated operator run does not accrue empty records.
		if tag.RowsAffected() == 0 {
			return nil
		}
		return insertNotice(ctx, tx, bookID, ownerID, ActionWithdrawInvitations, reason)
	})
}

// RemoveMembers deletes every membership row of the book and records a
// remove_members notice, in one transaction. The book becomes private to its
// owner again; each removed member loses access at their next request
// (resolveBookAccess miss) and sees "no longer shared with you" on their shelf
// (workflow 10 lines 77-81, workflow 8). invitation_joins rows are history and
// are left untouched (workflow 10 line 52); the owner is never a membership row,
// so ownership is unaffected. An unknown or deleted book is ErrNoBook, no write.
func RemoveMembers(ctx context.Context, db Beginner, bookID, reason string) error {
	if reason == "" {
		return ErrEmptyReason
	}
	return inTx(ctx, db, func(tx pgx.Tx) error {
		ownerID, err := liveBookOwner(ctx, tx, bookID)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx,
			`DELETE FROM memberships WHERE book_id = $1`, bookID); err != nil {
			return err
		}
		return insertNotice(ctx, tx, bookID, ownerID, ActionRemoveMembers, reason)
	})
}

// liveBookOwner reads the owner of a live (non-deleted) book, or ErrNoBook when
// there is no such book. It is the existence check withdraw and remove make
// before mutating, and the source of the owner the notice captures.
func liveBookOwner(ctx context.Context, tx pgx.Tx, bookID string) (string, error) {
	var ownerID string
	err := tx.QueryRow(ctx,
		`SELECT owner_id FROM books WHERE id = $1 AND deleted_at IS NULL`,
		bookID).Scan(&ownerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNoBook
	}
	if err != nil {
		return "", err
	}
	return ownerID, nil
}

// insertNotice writes the book_notices row every action records: the book, the
// owner as it stood at action time, the action, and the reason (migration 0004).
func insertNotice(ctx context.Context, tx pgx.Tx, bookID, ownerID string, action Action, reason string) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO book_notices (book_id, owner_id, action, reason) VALUES ($1, $2, $3, $4)`,
		bookID, ownerID, string(action), reason)
	return err
}

// inTx runs fn inside a transaction, committing on success and rolling back on
// any error, so the mutation and the notice insert are atomic (a notice without
// its effect, or an effect without its notice, is impossible).
func inTx(ctx context.Context, db Beginner, fn func(pgx.Tx) error) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("admin: begin: %w", err)
	}
	defer tx.Rollback(ctx)
	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("admin: commit: %w", err)
	}
	return nil
}
