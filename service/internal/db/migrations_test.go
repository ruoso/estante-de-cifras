package db

import "testing"

// These are unit tests of the migrator's pure core — loading, ordering and
// planning the embedded set — with no database. They pin the forward-only
// versioned-migrations decision (refinement Decisions) and the .tji's
// "versioned migrations": the set is non-empty, strictly increasing and
// well-named, and the planner selects exactly the pending versions given a
// recorded set.

// TestLoadMigrationsIsWellFormed pins that the embedded set loads, is
// non-empty, and is strictly increasing by version with a non-empty name each
// — the invariant loadMigrations enforces so lexical order is a safe apply
// order. The real files under migrations/ are the fixture.
func TestLoadMigrationsIsWellFormed(t *testing.T) {
	migrations, err := loadMigrations()
	if err != nil {
		t.Fatalf("loadMigrations: %v", err)
	}
	if len(migrations) == 0 {
		t.Fatal("loadMigrations returned no migrations; the embedded set must be non-empty")
	}
	for i, m := range migrations {
		if m.Name == "" {
			t.Errorf("migration %04d has an empty name", m.Version)
		}
		if m.SQL == "" {
			t.Errorf("migration %04d_%s has empty SQL", m.Version, m.Name)
		}
		if i > 0 && m.Version <= migrations[i-1].Version {
			t.Errorf("versions not strictly increasing: %d then %d", migrations[i-1].Version, m.Version)
		}
	}
	// The first registry migration is 0001_registry; the downstream service
	// tasks add 0002+ (e.g. service.email_links). Pin that the set starts there.
	if migrations[0].Version != 1 || migrations[0].Name != "registry" {
		t.Errorf("first migration = %04d_%s, want 0001_registry", migrations[0].Version, migrations[0].Name)
	}
}

// TestParseMigrationName pins the NNNN_name.sql convention: a well-formed name
// parses to its version and name, and a malformed one is an error (never a
// silently skipped file).
func TestParseMigrationName(t *testing.T) {
	ok, err := parseMigrationName("0042_add_quota_column.sql")
	if err != nil {
		t.Fatalf("parseMigrationName(valid): %v", err)
	}
	if ok.Version != 42 || ok.Name != "add_quota_column" {
		t.Errorf("parsed {%d, %q}, want {42, add_quota_column}", ok.Version, ok.Name)
	}

	for _, bad := range []string{"registry.sql", "0001.sql", "_registry.sql", "abc_registry.sql", "0000_zero.sql", "-1_neg.sql"} {
		if _, err := parseMigrationName(bad); err == nil {
			t.Errorf("parseMigrationName(%q): want error, got nil", bad)
		}
	}
}

// TestValidateSequenceRejectsBadSets pins that an empty set and a non-strictly-
// increasing set (a duplicate version) are rejected, so a mis-numbered pair of
// files fails at start-up rather than applying one of two steps.
func TestValidateSequenceRejectsBadSets(t *testing.T) {
	if err := validateSequence(nil); err == nil {
		t.Error("validateSequence(empty): want error, got nil")
	}
	dup := []migration{{Version: 1, Name: "a", SQL: "x"}, {Version: 1, Name: "b", SQL: "y"}}
	if err := validateSequence(dup); err == nil {
		t.Error("validateSequence(duplicate version): want error, got nil")
	}
	empty := []migration{{Version: 1, Name: "", SQL: "x"}}
	if err := validateSequence(empty); err == nil {
		t.Error("validateSequence(empty name): want error, got nil")
	}
	good := []migration{{Version: 1, Name: "a", SQL: "x"}, {Version: 3, Name: "c", SQL: "z"}}
	if err := validateSequence(good); err != nil {
		t.Errorf("validateSequence(strictly increasing with a gap): unexpected error %v", err)
	}
}

// TestPlanSelectsPending pins that plan returns exactly the not-yet-applied
// migrations, in order: none when all are recorded, the tail when a prefix is
// recorded, and all when the recorded set is empty.
func TestPlanSelectsPending(t *testing.T) {
	all := []migration{
		{Version: 1, Name: "a", SQL: "x"},
		{Version: 2, Name: "b", SQL: "y"},
		{Version: 3, Name: "c", SQL: "z"},
	}

	cases := []struct {
		name    string
		applied map[int]bool
		want    []int
	}{
		{"nothing applied", map[int]bool{}, []int{1, 2, 3}},
		{"prefix applied", map[int]bool{1: true}, []int{2, 3}},
		{"all applied", map[int]bool{1: true, 2: true, 3: true}, nil},
		{"gap applied", map[int]bool{2: true}, []int{1, 3}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := plan(all, tc.applied)
			if len(got) != len(tc.want) {
				t.Fatalf("plan selected %d migrations, want %d", len(got), len(tc.want))
			}
			for i, m := range got {
				if m.Version != tc.want[i] {
					t.Errorf("pending[%d] = %d, want %d", i, m.Version, tc.want[i])
				}
			}
		})
	}
}
