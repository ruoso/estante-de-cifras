package server

import (
	"net/http"
	"testing"
)

// These unit tests pin the proxy-aware client-IP helper (service.rate_limits
// Constraint 3): with no trusted proxies the key is RemoteAddr; with one, it is
// the rightmost X-Forwarded-For entry (RemoteAddr being the conceptual rightmost
// hop); client-supplied left-hand entries are never trusted; and a header too
// short for the hop count falls back to RemoteAddr.

func reqWith(remoteAddr, xff string) *http.Request {
	r := &http.Request{
		RemoteAddr: remoteAddr,
		Header:     http.Header{},
	}
	if xff != "" {
		r.Header.Set("X-Forwarded-For", xff)
	}
	return r
}

func TestClientIPUsesRemoteAddrWithNoTrustedProxies(t *testing.T) {
	r := reqWith("203.0.113.9:54321", "198.51.100.1, 10.0.0.1")
	if got := clientIP(r, 0); got != "203.0.113.9" {
		t.Errorf("clientIP(trustedProxies=0) = %q, want %q (RemoteAddr, port stripped)", got, "203.0.113.9")
	}
}

func TestClientIPTakesRightmostXForwardedForWithOneProxy(t *testing.T) {
	// With one trusted proxy, RemoteAddr is the edge and the real client is the
	// rightmost X-Forwarded-For entry the edge appended.
	r := reqWith("10.0.0.1:443", "198.51.100.7")
	if got := clientIP(r, 1); got != "198.51.100.7" {
		t.Errorf("clientIP(trustedProxies=1) = %q, want %q", got, "198.51.100.7")
	}
}

func TestClientIPIgnoresLeftHandSpoofEntries(t *testing.T) {
	// An attacker prepends a spoofed entry; with one trusted proxy it is ignored
	// — only the rightmost (edge-appended) entry is trusted.
	r := reqWith("10.0.0.1:443", "1.2.3.4, 198.51.100.7")
	if got := clientIP(r, 1); got != "198.51.100.7" {
		t.Errorf("clientIP = %q, want %q (left-hand spoof must be ignored)", got, "198.51.100.7")
	}
}

func TestClientIPFallsBackWhenHeaderTooShort(t *testing.T) {
	// Two trusted proxies expected but only one X-Forwarded-For entry present:
	// fall back to RemoteAddr rather than trust a spoofable short header.
	r := reqWith("10.0.0.1:443", "198.51.100.7")
	if got := clientIP(r, 2); got != "10.0.0.1" {
		t.Errorf("clientIP(trustedProxies=2, short header) = %q, want RemoteAddr %q", got, "10.0.0.1")
	}
}

func TestClientIPFallsBackWhenHeaderAbsent(t *testing.T) {
	r := reqWith("10.0.0.1:443", "")
	if got := clientIP(r, 1); got != "10.0.0.1" {
		t.Errorf("clientIP(trustedProxies=1, no header) = %q, want RemoteAddr %q", got, "10.0.0.1")
	}
}
