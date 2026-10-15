// Package ratelimit is the service's in-memory, fixed-window request-rate
// limiter (DIRECTION §3.3, §3.4). The service runs as one instance that owns
// everything, so the counts live in a mutex-guarded map in the one process;
// there is nowhere else they need to be and no distributed store to coordinate.
// Counts are lost on restart, which for an abuse throttle (not a billing meter)
// is fine: restarts are deploy-time and rare.
//
// Each limit is a fixed window: a (rule, key) tracks a window start and a count,
// and once the clock passes the window the window resets. Time is injected (a
// now func, mirroring config.Load's injected lookup) so the tests drive windows
// deterministically without sleeping. The map is kept bounded by lazily evicting
// every window that has fully elapsed on each operation, so a churn of distinct
// keys cannot grow it without limit.
//
// A key is an opaque string — a client IP, a lowercased email address or an
// account id — never a token, credential or session id, and the limiter itself
// logs nothing (DIRECTION §3.3 "no secrets in logs").
package ratelimit

import (
	"sync"
	"time"
)

// A RuleID names one of the service's rate limits. Handlers reference a rule by
// its id; the window and cap for each id live in the Limiter, so a test can wire
// the same ids with tiny windows.
type RuleID string

const (
	// SignIn caps failed sign-in attempts per client IP (the redeem and
	// passkey-authenticate surfaces). Only 401s are recorded, so a legitimate
	// user who signs in never approaches it.
	SignIn RuleID = "sign_in"
	// EmailLinkAddr caps emailed sign-in links per address, so one mailbox
	// cannot be flooded.
	EmailLinkAddr RuleID = "email_link_addr"
	// EmailLinkIP caps emailed sign-in links per client IP.
	EmailLinkIP RuleID = "email_link_ip"
	// BookCreate caps book creation (and fork — workflow 14 "forks included")
	// per account.
	BookCreate RuleID = "book_create"
	// InviteAccept caps invitation acceptance per account.
	InviteAccept RuleID = "invite_accept"
	// RecoveryEmailAccount caps recovery-email verification requests per
	// account (the request carries a session).
	RecoveryEmailAccount RuleID = "recovery_email_account"
	// RecoveryEmailAddr caps recovery-email verification links per address, a
	// bucket of its own so a signed-in stranger cannot spend a victim's sign-in
	// links by asking for verifications to their address (service.recovery_email
	// Decision *Rate limits: their own per-address bucket*).
	RecoveryEmailAddr RuleID = "recovery_email_addr"
)

// Default thresholds (service.rate_limits Constraint 8): compile-time consts
// with rationale, not per-threshold env vars. They are generous enough that no
// real use meets them; tuning is a redeploy, not an operational knob.
const (
	// SignInFailuresPerMinute: a stream of failed sign-ins is brute force; ten a
	// minute from one IP is already far past any human's fat-finger rate.
	SignInFailuresPerMinute = 10
	// EmailLinksPerHourPerAddress: an honest person asks for a link once or
	// twice; five an hour to one mailbox is generous and still stops a flood.
	EmailLinksPerHourPerAddress = 5
	// EmailLinksPerHourPerIP: the per-address cap above is the real mailbox-flood
	// guard; this per-IP cap only bounds how many distinct addresses one host may
	// request links for in an hour, a coarse backstop against mass spraying. It
	// must stay well clear of a legitimately shared IP: a book holds up to fifty
	// people (DIRECTION §3.3) and an office or household NAT presents them all as
	// one client IP, so a few dozen honest link requests an hour from one IP is
	// normal. Two hundred covers that generously (per the "no real use meets
	// them" rule) while a mass-enumeration sprayer, which wants orders of
	// magnitude more, is still capped.
	EmailLinksPerHourPerIP = 200
	// BooksPerHourPerAccount: creating twenty books an hour is already unusual;
	// this is a velocity guard on top of the absolute 100-book cap (workflow 14).
	BooksPerHourPerAccount = 20
	// InvitesPerHourPerAccount: accepting twenty invitations an hour is far past
	// any real use.
	InvitesPerHourPerAccount = 20
	// RecoveryEmailsPerHourPerAccount: setting or changing a recovery email is
	// a once-in-a-while act; ten verification requests an hour from one account
	// is far past a few typos and a send again.
	RecoveryEmailsPerHourPerAccount = 10
	// RecoveryEmailsPerHourPerAddress: as for the sign-in link, five an hour to
	// one mailbox is generous and still stops a flood.
	RecoveryEmailsPerHourPerAddress = 5
)

// A Rule is a fixed-window limit: at most Max events per Window for a given key.
// A Max of zero (or less) disables the rule — it never limits.
type Rule struct {
	Max    int
	Window time.Duration
}

// A Key pairs a rule with the opaque key it applies to, for AllowAll.
type Key struct {
	Rule RuleID
	Key  string
}

// A Decision is the outcome of a check. When Allowed is false, RetryAfter is the
// time remaining in the window — how long until the request may be retried.
type Decision struct {
	Allowed    bool
	RetryAfter time.Duration
}

type windowKey struct {
	rule RuleID
	key  string
}

type window struct {
	start time.Time
	count int
}

// A Limiter enforces a set of fixed-window Rules against opaque keys. The zero
// value is not usable; build one with New or NewDefault. All methods are safe
// for concurrent use.
type Limiter struct {
	now     func() time.Time
	rules   map[RuleID]Rule
	mu      sync.Mutex
	windows map[windowKey]*window
}

// New builds a Limiter with the given rules and an injected clock. A nil now
// defaults to time.Now; a nil rules map makes a limiter that limits nothing.
func New(now func() time.Time, rules map[RuleID]Rule) *Limiter {
	if now == nil {
		now = time.Now
	}
	if rules == nil {
		rules = map[RuleID]Rule{}
	}
	return &Limiter{now: now, rules: rules, windows: map[windowKey]*window{}}
}

// NewDefault builds a Limiter wired with the service's default thresholds.
func NewDefault(now func() time.Time) *Limiter {
	return New(now, map[RuleID]Rule{
		SignIn:        {Max: SignInFailuresPerMinute, Window: time.Minute},
		EmailLinkAddr: {Max: EmailLinksPerHourPerAddress, Window: time.Hour},
		EmailLinkIP:   {Max: EmailLinksPerHourPerIP, Window: time.Hour},
		BookCreate:    {Max: BooksPerHourPerAccount, Window: time.Hour},
		InviteAccept:  {Max: InvitesPerHourPerAccount, Window: time.Hour},

		RecoveryEmailAccount: {Max: RecoveryEmailsPerHourPerAccount, Window: time.Hour},
		RecoveryEmailAddr:    {Max: RecoveryEmailsPerHourPerAddress, Window: time.Hour},
	})
}

// Allow checks one event against (rule, key) and, if it is within the rule's
// window cap, records it. It returns Allowed=false (recording nothing further)
// once the window is full. Use it for a limit that counts every request.
func (l *Limiter) Allow(rule RuleID, key string) Decision {
	return l.AllowAll(Key{Rule: rule, Key: key})
}

// AllowAll checks every (rule, key) and, only if all are within their caps,
// records one event against each. If any is over its cap it records nothing and
// returns Allowed=false with the longest RetryAfter of the refused rules. The
// whole check-then-record is atomic under the limiter's lock, so one refused
// rule never half-charges the others.
func (l *Limiter) AllowAll(keys ...Key) Decision {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.evictLocked(now)

	var worst time.Duration
	blocked := false
	for _, k := range keys {
		if d := l.checkLocked(k.Rule, k.Key, now); !d.Allowed {
			blocked = true
			if d.RetryAfter > worst {
				worst = d.RetryAfter
			}
		}
	}
	if blocked {
		return Decision{Allowed: false, RetryAfter: worst}
	}
	for _, k := range keys {
		l.recordLocked(k.Rule, k.Key, now)
	}
	return Decision{Allowed: true}
}

// Check reports whether a further event for (rule, key) would be within the cap
// WITHOUT recording one. Use it where the event is counted only conditionally:
// the sign-in limit checks up front (before any WebAuthn or token work) but
// records a failure only on a 401, via Record.
func (l *Limiter) Check(rule RuleID, key string) Decision {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.evictLocked(now)
	return l.checkLocked(rule, key, now)
}

// Record counts one event against (rule, key), creating or rolling its window as
// needed. It is the deferred half of a conditional limit (see Check).
func (l *Limiter) Record(rule RuleID, key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	l.evictLocked(now)
	l.recordLocked(rule, key, now)
}

func (l *Limiter) checkLocked(rule RuleID, key string, now time.Time) Decision {
	r, ok := l.rules[rule]
	if !ok || r.Max <= 0 {
		return Decision{Allowed: true}
	}
	e := l.windows[windowKey{rule, key}]
	if e == nil || now.Sub(e.start) >= r.Window {
		return Decision{Allowed: true}
	}
	if e.count >= r.Max {
		return Decision{Allowed: false, RetryAfter: e.start.Add(r.Window).Sub(now)}
	}
	return Decision{Allowed: true}
}

func (l *Limiter) recordLocked(rule RuleID, key string, now time.Time) {
	r, ok := l.rules[rule]
	if !ok || r.Max <= 0 {
		return
	}
	wk := windowKey{rule: rule, key: key}
	e := l.windows[wk]
	if e == nil || now.Sub(e.start) >= r.Window {
		l.windows[wk] = &window{start: now, count: 1}
		return
	}
	e.count++
}

// evictLocked drops every window that has fully elapsed (or whose rule is gone),
// keeping the map bounded by the keys active within one window.
func (l *Limiter) evictLocked(now time.Time) {
	for k, e := range l.windows {
		r, ok := l.rules[k.rule]
		if !ok || now.Sub(e.start) >= r.Window {
			delete(l.windows, k)
		}
	}
}
