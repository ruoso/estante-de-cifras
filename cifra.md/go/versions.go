package cifra

// Form-aware canonicality surface (DIRECTION §3.6 "Versions", workflow 14
// §Canonical form). When the canonical form changes, the service accepts the
// previous form as well as the current one for a while, so the Go hook carries
// both; this file is the seam that carries them. Today the registries hold
// exactly one entry — the current spec version's canonical form — so the
// previous-form slot is empty; the point is that adding a previous form later
// is one data entry, with no change to FormOf/SetlistFormOf or the hook.
//
// The spec defines exactly one canonical form (§8.1) and carries no version
// token in any document (workflow 14: acceptance is behavioural, not a field).
// A Form is therefore the module's own label for a form, never written into a
// document; identification is purely by which accepted checker the bytes
// satisfy.

// Form is the module's label for one of the canonical forms the build
// recognises. It is version-like (DIRECTION §3.6: "Each implementation says
// which version of the specification it conforms to") but never a token that
// travels in a file.
type Form string

// CurrentForm is the form of the current spec version's canonical text. "1" is
// the first spec version's ordinal; a future form change prepends "2" and keeps
// "1" as the previous form for a while.
const CurrentForm Form = "1"

// formCheck pairs a form's identity with the predicate that recognises a
// document canonical in that form. A registry is a list of these, newest first;
// formOf returns the first form whose check passes. Adding a previous form when
// the canonical form changes is appending one entry ahead of the current one.
type formCheck struct {
	id    Form
	check func(text []byte) bool
}

// songForms is the song canonicality registry, current form first. Today it
// holds exactly the current form, whose check is isCanonical (§9.1); the
// previous-form slot is empty until a real spec-version form change adds it.
var songForms = []formCheck{
	{CurrentForm, isCanonical},
}

// setlistForms is the setlist canonicality registry, mirroring songForms.
var setlistForms = []formCheck{
	{CurrentForm, isCanonicalSetlist},
}

// AcceptedForms returns the canonical forms this build recognises, current
// first (today: exactly CurrentForm). The hook accepts a document canonical
// under any of them (DIRECTION §3.6: "the service accepts the previous form as
// well as the current one for a while").
func AcceptedForms() []Form {
	forms := make([]Form, len(songForms))
	for i, fc := range songForms {
		forms[i] = fc.id
	}
	return forms
}

// formOf is the registry dispatch: the first form in forms whose check accepts
// text, or ("", false) when none does. A non-UTF-8 text, a marked text or a
// text canonical under no accepted form reports ("", false) — each registered
// check (isCanonical, isCanonicalSetlist) already applies the UTF-8 and
// marker-line gates.
func formOf(forms []formCheck, text []byte) (Form, bool) {
	for _, fc := range forms {
		if fc.check(text) {
			return fc.id, true
		}
	}
	return "", false
}

// FormOf reports the accepted form a song's bytes are canonical in (first
// match), or ("", false) when the text is not UTF-8, holds a marker line, or is
// canonical under no accepted form — "the module reports which form a text is
// in" (workflow 14).
func FormOf(text []byte) (Form, bool) {
	return formOf(songForms, text)
}

// SetlistFormOf is FormOf for a setlist: the accepted form text is a canonical
// setlist in, or ("", false) when none.
func SetlistFormOf(text []byte) (Form, bool) {
	return formOf(setlistForms, text)
}
