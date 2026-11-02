// Package pairing holds the pure parts of pairing a device the way a
// television is paired (reader.device_pairing; docs/remarkable-reader.md §5.1;
// workflow 13 §Pairing a reMarkable): the code's alphabet, drawing a code from
// crypto/rand without modulo bias, showing it three-dash-three, and reading a
// typed code back in any case, with or without the dash or spaces. It knows
// nothing of HTTP or Postgres; the server's handlers store only the code's
// hash.
package pairing

import (
	"crypto/rand"
	"fmt"
	"strings"
)

// Alphabet is the 31 characters a code is drawn from: the digits without 0
// and 1, the capital letters without I, L and O (workflow 13 L387–390), so no
// two characters are mistaken for each other and no look-alike mapping is
// needed.
const Alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

// Length is how many alphabet characters a code holds.
const Length = 6

// maxUnbiased is the largest multiple of len(Alphabet) a byte can hold: a
// byte at or above it is rejected, so every character is equally likely
// (rejection sampling, no modulo bias).
const maxUnbiased = 256 - 256%len(Alphabet)

// Generate draws a new code of Length alphabet characters from crypto/rand.
// The raw form (no dash) is what is hashed and stored; Format shows it.
func Generate() (string, error) {
	out := make([]byte, 0, Length)
	buf := make([]byte, 16)
	for len(out) < Length {
		if _, err := rand.Read(buf); err != nil {
			return "", fmt.Errorf("pairing: reading randomness: %w", err)
		}
		for _, b := range buf {
			if int(b) >= maxUnbiased {
				continue
			}
			out = append(out, Alphabet[int(b)%len(Alphabet)])
			if len(out) == Length {
				break
			}
		}
	}
	return string(out), nil
}

// Format shows a raw six-character code three-dash-three, as `KQ7-4TM`.
func Format(raw string) string {
	if len(raw) != Length {
		return raw
	}
	return raw[:3] + "-" + raw[3:]
}

// Normalize reads a typed code back into its raw form: any case, with or
// without the dash, with spaces anywhere (workflow 13 L387–388). What does not
// come to exactly Length alphabet characters is not a code (ok false) — no
// character is read as another (an O is not a 0).
func Normalize(typed string) (raw string, ok bool) {
	var b strings.Builder
	for _, r := range typed {
		switch {
		case r == '-' || r == ' ' || r == '\t' || r == '\n' || r == '\r':
			continue
		case r >= 'a' && r <= 'z':
			r -= 'a' - 'A'
		}
		if r > 0x7f || !strings.ContainsRune(Alphabet, r) {
			return "", false
		}
		b.WriteRune(r)
	}
	if b.Len() != Length {
		return "", false
	}
	return b.String(), true
}
