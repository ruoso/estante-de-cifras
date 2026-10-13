// Command estante-admin is the operator's tool for a copyright notice
// (workflow 10 lines 103-115): withdraw a book's invitations, remove its
// members, or take it down, each recording the reason, durably, against the book.
// It is run by the operator inside the service container with the service's own
// environment (ESTANTE_DATABASE_URL and the rest config.Load reads); it is not an
// HTTP endpoint and not an app feature (refinement Decisions). The subcommand and
// its arguments are parsed by the pure parseArgs; the operation itself lives in
// internal/admin so it is testable against real Postgres without this main.
//
// It logs the action, the book id and the outcome only — never the operator's
// reason, which is legal text recorded in the book_notices table, not a log line
// (refinement Standing rules: no song text or secrets in logs).
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"estantedecifras.app/service/internal/admin"
	"estantedecifras.app/service/internal/config"
	"estantedecifras.app/service/internal/db"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		// Operator errors go to stderr; nothing is written to the registry on a
		// parse or a refusal (refinement Constraints §1).
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(argv []string) error {
	cmd, err := parseArgs(argv)
	if err != nil {
		return err
	}

	cfg, err := config.Load(os.LookupEnv)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	var opErr error
	switch cmd.action {
	case admin.ActionTakeDown:
		opErr = admin.TakeDown(ctx, pool, cmd.bookID, cmd.reason)
	case admin.ActionWithdrawInvitations:
		opErr = admin.WithdrawInvitations(ctx, pool, cmd.bookID, cmd.reason)
	case admin.ActionRemoveMembers:
		opErr = admin.RemoveMembers(ctx, pool, cmd.bookID, cmd.reason)
	default:
		// Unreachable: parseArgs only yields the three known actions.
		return fmt.Errorf("unknown action %q", cmd.action)
	}
	if opErr != nil {
		// The action, book and outcome are logged; the reason is not (it lives in
		// book_notices, not the log).
		logger.LogAttrs(ctx, slog.LevelError, "admin action failed",
			slog.String("action", string(cmd.action)),
			slog.String("book", cmd.bookID),
			slog.String("error", opErr.Error()))
		return opErr
	}

	logger.LogAttrs(ctx, slog.LevelInfo, "admin action done",
		slog.String("action", string(cmd.action)),
		slog.String("book", cmd.bookID))
	return nil
}
