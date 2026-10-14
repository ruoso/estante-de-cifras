package cifra

// Chord symbols (spec §5): one permissive grammar, a canonical model, three
// dialects. A faithful port of the reference's reference/cifra_md/chord.py and
// the JavaScript twin js/src/chord.js — never imported from either: agreement is
// by the corpus, not shared code (DIRECTION §3.6). The reader's /chords corpus
// check calls parseChord and DIALECTS directly.

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

// DIALECTS maps each notation dialect to its reading of the four ambiguous
// spellings (§5.6). Exported for the corpus harness's /chords check.
var DIALECTS = map[string]map[string]string{
	"brazilian": {"sevenPlus": "majorSeventh", "bareNine": "add", "degreeSign": "diminishedSeventh", "bareFour": "suspended"},
	"american":  {"sevenPlus": "dominantSharpFive", "bareNine": "dominant", "degreeSign": "diminishedSeventh", "bareFour": "added"},
	"realbook":  {"sevenPlus": "dominantSharpFive", "bareNine": "dominant", "degreeSign": "diminishedSeventh", "bareFour": "added"},
}

// defaultDialect is the dialect used when none is set or the one set is unknown.
const defaultDialect = "brazilian"

// alternatives names, for each ambiguity, the two readings in a fixed order so
// the alternative to the chosen reading is the other one (§5.6).
var alternatives = map[string][2]string{
	"sevenPlus":  {"majorSeventh", "dominantSharpFive"},
	"bareNine":   {"add", "dominant"},
	"degreeSign": {"diminishedSeventh", "diminishedTriad"},
	"bareFour":   {"suspended", "added"},
}

type chordToken struct {
	kind string
	text string
}

// chordTokenDef is one token pattern, longest and most specific first. `#`/`b`
// are separate from `+`/`-`/`°`: the latter are positional (§5.3.1, §5.3.4).
type chordTokenDef struct {
	kind string
	re   *regexp.Regexp
}

var chordTokenDefs = []chordTokenDef{
	{"SUS2", regexp.MustCompile(`^sus2`)},
	{"SUS4", regexp.MustCompile(`^sus4`)},
	{"SUS", regexp.MustCompile(`^sus`)},
	{"ADD", regexp.MustCompile(`^(?i:add)`)},
	{"ALT", regexp.MustCompile(`^alt`)},
	{"HALFDIM", regexp.MustCompile(`^[øØ]`)},
	{"DIMWORD", regexp.MustCompile(`^(?i:dim)`)},
	{"AUGWORD", regexp.MustCompile(`^(?i:aug)`)},
	{"MAJ", regexp.MustCompile(`^(?:maj|Maj|MAJ|M|[∆Δ])`)},
	{"MIN", regexp.MustCompile(`^(?:min|Min|MIN|m)`)},
	{"NUM", regexp.MustCompile(`^(?:13|11|9|7|6|5|4|3|2)`)},
	{"SHARP", regexp.MustCompile(`^[#♯]`)},
	{"FLAT", regexp.MustCompile(`^[b♭]`)},
	{"PLUS", regexp.MustCompile(`^\+`)},
	{"MINUS", regexp.MustCompile(`^[-−–]`)},
	{"DEG", regexp.MustCompile(`^[°º]`)},
	{"LP", regexp.MustCompile(`^\(`)},
	{"RP", regexp.MustCompile(`^\)`)},
	{"SLASH", regexp.MustCompile(`^/`)},
	{"SEP", regexp.MustCompile(`^[, ]+`)},
}

var rootRE = regexp.MustCompile(`^(` + noteRE + `)`)
var bassRE = regexp.MustCompile(`^` + noteRE + `$`)

// tokenizeChord scans a chord body into tokens; bad is the unreadable tail
// (empty string with ok=false meaning fully consumed).
func tokenizeChord(body string) (tokens []chordToken, badOk bool, bad string) {
	rs := []rune(body)
	i := 0
	for i < len(rs) {
		sub := string(rs[i:])
		matched := false
		for _, def := range chordTokenDefs {
			loc := def.re.FindStringIndex(sub)
			if loc == nil {
				continue
			}
			m := sub[loc[0]:loc[1]]
			if def.kind != "SEP" {
				tokens = append(tokens, chordToken{kind: def.kind, text: m})
			}
			i += utf8.RuneCountInString(m)
			matched = true
			break
		}
		if !matched {
			return tokens, true, string(rs[i:])
		}
	}
	return tokens, false, ""
}

func chordBalanced(text string) bool {
	depth := 0
	for _, ch := range text {
		switch ch {
		case '(':
			depth++
		case ')':
			depth--
			if depth < 0 {
				return false
			}
		}
	}
	return depth == 0
}

// splitBass splits off a trailing `/bass` when the candidate is a note (§5.1.2).
func splitBass(text string) (body string, bass string, hasBass bool) {
	idx := strings.LastIndex(text, "/")
	if idx == -1 {
		return text, "", false
	}
	candidate := strings.Trim(text[idx+1:], " ")
	if bassRE.MatchString(candidate) {
		return text[:idx], candidate, true
	}
	return text, "", false
}

func seventhAlter(quality string, majorSeventh bool) int {
	if majorSeventh {
		return 0
	}
	if quality == "dim" {
		return -2
	}
	return -1
}

func chordStack(top int) []int {
	switch top {
	case 9:
		return []int{9}
	case 11:
		return []int{9, 11}
	case 13:
		return []int{9, 13}
	}
	return nil
}

// chordResult is parseChord's output: the model chord (nil when unreadable),
// the ambiguities resolved, and the errors that made it unreadable.
type chordResult struct {
	chord       *Object
	ambiguities []any
	errors      []string
}

// parseChord parses a chord symbol. It never fails hard; an unreadable symbol
// comes back with chord == nil.
func parseChord(text, dialect string) chordResult {
	var errors []string
	var ambiguities []any
	readings, ok := DIALECTS[dialect]
	if !ok {
		return chordResult{chord: nil, ambiguities: []any{}, errors: []string{"unknown dialect " + strconv.Quote(dialect)}}
	}

	fail := func(msg string) chordResult {
		return chordResult{chord: nil, ambiguities: ambiguities, errors: append(append([]string{}, errors...), msg)}
	}

	if strings.Trim(text, " ") == "" {
		return fail("empty")
	}
	t := strings.Trim(text, " ")
	rm := rootRE.FindStringSubmatch(t)
	if rm == nil {
		return fail(strconv.Quote(t) + " does not start with a note name")
	}
	root, err := parseNote(rm[1])
	if err != nil {
		return fail(strconv.Quote(t) + " does not start with a note name")
	}
	if !chordBalanced(t) {
		return fail("unbalanced brackets in " + strconv.Quote(t))
	}
	afterRoot := t[len(rm[1]):]
	body, bassText, hasBass := splitBass(afterRoot)
	var bass *note
	if hasBass {
		b, err := parseNote(bassText)
		if err == nil {
			bass = &b
		}
	}

	tokens, badOk, bad := tokenizeChord(body)
	if badOk {
		return fail("cannot read " + strconv.Quote(bad) + " in " + strconv.Quote(t))
	}

	quality := "major"
	majorSeventh := false
	majWordAlone := false
	sawSeventh := false
	bareDegreeSign := false
	primaryTop := -1 // -1 means None
	sawQualityWord := false
	exts := map[int]int{}

	at := func(j int) string {
		if j >= 0 && j < len(tokens) {
			return tokens[j].kind
		}
		return ""
	}
	ambiguity := func(kind, chosen string) {
		alt := alternatives[kind][0]
		if alt == chosen {
			alt = alternatives[kind][1]
		}
		o := NewObject()
		o.Set("kind", kind)
		o.Set("chosen", chosen)
		o.Set("alternative", alt)
		ambiguities = append(ambiguities, o)
	}

	i := 0
	for i < len(tokens) {
		kind := tokens[i].kind
		tx := tokens[i].text
		switch kind {
		case "LP", "RP":
			i++
		case "MIN":
			if !sawQualityWord && primaryTop == -1 && len(exts) == 0 {
				if quality == "dim" {
					quality = "dim"
				} else {
					quality = "minor"
				}
				sawQualityWord = true
			} else {
				errors = append(errors, "unexpected "+strconv.Quote(tx))
			}
			i++
		case "MAJ":
			majorSeventh = true
			sawQualityWord = true
			majWordAlone = tx != "∆" && tx != "Δ" && at(i+1) != "NUM"
			i++
		case "DIMWORD", "DEG":
			if primaryTop == -1 && len(exts) == 0 {
				quality = "dim"
				sawQualityWord = true
				if kind == "DEG" {
					bareDegreeSign = true
				}
			} else {
				errors = append(errors, "unexpected "+strconv.Quote(tx))
			}
			i++
		case "HALFDIM":
			quality = "dim"
			sawQualityWord = true
			exts[7] = -1
			sawSeventh = true
			i++
		case "AUGWORD":
			quality = "aug"
			sawQualityWord = true
			i++
		case "PLUS":
			if at(i+1) == "NUM" {
				deg, _ := strconv.Atoi(tokens[i+1].text)
				exts[deg] = 1
				i += 2
				continue
			}
			if primaryTop == -1 && len(exts) == 0 {
				quality = "aug"
				sawQualityWord = true
			} else {
				errors = append(errors, "unexpected '+'")
			}
			i++
		case "MINUS":
			if at(i+1) == "NUM" && (sawQualityWord || primaryTop != -1 || len(exts) > 0) {
				deg, _ := strconv.Atoi(tokens[i+1].text)
				exts[deg] = -1
				i += 2
				continue
			}
			if !sawQualityWord && primaryTop == -1 && len(exts) == 0 {
				quality = "minor"
				sawQualityWord = true
			} else {
				errors = append(errors, "unexpected "+strconv.Quote(tx))
			}
			i++
		case "SUS2":
			quality = "sus2"
			sawQualityWord = true
			i++
		case "SUS4", "SUS":
			quality = "sus4"
			sawQualityWord = true
			i++
		case "ALT":
			exts[7] = -1
			exts[9] = -1
			exts[5] = 1
			sawSeventh = true
			i++
		case "ADD":
			if at(i+1) != "NUM" {
				errors = append(errors, "'add' must be followed by a number")
				i++
				continue
			}
			deg, _ := strconv.Atoi(tokens[i+1].text)
			exts[deg] = 0
			i += 2
		case "SHARP", "FLAT":
			if at(i+1) != "NUM" {
				errors = append(errors, strconv.Quote(tx)+" must be followed by a number")
				i++
				continue
			}
			degree, _ := strconv.Atoi(tokens[i+1].text)
			if kind == "SHARP" {
				exts[degree] = 1
			} else {
				exts[degree] = -1
			}
			if degree == 7 {
				sawSeventh = true
			}
			i += 2
		case "NUM":
			degree, _ := strconv.Atoi(tx)
			j := i + 1
			alter := 0
			handled := false
			mod := at(j)
			bindsForward := at(j+1) == "NUM"
			switch {
			case mod == "MAJ":
				alter, handled, j = 0, true, j+1
			case mod == "MIN":
				alter, handled, j = -1, true, j+1
			case (mod == "MINUS" || mod == "DEG") && !bindsForward:
				alter, handled, j = -1, true, j+1
			case mod == "PLUS" && !bindsForward:
				if degree == 7 {
					reading := readings["sevenPlus"]
					ambiguity("sevenPlus", reading)
					if reading == "majorSeventh" {
						majorSeventh = true
						alter = 0
					} else {
						alter = -1
						exts[5] = 1
					}
				} else {
					alter = 1
				}
				handled, j = true, j+1
			}

			if !handled && degree == 4 && !sawQualityWord && len(exts) == 0 {
				quality = "sus4"
				sawQualityWord = true
				i = j
				continue
			}
			if !handled && degree == 4 && quality == "major" {
				reading := readings["bareFour"]
				ambiguity("bareFour", reading)
				if reading == "suspended" {
					quality = "sus4"
					sawQualityWord = true
					i = j
					continue
				}
			}

			isPrimary := primaryTop == -1 && !handled && degree >= 5
			if isPrimary {
				primaryTop = degree
				if degree == 5 {
					if !sawQualityWord {
						quality = "power"
					}
				} else if degree == 6 {
					exts[6] = 0
				} else {
					addSeventh := true
					if degree == 9 && !majorSeventh && !sawSeventh {
						reading := readings["bareNine"]
						ambiguity("bareNine", reading)
						if reading == "add" {
							addSeventh = false
						}
					}
					if addSeventh && !sawSeventh {
						exts[7] = seventhAlter(quality, majorSeventh)
						sawSeventh = true
					}
					if degree != 7 {
						exts[degree] = 0
					}
					for _, implied := range chordStack(degree) {
						if _, ok := exts[implied]; !ok {
							exts[implied] = 0
						}
					}
				}
			} else {
				exts[degree] = alter
				if degree == 7 {
					sawSeventh = true
				}
				if primaryTop == -1 && handled && degree >= 7 {
					primaryTop = degree
				}
			}
			i = j
		case "SLASH":
			if at(i+1) != "NUM" {
				errors = append(errors, "a '/' must be followed by a bass note or a number")
			}
			i++
		default:
			errors = append(errors, "unexpected "+strconv.Quote(tx))
			i++
		}
	}

	if majorSeventh {
		if _, ok := exts[7]; !ok && !majWordAlone {
			exts[7] = 0
		}
	}

	if bareDegreeSign && quality == "dim" {
		if _, ok := exts[7]; !ok {
			reading := readings["degreeSign"]
			ambiguity("degreeSign", reading)
			if reading == "diminishedSeventh" {
				exts[7] = -2
			}
		}
	}

	// Fold triad-defining alterations into the quality (§5.2.1).
	if quality == "minor" && exts[5] == -1 {
		quality = "dim"
		delete(exts, 5)
	}
	if quality == "major" && exts[5] == 1 {
		quality = "aug"
		delete(exts, 5)
	}
	if quality == "aug" && exts[5] == 1 {
		delete(exts, 5)
	}
	if quality == "dim" && exts[5] == -1 {
		delete(exts, 5)
	}

	if len(errors) > 0 {
		return chordResult{chord: nil, ambiguities: ambiguities, errors: errors}
	}

	for degree := range exts {
		switch degree {
		case 2, 4, 5, 6, 7, 9, 11, 13:
		default:
			return fail("degree " + strconv.Itoa(degree) + " cannot be an extension")
		}
	}

	degrees := make([]int, 0, len(exts))
	for d := range exts {
		degrees = append(degrees, d)
	}
	sort.Ints(degrees)
	extArr := []any{}
	for _, d := range degrees {
		e := NewObject()
		e.Set("degree", d)
		e.Set("alter", exts[d])
		extArr = append(extArr, e)
	}

	chord := NewObject()
	chord.Set("root", noteObject(root))
	chord.Set("quality", quality)
	chord.Set("extensions", extArr)
	if bass != nil {
		chord.Set("bass", noteObject(*bass))
	} else {
		chord.Set("bass", nil)
	}
	return chordResult{chord: chord, ambiguities: ambiguities, errors: []string{}}
}

// ParseChord is the exported chord parser for the corpus harness's /chords check,
// mirroring the reference's parse_chord and the JS twin's impl.parseChord: the
// chord model (nil when the symbol is unreadable), the ambiguities resolved, and
// the errors. The reader uses the unexported parseChord directly.
func ParseChord(symbol, dialect string) (chord Model, ambiguities []any, errors []string) {
	r := parseChord(symbol, dialect)
	return r.chord, r.ambiguities, r.errors
}
