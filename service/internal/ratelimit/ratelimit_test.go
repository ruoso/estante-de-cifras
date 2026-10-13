package ratelimit

import (
	"testing"
	"time"
)

// These unit tests pin the fixed-window limiter (service.rate_limits
// Constraint 2): the Nth call in a window is allowed and the (N+1)th is refused
// with a Retry-After equal to the window remainder; the count resets once the
// injected clock passes the window; distinct keys and distinct rules are
// isolated; and elapsed windows are evicted so the map stays bounded under a
// churn of distinct keys (Constraint 1). Time is injected via a fake clock so
// the windows are driven deterministically without sleeping.

// fakeClock is an injectable, advanceable clock.
type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

const (
	testRuleA RuleID = "rule_a"
	testRuleB RuleID = "rule_b"
)

func newTestLimiter(clk *fakeClock) *Limiter {
	return New(clk.now, map[RuleID]Rule{
		testRuleA: {Max: 3, Window: time.Minute},
		testRuleB: {Max: 1, Window: time.Hour},
	})
}

// TestAllowsUpToTheCapThenRefuses pins the window boundary: exactly Max calls in
// the window are allowed and the next is refused.
func TestAllowsUpToTheCapThenRefuses(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := newTestLimiter(clk)

	for i := 1; i <= 3; i++ {
		if d := l.Allow(testRuleA, "k"); !d.Allowed {
			t.Fatalf("call %d: Allowed = false, want true (within the cap of 3)", i)
		}
	}
	d := l.Allow(testRuleA, "k")
	if d.Allowed {
		t.Fatal("the 4th call Allowed = true, want false (over the cap of 3)")
	}
}

// TestRetryAfterIsTheWindowRemainder pins Constraint 4: a refused call's
// RetryAfter is the time left in the window.
func TestRetryAfterIsTheWindowRemainder(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := newTestLimiter(clk)

	for i := 0; i < 3; i++ {
		l.Allow(testRuleA, "k")
	}
	// 20 seconds into the one-minute window, 40 remain.
	clk.advance(20 * time.Second)
	d := l.Allow(testRuleA, "k")
	if d.Allowed {
		t.Fatal("Allowed = true, want false (over the cap)")
	}
	if want := 40 * time.Second; d.RetryAfter != want {
		t.Errorf("RetryAfter = %s, want %s (the window remainder)", d.RetryAfter, want)
	}
}

// TestCountResetsAfterTheWindow pins the reset: once the clock passes the
// window the count starts fresh.
func TestCountResetsAfterTheWindow(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := newTestLimiter(clk)

	for i := 0; i < 3; i++ {
		l.Allow(testRuleA, "k")
	}
	if d := l.Allow(testRuleA, "k"); d.Allowed {
		t.Fatal("4th call within the window Allowed = true, want false")
	}
	clk.advance(time.Minute) // the window has fully elapsed
	if d := l.Allow(testRuleA, "k"); !d.Allowed {
		t.Error("after the window rolled, Allowed = false, want true (count reset)")
	}
}

// TestDistinctKeysAreIsolated pins that one key's exhaustion does not limit
// another.
func TestDistinctKeysAreIsolated(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := newTestLimiter(clk)

	for i := 0; i < 3; i++ {
		l.Allow(testRuleA, "ip-1")
	}
	if d := l.Allow(testRuleA, "ip-1"); d.Allowed {
		t.Fatal("ip-1 over its cap Allowed = true, want false")
	}
	if d := l.Allow(testRuleA, "ip-2"); !d.Allowed {
		t.Error("ip-2 Allowed = false, want true (distinct key, own window)")
	}
}

// TestDistinctRulesAreIsolated pins that two rules keep separate counts even for
// the same key string.
func TestDistinctRulesAreIsolated(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := newTestLimiter(clk)

	// ruleB caps at 1; exhaust it for "k".
	if d := l.Allow(testRuleB, "k"); !d.Allowed {
		t.Fatal("ruleB first call Allowed = false, want true")
	}
	if d := l.Allow(testRuleB, "k"); d.Allowed {
		t.Fatal("ruleB second call Allowed = true, want false (cap of 1)")
	}
	// ruleA with the same key is untouched.
	if d := l.Allow(testRuleA, "k"); !d.Allowed {
		t.Error("ruleA Allowed = false, want true (distinct rule)")
	}
}

// TestElapsedWindowsAreEvicted pins Constraint 1: a churn of distinct keys does
// not grow the map without limit — windows that have fully elapsed are dropped
// on the next operation.
func TestElapsedWindowsAreEvicted(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := newTestLimiter(clk)

	for i := 0; i < 100; i++ {
		l.Allow(testRuleA, string(rune('a'+i%26))+time.Duration(i).String())
	}
	if len(l.windows) == 0 {
		t.Fatal("no windows recorded, want the 100 just created")
	}
	// Advance past the window and touch one unrelated key; the sweep on that
	// operation drops every elapsed window.
	clk.advance(time.Minute + time.Second)
	l.Allow(testRuleA, "fresh")
	if got := len(l.windows); got != 1 {
		t.Errorf("windows after eviction = %d, want 1 (only the fresh key)", got)
	}
}

// TestCheckDoesNotRecord pins the conditional-limit primitive (sign-in
// failures): Check peeks without consuming, so repeated Checks never trip; only
// Record advances the count.
func TestCheckDoesNotRecord(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := New(clk.now, map[RuleID]Rule{testRuleB: {Max: 2, Window: time.Hour}})

	for i := 0; i < 10; i++ {
		if d := l.Check(testRuleB, "ip"); !d.Allowed {
			t.Fatalf("Check %d Allowed = false, want true (Check must not consume)", i)
		}
	}
	l.Record(testRuleB, "ip")
	l.Record(testRuleB, "ip")
	if d := l.Check(testRuleB, "ip"); d.Allowed {
		t.Error("after 2 Records Check Allowed = true, want false (cap of 2 reached)")
	}
}

// TestAllowAllIsAtomic pins the two-key email-request path: if any key is over
// cap, none is charged, and the longest remainder is returned.
func TestAllowAllIsAtomic(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := New(clk.now, map[RuleID]Rule{
		testRuleA: {Max: 5, Window: time.Minute}, // the IP key, plenty of room
		testRuleB: {Max: 1, Window: time.Hour},   // the address key, tight
	})

	addr := Key{Rule: testRuleB, Key: "a@example.test"}
	ip := Key{Rule: testRuleA, Key: "ip"}

	if d := l.AllowAll(addr, ip); !d.Allowed {
		t.Fatal("first AllowAll Allowed = false, want true")
	}
	// The address rule is now full; the next call is refused and must NOT have
	// charged the IP rule.
	if d := l.AllowAll(addr, ip); d.Allowed {
		t.Fatal("second AllowAll Allowed = true, want false (address over cap)")
	}
	if d := l.AllowAll(addr, ip); d.RetryAfter <= time.Minute {
		t.Errorf("RetryAfter = %s, want the hour-scale address remainder", d.RetryAfter)
	}
	// The IP rule was never charged by the refused calls: four more IP-only
	// events fit under its cap of 5.
	for i := 0; i < 4; i++ {
		if d := l.Allow(testRuleA, "ip"); !d.Allowed {
			t.Fatalf("IP-only call %d Allowed = false; a refused AllowAll wrongly charged the IP rule", i)
		}
	}
}

// TestUnknownRuleNeverLimits pins that a rule the limiter was not built with is
// a no-op (defensive: handlers only pass known rules).
func TestUnknownRuleNeverLimits(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	l := New(clk.now, nil)
	for i := 0; i < 1000; i++ {
		if d := l.Allow("nope", "k"); !d.Allowed {
			t.Fatal("unknown rule refused a call, want always allowed")
		}
	}
}
