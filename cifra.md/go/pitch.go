package cifra

// Note names and pitches (spec §5.1.1, §6.1). A faithful port of the
// reference's reference/cifra_md/pitch.py — never imported from it: agreement
// is by the corpus, not shared code (DIRECTION §3.6).

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// note is a note name: an uppercase letter C–B and an accidental in semitones
// (-2 .. +2). It becomes the model's {letter, accidental} object.
type note struct {
	letter     string
	accidental int
}

// pitch is scientific pitch notation: a note and an octave number.
type pitch struct {
	note   note
	octave int
}

const letters = "CDEFGAB"

var naturalPC = map[string]int{"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

var majorScale = [7]int{0, 2, 4, 5, 7, 9, 11}

var accidentals = map[string]int{"": 0, "#": 1, "♯": 1, "##": 2, "b": -1, "♭": -1, "bb": -2}

// noteRE is the root grammar (§5.1.1), reused for pitches (§6.1).
const noteRE = `[A-G](?:bb|##|[b#♯♭])?`

var noteSplitRE = regexp.MustCompile(`^([A-G])(bb|##|[b#♯♭])?$`)
var pitchRE = regexp.MustCompile(`^([A-Ga-g](?:bb|##|[b#♯♭])?)(-?[0-9]+)$`)

// parseNote reads a note name such as C, F#, Bb, Ebb; uppercase letters only.
func parseNote(text string) (note, error) {
	m := noteSplitRE.FindStringSubmatch(text)
	if m == nil {
		return note{}, fmt.Errorf("not a note name: %q", text)
	}
	return note{letter: m[1], accidental: accidentals[m[2]]}, nil
}

func formatNote(n note) string {
	acc := map[int]string{-2: "bb", -1: "b", 0: "", 1: "#", 2: "##"}[n.accidental]
	return n.letter + acc
}

// parsePitch reads scientific pitch notation: E2, F#3, Bb1, C-1.
func parsePitch(text string) (pitch, error) {
	m := pitchRE.FindStringSubmatch(strings.Trim(text, " "))
	if m == nil {
		return pitch{}, fmt.Errorf("not a pitch: %q", text)
	}
	name := m[1]
	oct, _ := strconv.Atoi(m[2])
	// Uppercase the letter; the rest (an accidental) is ASCII-safe to keep.
	up := strings.ToUpper(name[:1]) + name[1:]
	n, err := parseNote(up)
	if err != nil {
		return pitch{}, err
	}
	return pitch{note: n, octave: oct}, nil
}

// canonicalPitchText is a pitch as written, with its letter uppercase (§6.1).
func canonicalPitchText(text string) string {
	t := strings.Trim(text, " ")
	if t == "" {
		return t
	}
	return strings.ToUpper(t[:1]) + t[1:]
}

// midi is the MIDI number with C4 = 60; the accidental applies to the number,
// so Cb4 is 59.
func midi(p pitch) int {
	return (p.octave+1)*12 + naturalPC[p.note.letter] + p.note.accidental
}

// noteObject builds the model's {letter, accidental} object for a note.
func noteObject(n note) *Object {
	o := NewObject()
	o.Set("letter", n.letter)
	o.Set("accidental", n.accidental)
	return o
}
