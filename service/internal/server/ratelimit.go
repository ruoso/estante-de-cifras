package server

import (
	"math"
	"net/http"
	"strconv"
	"time"

	"estantedecifras.app/service/internal/ratelimit"
)

// This file is the server-side glue for the in-memory rate limiter
// (service.rate_limits). The limiter itself (internal/ratelimit) is pure; these
// helpers key it off the request, write the contract's 429 on refusal, and
// no-op when APIDeps carries no Limiter (Constraint 7: a nil Limiter disables
// limiting, so the skeleton and the many behavior tests that build an APIDeps
// without one keep passing).

// writeRateLimited sends the contract's 429: the Error body {code:"rate_limited",
// …} and an integer-seconds Retry-After header giving the time left in the
// window (service.rate_limits Constraint 4; api/openapi.yaml RateLimited).
func writeRateLimited(w http.ResponseWriter, retryAfter time.Duration) {
	secs := int(math.Ceil(retryAfter.Seconds()))
	if secs < 1 {
		secs = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(secs))
	writeError(w, http.StatusTooManyRequests, "rate_limited", "Too many requests. Try again shortly.")
}

// rateAllow enforces one always-counted limit (book create, fork, invitation
// accept, or either email-request key via rateAllowAll). It returns true when
// the request may proceed; on refusal it has already written the 429 and the
// caller must return. A nil limiter never limits.
func rateAllow(w http.ResponseWriter, l *ratelimit.Limiter, rule ratelimit.RuleID, key string) bool {
	if l == nil {
		return true
	}
	if d := l.Allow(rule, key); !d.Allowed {
		writeRateLimited(w, d.RetryAfter)
		return false
	}
	return true
}

// rateAllowAll enforces several always-counted limits atomically (the email
// request, keyed on both address and client IP): all must be within cap or none
// is charged. It returns true when the request may proceed; on refusal it has
// written the 429. A nil limiter never limits.
func rateAllowAll(w http.ResponseWriter, l *ratelimit.Limiter, keys ...ratelimit.Key) bool {
	if l == nil {
		return true
	}
	if d := l.AllowAll(keys...); !d.Allowed {
		writeRateLimited(w, d.RetryAfter)
		return false
	}
	return true
}

// rateCheck peeks a conditional limit (sign-in failures) without recording,
// before any WebAuthn or token work (Constraint 5). It returns true when the
// request may proceed; on refusal it has written the 429. A nil limiter never
// limits. The caller records a failure with rateRecordFailure only on a 401.
func rateCheck(w http.ResponseWriter, l *ratelimit.Limiter, rule ratelimit.RuleID, key string) bool {
	if l == nil {
		return true
	}
	if d := l.Check(rule, key); !d.Allowed {
		writeRateLimited(w, d.RetryAfter)
		return false
	}
	return true
}

// rateRecordFailure records one failed attempt against a conditional limit; a
// nil limiter records nothing.
func rateRecordFailure(l *ratelimit.Limiter, rule ratelimit.RuleID, key string) {
	if l != nil {
		l.Record(rule, key)
	}
}
