package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// schemaMigrationsDDL creates the migrator's own bookkeeping table (refinement
// table 9). It is unqualified, so it lands in the connection's current schema
// (search_path) — the same place the migrations themselves create their
// tables — which is how a test migrates into a throwaway schema. CREATE TABLE
// IF NOT EXISTS makes ensuring it idempotent.
const schemaMigrationsDDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    integer     PRIMARY KEY,
    name       text        NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
)`

// Migrate applies every pending embedded migration, in version order, each in
// its own transaction, recording it in schema_migrations as it goes. It is
// idempotent — a second run with nothing pending touches no schema and inserts
// no rows — and forward-only (there are no down migrations; DIRECTION §3.4).
// run() calls it at start-up before serving and fails fast if it errors.
//
// All work runs on a single acquired connection so the search_path stays
// consistent across the whole run; the migrator never names a schema, so a
// test can point a pool's search_path at a freshly-created, uniquely-named
// schema and get an empty→latest migration isolated from every other run.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("db: acquiring a connection to migrate: %w", err)
	}
	defer conn.Release()
	return migrateConn(ctx, conn.Conn())
}

// migrateConn is Migrate's body on one connection; split out so the behavior
// test can drive it directly if it wants a single connection.
func migrateConn(ctx context.Context, conn *pgx.Conn) error {
	migrations, err := loadMigrations()
	if err != nil {
		return err
	}

	if _, err := conn.Exec(ctx, schemaMigrationsDDL); err != nil {
		return fmt.Errorf("db: ensuring schema_migrations: %w", err)
	}

	applied, err := appliedVersions(ctx, conn)
	if err != nil {
		return err
	}

	for _, m := range plan(migrations, applied) {
		if err := applyOne(ctx, conn, m); err != nil {
			return err
		}
	}
	return nil
}

// appliedVersions reads the set of migration versions schema_migrations already
// records, so plan can select only the pending steps.
func appliedVersions(ctx context.Context, conn *pgx.Conn) (map[int]bool, error) {
	rows, err := conn.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, fmt.Errorf("db: reading applied migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[int]bool)
	for rows.Next() {
		var version int
		if err := rows.Scan(&version); err != nil {
			return nil, fmt.Errorf("db: scanning an applied migration: %w", err)
		}
		applied[version] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("db: reading applied migrations: %w", err)
	}
	return applied, nil
}

// applyOne runs a single migration's SQL and records it, together, in one
// transaction: a half-applied step can never be recorded as done. The error
// names the migration (version and name) only — never the SQL's data, the DSN
// or a credential.
func applyOne(ctx context.Context, conn *pgx.Conn, m migration) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("db: beginning migration %04d_%s: %w", m.Version, m.Name, err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, m.SQL); err != nil {
		return fmt.Errorf("db: applying migration %04d_%s: %w", m.Version, m.Name, err)
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`,
		m.Version, m.Name); err != nil {
		return fmt.Errorf("db: recording migration %04d_%s: %w", m.Version, m.Name, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("db: committing migration %04d_%s: %w", m.Version, m.Name, err)
	}
	return nil
}
