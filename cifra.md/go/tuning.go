package cifra

// Tunings (spec §6). A faithful port of the reference's
// reference/cifra_md/tuning.py — never imported from it: agreement is by the
// corpus, not shared code (DIRECTION §3.6).

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var tuningSepRE = regexp.MustCompile(`[, ]+`)

// tuningModel is a parsed tuning: its canonical text, its pitches, and its
// identity by sound (§6.3).
type tuningModel struct {
	text    string
	pitches []pitch
	id      string
}

// parseTuning reads a list of pitches separated by commas and/or whitespace.
func parseTuning(text string) (tuningModel, error) {
	var parts []string
	for _, p := range tuningSepRE.Split(text, -1) {
		if p != "" {
			parts = append(parts, p)
		}
	}
	if len(parts) == 0 {
		return tuningModel{}, fmt.Errorf("a tuning needs at least one pitch")
	}
	pitches := make([]pitch, 0, len(parts))
	canon := make([]string, 0, len(parts))
	for _, p := range parts {
		pt, err := parsePitch(p)
		if err != nil {
			return tuningModel{}, err
		}
		pitches = append(pitches, pt)
		canon = append(canon, canonicalPitchText(p))
	}
	return tuningModel{
		text:    strings.Join(canon, " "),
		pitches: pitches,
		id:      tuningID(pitches),
	}, nil
}

// tuningID is the identity by sound (§6.3): Eb2 and D#2 are the same string.
func tuningID(pitches []pitch) string {
	parts := make([]string, len(pitches))
	for i, p := range pitches {
		parts[i] = strconv.Itoa(midi(p))
	}
	return strings.Join(parts, " ")
}

// tuningObject builds the model's {text, pitches, id} object.
func tuningObject(t tuningModel) *Object {
	o := NewObject()
	o.Set("text", t.text)
	pitchArr := []any{}
	for _, p := range t.pitches {
		po := NewObject()
		po.Set("note", noteObject(p.note))
		po.Set("octave", p.octave)
		pitchArr = append(pitchArr, po)
	}
	o.Set("pitches", pitchArr)
	o.Set("id", t.id)
	return o
}
