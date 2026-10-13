package server

import (
	"net"
	"net/http"
	"strings"
)

// clientIP derives the real client's IP for rate-limit keying, given how many
// trusted proxy hops sit in front of the service (service.rate_limits
// Constraint 3). In production Railway terminates TLS and proxies, so
// r.RemoteAddr is the edge for every user; keying on it would lump the whole
// world into one bucket. The conceptual chain is the X-Forwarded-For entries
// followed by RemoteAddr as its rightmost hop; the real client is the
// (trustedProxies+1)-th address counting from that right end. With
// trustedProxies at 0 (compose, the e2e stack) RemoteAddr is used directly.
// Client-supplied left-hand X-Forwarded-For entries are never trusted, and a
// header too short for the hop count falls back to RemoteAddr.
func clientIP(r *http.Request, trustedProxies int) string {
	remote := hostOnly(r.RemoteAddr)
	if trustedProxies <= 0 {
		return remote
	}
	xff := r.Header.Get("X-Forwarded-For")
	if xff == "" {
		return remote
	}
	parts := strings.Split(xff, ",")
	// The chain is [parts..., remote]; the client is trustedProxies places left
	// of remote, i.e. parts[len(parts)-trustedProxies].
	idx := len(parts) - trustedProxies
	if idx < 0 || idx >= len(parts) {
		return remote
	}
	ip := strings.TrimSpace(parts[idx])
	if ip == "" {
		return remote
	}
	return ip
}

// hostOnly strips the port from a host:port address, leaving the bare host; an
// address without a port is returned unchanged.
func hostOnly(addr string) string {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return addr
	}
	return host
}
