package cifra

// Fret strings and fingerings (spec §7.5, §7.5.1). A faithful port of the
// reference's reference/cifra_md/frets.py — never imported from it: agreement is
// by the corpus, not shared code (DIRECTION §3.6). Only the reader's needs are
// here (parse and check); the §7 canonical writer owns the formatters.

import (
	"regexp"
	"strconv"
	"strings"
)

var fretPartRE = regexp.MustCompile(`^\d{1,2}$`)

// parseFrets returns a list of ints and "x", or (nil, false) when the text is
// not a fret string. Each fret is an int or the string "x".
func parseFrets(text string) ([]any, bool) {
	t := strings.Trim(text, " ")
	if t == "" {
		return nil, false
	}
	var parts []string
	if strings.Contains(t, "-") {
		parts = strings.Split(t, "-")
	} else {
		for _, ch := range t {
			parts = append(parts, string(ch))
		}
	}
	out := []any{}
	for _, part := range parts {
		switch {
		case part == "x" || part == "X":
			out = append(out, "x")
		case fretPartRE.MatchString(part):
			n, _ := strconv.Atoi(part)
			out = append(out, n)
		default:
			return nil, false
		}
	}
	if len(out) == 0 {
		return nil, false
	}
	return out, true
}

// parseFingers reads a fingering (§7.5.1): positions 1-4, T, or - (0 reads as -),
// spaced or run together. Returns a list of int | "T" | nil, or (nil, false)
// when the text is not a fingering.
func parseFingers(text string) ([]any, bool) {
	t := strings.Trim(text, " ")
	if t == "" {
		return nil, false
	}
	var parts []string
	if strings.Contains(t, " ") {
		for _, p := range strings.Split(t, " ") {
			if p != "" {
				parts = append(parts, p)
			}
		}
	} else {
		for _, ch := range t {
			parts = append(parts, string(ch))
		}
	}
	out := []any{}
	for _, part := range parts {
		switch part {
		case "-", "0":
			out = append(out, nil)
		case "T", "t":
			out = append(out, "T")
		case "1", "2", "3", "4":
			n, _ := strconv.Atoi(part)
			out = append(out, n)
		default:
			return nil, false
		}
	}
	return out, true
}

// checkFingers returns why a fingering is wrong for a shape, or "" when it is
// fine (§7.5.1).
func checkFingers(fingers, frets []any) string {
	if len(fingers) != len(frets) {
		return strconv.Itoa(len(fingers)) + " finger positions for " + strconv.Itoa(len(frets)) + " strings"
	}
	at := map[any]int{}
	for k, finger := range fingers {
		if finger == nil {
			continue
		}
		fret := frets[k]
		if fs, ok := fret.(string); ok && fs == "x" {
			return "finger " + fingerStr(finger) + " on a string that is not fretted"
		}
		fretInt, isInt := fret.(int)
		if isInt && fretInt == 0 {
			return "finger " + fingerStr(finger) + " on a string that is not fretted"
		}
		if prev, ok := at[finger]; ok && prev != fretInt {
			return "finger " + fingerStr(finger) + " on frets " + strconv.Itoa(prev) + " and " + strconv.Itoa(fretInt)
		}
		at[finger] = fretInt
	}
	return ""
}

func fingerStr(finger any) string {
	switch v := finger.(type) {
	case int:
		return strconv.Itoa(v)
	case string:
		return v
	}
	return ""
}
