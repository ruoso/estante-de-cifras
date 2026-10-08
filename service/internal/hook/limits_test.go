package hook

// Unit test for the account-and-book byte-cap layer's pure parts — no git, no
// DB. Pins the env contract (DIRECTION §3.6 lines 342–346) and the fail-closed
// rule, the net-growth summing over the shared cat-file --batch-check parser,
// and the accept/refuse arithmetic against the two caps (workflow 14
// "50 MB per book" docs/workflows/14-file-view.md:41 and "200 MB per account"
// :42–43). The env-reading of the real git object sizes and the quarantine live
// at the behavior level (cmd/pre-receive/limits_test.go).

import (
	"strings"
	"testing"
)

// TestReadLimitEnv pins the env parsing: well-formed byte figures parse; a
// missing, empty, non-numeric or negative value is an error (fail closed —
// DIRECTION §3.6 lines 342–346; the service always sets both, so a bad value is
// a broken contract, not user input).
func TestReadLimitEnv(t *testing.T) {
	ok := map[string]string{
		envBookBytes:        "1048576",
		envAccountRemaining: "209715200",
	}
	bookBytes, accountRemaining, err := readLimitEnv(lookupFrom(ok))
	if err != nil {
		t.Fatalf("readLimitEnv(well-formed): %v", err)
	}
	if bookBytes != 1048576 {
		t.Errorf("bookBytes = %d, want 1048576", bookBytes)
	}
	if accountRemaining != 209715200 {
		t.Errorf("accountRemaining = %d, want 209715200", accountRemaining)
	}

	bad := []map[string]string{
		{envAccountRemaining: "10"},                         // ESTANTE_BOOK_BYTES missing
		{envBookBytes: "10"},                                // ESTANTE_ACCOUNT_BYTES_REMAINING missing
		{envBookBytes: "", envAccountRemaining: "10"},       // empty book bytes
		{envBookBytes: "lots", envAccountRemaining: "10"},   // non-numeric book bytes
		{envBookBytes: "10", envAccountRemaining: "plenty"}, // non-numeric remaining
		{envBookBytes: "-1", envAccountRemaining: "10"},     // negative book bytes
		{envBookBytes: "10", envAccountRemaining: "-1"},     // negative remaining
	}
	for _, env := range bad {
		if _, _, err := readLimitEnv(lookupFrom(env)); err == nil {
			t.Errorf("readLimitEnv(%v): want error, got nil", env)
		}
	}
}

// TestNetGrowth pins the summing over the cat-file --batch-check parser: the
// push's net byte growth is the sum of the introduced objects' sizes, and a
// malformed line is an error (reusing parseBatchCheck).
func TestNetGrowth(t *testing.T) {
	const commit = "1111111111111111111111111111111111111111"
	const tree = "2222222222222222222222222222222222222222"
	const blob = "3333333333333333333333333333333333333333"
	in := commit + " commit 200\n" + tree + " tree 92\n" + blob + " blob 4096\n"
	infos, err := parseBatchCheck(strings.NewReader(in))
	if err != nil {
		t.Fatalf("parseBatchCheck: %v", err)
	}
	if got := netGrowth(infos); got != 200+92+4096 {
		t.Errorf("netGrowth = %d, want %d", got, 200+92+4096)
	}
	if got := netGrowth(nil); got != 0 {
		t.Errorf("netGrowth(nil) = %d, want 0", got)
	}

	if _, err := parseBatchCheck(strings.NewReader(blob + " blob notanumber\n")); err == nil {
		t.Error("parseBatchCheck of a malformed size line should be an error")
	}
}

// TestDecideLimits pins the accept/refuse arithmetic against both caps, at the
// boundary (exactly at a cap accepts; one byte over refuses): workflow 14 L41
// (50 MB per book) and L42–43 (the per-account quota).
func TestDecideLimits(t *testing.T) {
	const remaining = int64(10 * 1024 * 1024) // generous account headroom
	const user = "acc-decide"                 // the pushing user, named by the account-quota reason

	// Within both caps → accept.
	if reasons := decideLimits(0, remaining, 1024, user); len(reasons) != 0 {
		t.Errorf("a push within both caps should accept; got %v", reasons)
	}

	// Exactly at each cap → accept (the cap is the greatest allowed value).
	if reasons := decideLimits(maxBookBytes-1024, remaining, 1024, user); len(reasons) != 0 {
		t.Errorf("a push to exactly the per-book cap should accept; got %v", reasons)
	}
	if reasons := decideLimits(0, remaining, remaining, user); len(reasons) != 0 {
		t.Errorf("a push to exactly the account's remaining quota should accept; got %v", reasons)
	}

	// One byte over the per-book cap → refuse, naming the book limit.
	bookOver := decideLimits(maxBookBytes-1024, remaining, 1025, user)
	if len(bookOver) != 1 || !strings.Contains(bookOver[0], "per-book limit") {
		t.Errorf("one byte over the per-book cap should refuse naming the book limit; got %v", bookOver)
	}

	// One byte over the account's remaining quota → refuse, naming the account
	// and the pushing user (DIRECTION §3.6 L346).
	acctOver := decideLimits(0, remaining, remaining+1, user)
	if len(acctOver) != 1 || !strings.Contains(acctOver[0], "account") || !strings.Contains(acctOver[0], user) {
		t.Errorf("one byte over the account quota should refuse naming the account and the user; got %v", acctOver)
	}

	// Over both caps → both reasons.
	both := decideLimits(maxBookBytes, 0, 1, user)
	if len(both) != 2 {
		t.Errorf("a push over both caps should return both reasons; got %v", both)
	}
}

// lookupFrom adapts a map to the (string, bool) lookup readLimitEnv takes, so a
// test reads from a map rather than the process environment (as config.Load
// does).
func lookupFrom(env map[string]string) func(string) (string, bool) {
	return func(key string) (string, bool) {
		v, ok := env[key]
		return v, ok
	}
}
