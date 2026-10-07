package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Open builds the service's Postgres connection pool from a DSN — the value of
// ESTANTE_DATABASE_URL (refinement Constraints). It parses the DSN and sets the
// pool up; pgx connects lazily, so run() proves the database is reachable by
// calling Migrate next. The DSN carries the password and is never logged: this
// function neither prints it nor echoes it, and pgx's own parse errors redact
// the password.
func Open(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("db: opening the Postgres connection pool: %w", err)
	}
	return pool, nil
}
