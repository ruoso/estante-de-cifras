package hook

// messages.go is the one home for the refusal-message grammar every hook check
// and the binary's fail-closed path share. Before hook.messages each of the five
// checks (refs, stowaways, contents, canonical, limits) framed its own strings
// and the six fail-closed lines had a third shape; this file makes them one
// contract: a refusal is a single line, naming what failed and nothing of the
// song, read identically by the git CLI (`remote:` lines) and isomorphic-git
// (side-band band 2).
//
// The grammar is deliberately small — a human-readable line, not a machine
// protocol. The app reads a refusal off git's own channel the way the git CLI
// does; there is no private hook→app reason code (DIRECTION §3.6 L288-291,
// L341; hook.messages Decision). So the contract is purely: one line per
// refusal, shaped `<subject>: <fault>; refused`, carrying only what failed.
//
// What a message may name: ref names, the file path the pusher chose, object
// SHAs, counts, byte and limit figures, line numbers, and the pusher's own user
// id. What it may never carry: blob bytes, a conflict-marker line's text, a
// commit message, the mismatching README/.gitattributes bytes, a
// *MarkedTextError's .Text, or any other account's data (the standing "no song
// text in logs" rule, generalised across the matrix; DIRECTION §3.3).

import "fmt"

// refusal frames one refusal reason to the single grammar every check and the
// fail-closed path share: "<subject>: <fault>; refused". The subject is the ref
// the fault is about — refs/heads/main for every content/limit fault, the
// offending ref for the ref-name rule (the offending ref is what failed). It is
// the one place the `; refused` convention lives, generalising the local
// canonicalReason the canonical layer landed with (hook.messages Decision).
func refusal(subject, fault string) string {
	return fmt.Sprintf("%s: %s; refused", subject, fault)
}

// FailClosed is the refusal the binary emits when a check cannot complete — a
// git failure, a broken env contract, an unparseable stdin. The hook refuses
// what it cannot verify (fail closed), and the message names only the aspect it
// could not verify: a verification failure is a server-side fault of no use to
// the pusher, and the raw git stderr could carry a path or object id into the
// client channel, so it is never spliced in (hook.messages Decision; the "name
// only what failed" rule). The subject is refs/heads/main — the push as a whole
// is refused.
func FailClosed(aspect string) string {
	return refusal(MainRef, "could not verify "+aspect)
}
