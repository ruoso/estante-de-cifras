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
