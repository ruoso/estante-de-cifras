package session

import "strings"

// describeDevice derives a coarse, best-effort "Browser on OS" label from a
// request's User-Agent header — just enough for a person to tell their laptop
// from their phone on the account screen (workflow 13; the contract's
// Session.device "when known", api/openapi.yaml:959). It is a small hand-rolled
// classifier, deliberately dependency-free (refinement Decision 3): a new
// runtime dependency for so coarse a label runs against the service's
// stdlib-leaning posture. An empty or unrecognised agent — one whose browser or
// OS this classifier does not place — yields "", so sign-in stores NULL and the
// field is omitted (strictly additive over leaving device NULL).
func describeDevice(userAgent string) string {
	browser := browserOf(userAgent)
	os := osOf(userAgent)
	if browser == "" || os == "" {
		return ""
	}
	return browser + " on " + os
}

// browserOf names the browser in a User-Agent, "" when unrecognised. Order
// matters: a Chrome agent also carries "Safari/", and Edge/Opera agents also
// carry "Chrome/", so the more specific tokens are tested first.
func browserOf(ua string) string {
	switch {
	case strings.Contains(ua, "Edg/"):
		return "Edge"
	case strings.Contains(ua, "OPR/"), strings.Contains(ua, "Opera"):
		return "Opera"
	case strings.Contains(ua, "Firefox/"):
		return "Firefox"
	case strings.Contains(ua, "Chrome/"):
		return "Chrome"
	case strings.Contains(ua, "Safari/") && strings.Contains(ua, "Version/"):
		return "Safari"
	default:
		return ""
	}
}

// osOf names the operating system in a User-Agent, "" when unrecognised. Order
// matters: an Android agent also carries "Linux", and an iOS agent carries
// "like Mac OS X", so the more specific tokens are tested first.
func osOf(ua string) string {
	switch {
	case strings.Contains(ua, "Windows"):
		return "Windows"
	case strings.Contains(ua, "Android"):
		return "Android"
	case strings.Contains(ua, "iPhone"), strings.Contains(ua, "iPad"), strings.Contains(ua, "iPod"):
		return "iOS"
	case strings.Contains(ua, "Mac OS X"), strings.Contains(ua, "Macintosh"):
		return "macOS"
	case strings.Contains(ua, "CrOS"):
		return "ChromeOS"
	case strings.Contains(ua, "Linux"):
		return "Linux"
	default:
		return ""
	}
}
