package engine

// integration — the built device bundle's instrument(files) in goja
// (reader.sync; docs/remarkable-reader.md §4 `instrument(files)`, §4.1): the
// home book's shapes-default-cache.json holding the example book's fixture
// table under the bundle's salt, then under another salt only, answers a
// table that Load holds and that reads the example book with no misses; an
// empty cache answers no table. A missing build fails rather than skips.

import (
	"context"
	"encoding/json"
	"testing"
)

func TestInstrumentFromBuiltBundle(t *testing.T) {
	f := readFixture(t, "example-book.default-shapes.json")
	e := openBuilt(t)
	ctx := context.Background()
	var entry struct {
		ID     string `json:"id"`
		Tuning string `json:"tuning"`
	}
	if err := json.Unmarshal(f.Entry, &entry); err != nil || entry.ID == "" || entry.Tuning == "" {
		t.Fatalf("fixture entry: %v", err)
	}
	var table struct {
		Fingerprint string                     `json:"fingerprint"`
		Shapes      map[string]json.RawMessage `json:"shapes"`
	}
	if err := json.Unmarshal(f.Table, &table); err != nil {
		t.Fatal(err)
	}
	cache := func(salt string) json.RawMessage {
		return mustJSON(t, map[string]any{
			entry.ID: map[string]any{
				entry.Tuning: map[string]any{
					salt: map[string]any{"at": "2026-10-06T12:00:00.000Z", "value": json.RawMessage(f.Table)},
				},
			},
		})
	}

	for name, tc := range map[string]struct {
		cache json.RawMessage
		salt  string
	}{
		"the bundle's salt": {cache(e.Manifest().Salt), e.Manifest().Salt},
		"another salt only": {cache("defaults-test-other"), "defaults-test-other"},
	} {
		t.Run(name, func(t *testing.T) {
			got, err := e.Instrument(ctx, InstrumentFiles{DefaultShapes: tc.cache})
			if err != nil {
				t.Fatalf("Instrument: %v", err)
			}
			if got.Salt == nil || *got.Salt != tc.salt {
				t.Errorf("salt %v, want %q", got.Salt, tc.salt)
			}
			if !sameJSON(t, got.Table, f.Table) {
				t.Errorf("the table chosen is not the fixture's")
			}
			loaded, err := e.Load(ctx, got.Entry, got.Table)
			if err != nil {
				t.Fatalf("Load: %v", err)
			}
			if loaded.Held != len(table.Shapes) || loaded.Held == 0 {
				t.Errorf("Load held %d, the table holds %d", loaded.Held, len(table.Shapes))
			}
			if loaded.Fingerprint == nil || *loaded.Fingerprint != table.Fingerprint {
				t.Errorf("Load fingerprint %v, the table's %q", loaded.Fingerprint, table.Fingerprint)
			}
			for i, song := range f.Songs {
				for _, k := range []int{0, 5} {
					s, err := e.Sheet(ctx, f.text(t, song), k, SheetOptions{})
					if err != nil {
						t.Fatalf("song %d: %v", i, err)
					}
					for _, sh := range s.Shapes {
						if sh.Pending {
							t.Errorf("song %d at %d: shape %q pending", i, k, sh.Key)
						}
					}
				}
			}
			misses, err := e.Misses(ctx)
			if err != nil {
				t.Fatal(err)
			}
			if len(misses) != 0 {
				t.Errorf("%d misses, want none", len(misses))
			}
		})
	}

	t.Run("an empty cache", func(t *testing.T) {
		got, err := e.Instrument(ctx, InstrumentFiles{})
		if err != nil {
			t.Fatalf("Instrument: %v", err)
		}
		if string(got.Table) != "null" || got.Salt != nil {
			t.Errorf("table %s salt %v, want null and nil", got.Table, got.Salt)
		}
		if idOf(t, got.Entry) != entry.ID {
			t.Errorf("entry %s, want the standard guitar", got.Entry)
		}
	})

	t.Run("a file that is not JSON", func(t *testing.T) {
		if _, err := e.Instrument(ctx, InstrumentFiles{Shapes: json.RawMessage("{not json")}); err == nil {
			t.Error("Instrument took a file that is not JSON")
		}
	})
}

func idOf(t *testing.T, entry json.RawMessage) string {
	t.Helper()
	var e struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(entry, &e); err != nil {
		t.Fatal(err)
	}
	return e.ID
}
