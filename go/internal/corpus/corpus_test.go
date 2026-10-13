package corpus

// The corpus conformance level for the Go implementation (corpus/README.md
// lines 37–58 reading, 104–149 merge forward; DIRECTION §3.6 lines 293–300). It
// wires the real stubbed package cifra and the embedded expected-failures
// ledger, discovers every corpus entry, and runs every reading check (1–4, 6)
// and every merge forward check, asserting each against its ledger expectation:
// a ledgered id must fail, an unledgered id must pass. Every check runs either
// way — nothing is skipped — so a premature pass or a regression fails the gate.
// At this landing the package implements nothing, so the ledger names every
// check and the suite is green.

import (
	_ "embed"
	"encoding/json"
	"sort"
	"testing"

	cifra "github.com/ruoso/cifra.md/go"
)

//go:embed expected-failures.json
var ledgerJSON []byte

// pkgImpl wires the real stubbed package cifra into the Impl interface.
type pkgImpl struct{}

func (pkgImpl) Parse(src []byte) (cifra.Model, error)        { return cifra.Parse(src) }
func (pkgImpl) Write(m cifra.Model) ([]byte, error)          { return cifra.Write(m) }
func (pkgImpl) Canonical(m cifra.Model) (cifra.Model, error) { return cifra.Canonical(m) }
func (pkgImpl) ParseSetlist(src []byte) (cifra.Model, error) { return cifra.ParseSetlist(src) }
func (pkgImpl) WriteSetlist(m cifra.Model) ([]byte, error)   { return cifra.WriteSetlist(m) }
func (pkgImpl) CanonicalSetlist(m cifra.Model) (cifra.Model, error) {
	return cifra.CanonicalSetlist(m)
}
func (pkgImpl) Merge(base, ours, theirs []byte, setlist bool) (cifra.Outcome, error) {
	return cifra.Merge(base, ours, theirs, setlist)
}
func (pkgImpl) MergeOutputs(o cifra.Outcome, setlist bool) (map[string][]byte, error) {
	return cifra.MergeOutputs(o, setlist)
}
func (pkgImpl) ResolveMarked(marked []byte, side string) ([]byte, error) {
	return cifra.ResolveMarked(marked, side)
}
func (pkgImpl) Prepare(src []byte) ([]string, error) { return cifra.Prepare(src) }
func (pkgImpl) ParseChord(symbol, dialect string) (cifra.Model, []any, []string) {
	return cifra.ParseChord(symbol, dialect)
}
func (pkgImpl) Dialects() map[string]map[string]string { return cifra.DIALECTS }

func loadLedger(t *testing.T) []string {
	t.Helper()
	var ledger []string
	if err := json.Unmarshal(ledgerJSON, &ledger); err != nil {
		t.Fatalf("expected-failures.json is not a JSON array of ids: %v", err)
	}
	return ledger
}

func allChecks(t *testing.T) []Check {
	t.Helper()
	d, err := Discover(CorpusDir())
	if err != nil {
		t.Fatalf("discover: %v", err)
	}
	var impl Impl = pkgImpl{}
	var checks []Check
	for _, e := range d.Reading {
		checks = append(checks, ReadingChecks(e, impl)...)
	}
	for _, e := range d.Merge {
		checks = append(checks, MergeChecks(e, impl)...)
	}
	return checks
}

func TestLedgerNamesNoCheckThatDoesNotExist(t *testing.T) {
	ledger := loadLedger(t)
	checkIDs := map[string]bool{}
	for _, c := range allChecks(t) {
		checkIDs[c.ID] = true
	}
	if stale := StaleLedgerIds(ledger, checkIDs); len(stale) != 0 {
		t.Errorf("expected-failures.json names %d check(s) that no longer exist: %v", len(stale), stale)
	}
}

// readingCheckIDs enumerates the reading-entry check ids for the canonical
// corpus — every /tl, 1, 2, 3, 4, 6 and /chords id ReadingChecks builds for the
// song and setlist reading entries Discover finds (corpus/README.md lines
// 37–58). It excludes the merge/* ids on purpose: a merge entry is not a
// canonical-corpus entry (it has no canonical.* file), and its ledger is
// cifra_go.merge's to prune.
func readingCheckIDs(t *testing.T) map[string]bool {
	t.Helper()
	d, err := Discover(CorpusDir())
	if err != nil {
		t.Fatalf("discover: %v", err)
	}
	var impl Impl = pkgImpl{}
	ids := map[string]bool{}
	for _, e := range d.Reading {
		for _, c := range ReadingChecks(e, impl) {
			ids[c.ID] = true
		}
	}
	return ids
}

// TestCanonicalCorpusHasNoExpectedFailure locks the note's "no expected failure
// left" for the canonical corpus: no reading-entry check id may appear in the
// embedded ledger (spec §9.1 Writer / Full, §9.3 Test corpus; §10 setlist
// reader/writer). TestCorpusConformance treats a ledgered check as *expected to
// fail*, so without this guard a failing reading check could be silently
// re-ledgered to keep the gate green, un-conforming the canonical corpus. The
// 76 merge/*/1 ids are out of scope (left for cifra_go.merge) and never named
// here; TestLedgerNamesNoCheckThatDoesNotExist keeps them honest.
func TestCanonicalCorpusHasNoExpectedFailure(t *testing.T) {
	ledgered := map[string]bool{}
	for _, id := range loadLedger(t) {
		ledgered[id] = true
	}
	var offenders []string
	for id := range readingCheckIDs(t) {
		if ledgered[id] {
			offenders = append(offenders, id)
		}
	}
	sort.Strings(offenders)
	if len(offenders) != 0 {
		t.Errorf("the canonical (reading) corpus must carry no expected failure, but expected-failures.json ledgers %d reading check(s): %v; a failing reading check must be fixed, never re-ledgered", len(offenders), offenders)
	}
}

func TestCorpusConformance(t *testing.T) {
	ledger := loadLedger(t)
	expectedToFail := map[string]bool{}
	for _, id := range ledger {
		expectedToFail[id] = true
	}
	for _, c := range allChecks(t) {
		t.Run(c.ID, func(t *testing.T) {
			err := c.Run()
			if expectedToFail[c.ID] {
				if err == nil {
					t.Errorf("%s is a ledgered expected failure, but it passed; prune it from expected-failures.json", c.ID)
				}
				return
			}
			if err != nil {
				t.Errorf("%s is expected to pass, but it failed: %v", c.ID, err)
			}
		})
	}
}
