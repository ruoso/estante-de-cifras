// Package db owns the service's single Postgres connection pool and the
// embedded, forward-only, versioned migrator that takes an empty database to
// the current registry schema (service.schema). It is the service's first
// contact with Postgres: every later service.* task persists against the
// tables the migrations here create, and consumes this pool.
//
// The migrator is deliberately small (refinement Decisions): numbered .sql
// files embedded with //go:embed, applied in lexical order, each inside its
// own transaction, tracked by a schema_migrations table. There are no down
// migrations — on a single instance (DIRECTION §3.4) recovery is
// restore-from-backup, not a rollback. The parsing, ordering and planning in
// this file are pure (no database), so they are unit-tested without one; the
// application lives in migrate.go.
package db

import (
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"
)

// migrationsFS holds the versioned SQL under migrations/, compiled into the
// binary so the deployed image needs no migration files or CLI beside it.
//
//go:embed migrations/*.sql
var migrationsFS embed.FS

// migration is one versioned step: a positive version, a human name, and the
// SQL that advances the schema by exactly that step.
type migration struct {
	Version int
	Name    string
	SQL     string
}

// loadMigrations reads the embedded set, parsing each NNNN_name.sql filename
// into a version and a name, and returns them sorted by version after checking
// they form a well-named, strictly increasing sequence. It is pure: the result
// depends only on the embedded files, so the planner and the validation below
// are unit-testable with no database.
func loadMigrations() ([]migration, error) {
	entries, err := fs.ReadDir(migrationsFS, "migrations")
	if err != nil {
		return nil, fmt.Errorf("db: reading embedded migrations: %w", err)
	}

	var migrations []migration
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		m, err := parseMigrationName(entry.Name())
		if err != nil {
			return nil, err
		}
		sql, err := fs.ReadFile(migrationsFS, "migrations/"+entry.Name())
		if err != nil {
			return nil, fmt.Errorf("db: reading migration %q: %w", entry.Name(), err)
		}
		m.SQL = string(sql)
		migrations = append(migrations, m)
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	if err := validateSequence(migrations); err != nil {
		return nil, err
	}
	return migrations, nil
}

// parseMigrationName turns "0001_registry.sql" into {Version: 1, Name:
// "registry"}. A filename without the NNNN_ prefix or with an unparseable or
// non-positive version is a start-up error, never silently skipped.
func parseMigrationName(filename string) (migration, error) {
	base := strings.TrimSuffix(filename, ".sql")
	prefix, name, ok := strings.Cut(base, "_")
	if !ok || prefix == "" || name == "" {
		return migration{}, fmt.Errorf("db: migration %q is not named NNNN_name.sql", filename)
	}
	version, err := strconv.Atoi(prefix)
	if err != nil {
		return migration{}, fmt.Errorf("db: migration %q has a non-numeric version %q: %w", filename, prefix, err)
	}
	if version <= 0 {
		return migration{}, fmt.Errorf("db: migration %q has a non-positive version %d", filename, version)
	}
	return migration{Version: version, Name: name}, nil
}

// validateSequence requires a non-empty set whose versions strictly increase
// (no duplicates, no gaps-as-equality), so lexical order is a total order the
// migrator can apply once. Gaps in the numbers are allowed — only a tie is an
// error — but each file must name a non-empty step.
func validateSequence(migrations []migration) error {
	if len(migrations) == 0 {
		return fmt.Errorf("db: no embedded migrations found")
	}
	for i, m := range migrations {
		if m.Name == "" {
			return fmt.Errorf("db: migration version %d has an empty name", m.Version)
		}
		if i > 0 && m.Version <= migrations[i-1].Version {
			return fmt.Errorf("db: migration versions are not strictly increasing: %d then %d",
				migrations[i-1].Version, m.Version)
		}
	}
	return nil
}

// plan returns the migrations not yet recorded as applied, in version order —
// exactly the steps a Migrate run must execute. It is pure so the "selects the
// pending versions" decision is unit-tested without a database. The applied
// set is the versions schema_migrations already holds.
func plan(migrations []migration, applied map[int]bool) []migration {
	var pending []migration
	for _, m := range migrations {
		if !applied[m.Version] {
			pending = append(pending, m)
		}
	}
	return pending
}
