package session

import "testing"

// TestDescribeDevice pins the best-effort device label (refinement acceptance
// #4, Decision 3; the contract's Session.device "when known",
// api/openapi.yaml:959): representative User-Agent strings map to a coarse
// "Browser on OS" label, and an empty or unrecognised agent — one whose browser
// or OS this classifier does not place — maps to "" so sign-in stores NULL.
func TestDescribeDevice(t *testing.T) {
	cases := []struct {
		name string
		ua   string
		want string
	}{
		{
			name: "Chrome on Linux",
			ua:   "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			want: "Chrome on Linux",
		},
		{
			// An iOS agent also carries "like Mac OS X" and "Safari"+"Version/";
			// iPhone must win over Mac, and Safari must not be read as Chrome.
			name: "Safari on iOS",
			ua:   "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			want: "Safari on iOS",
		},
		{
			name: "Firefox on Windows",
			ua:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
			want: "Firefox on Windows",
		},
		{
			// An Android agent also carries "Linux"; Android must win.
			name: "Chrome on Android",
			ua:   "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
			want: "Chrome on Android",
		},
		{
			// Edge carries "Chrome/" too; the more specific token must win.
			name: "Edge on Windows",
			ua:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
			want: "Edge on Windows",
		},
		{name: "empty", ua: "", want: ""},
		{name: "unrecognised", ua: "curl/8.5.0", want: ""},
		{
			// A recognised browser with no placeable OS still yields "" — the label
			// needs both halves to be useful.
			name: "browser only",
			ua:   "Firefox/121.0",
			want: "",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := describeDevice(tc.ua); got != tc.want {
				t.Errorf("describeDevice(%q) = %q, want %q", tc.ua, got, tc.want)
			}
		})
	}
}
