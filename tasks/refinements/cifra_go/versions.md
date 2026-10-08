# cifra_go.versions — Two canonical-form versions side by side

## TaskJuggler entry

[`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 36–41:

```
task versions "Two canonical-form versions side by side" {
  effort 1d
  allocate team
  depends !writer
  note "The hook accepts the current and the previous form for a while; the module exposes both. DIRECTION §3.6 Versions, workflow 14. Tests: unit (a text canonical only under the previous form passes the previous check and fails the current one, and the reverse; the module reports which form a text is in)."
}
```

The `note` does **not** start with `cifra.md:`, but the work is unambiguously
in the cifra.md Go module: "the module" is cifra.md for Go
([`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 line 285 — "cifra.md
for Go … Reads and canonicalizes songs and setlists. The hook's"), and the
task's siblings in area `cifra_go` all land in `cifra.md/go/`. The governing
documents it names (DIRECTION §3.6, workflow 14) live here in
estante-de-cifras because the *policy* of accepting a previous form is
Estante's, not the format's.

## Effort estimate

1 day, from the `.tji`.

## Repository

**cifra.md**, directory `go/` (package `cifra`). As with every `cifra_go`
task, the code, its unit tests and the build gate run in the cifra.md
repository; the refinement, its `## Status` block and `complete 100` land in
**estante-de-cifras**, and the Status block cites the cifra.md commit.

No estante-de-cifras source changes, and **no design delta**: DIRECTION §3.6
and workflow 14 already describe the capability this task builds; the cifra.md
specification is untouched (it defines exactly one canonical form, and that is
correct — see Decisions).

## Inherited dependencies

- **`cifra_go.writer`** — *settled* (`complete 100`,
  [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 22–28; cifra.md
  commit `d5dd57b`). Direct `depends !writer`. Provides the pieces this task
  builds on: the exported `IsCanonical(text []byte) bool`
  ([`go/cifra.go`](../../../../cifra.md/go/cifra.go) line 58 → `isCanonical`
  in `go/write.go` line 963), `Write`, `Canonical`, the §8 serialiser and the
  `MarkedTextError` / marker-line gate. `IsCanonical` is the current form's
  checker; this task wraps it in a form-aware layer.
- **`cifra_go.setlists`** — *settled* (`complete 100`,
  [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 29–35; cifra.md
  committed alongside estante `5f52a38`). **Not** in the `.tji` `depends`
  (which lists only `!writer`), but `complete 100`, so the prerequisite
  exists. This task adds the setlist canonicality predicate, which needs
  `ParseSetlist` / `WriteSetlist`
  ([`go/setlist.go`](../../../../cifra.md/go/setlist.go) lines 370, 669). The
  closer should add `!setlists` to `versions`'s `depends` for WBS hygiene
  (surfaced in the return summary); it changes no scheduling, since setlists
  already landed.

Transitively settled through the above: `cifra_go.module` (the corpus
harness and the `cifra` package skeleton), `cifra_go.reader`, and the
`format.*` corpus tasks (the corpus directory this task's unit tests read a
canonical text from).

## What this task is

Give the cifra.md Go module a **form-aware canonicality surface**: a small
registry of the canonical forms the build recognises, newest first, and
functions that report **which** accepted form a document's bytes are in (or
none). Today the registry holds exactly one entry — the current spec
version's canonical form — so the previous-form slot is empty; the point of
the task is the *seam*, so that when the canonical form later changes, adding
the previous form's checker is a one-line data change and every caller (above
all the push hook) keeps working unchanged.

Concretely, in package `cifra` (new file `go/versions.go`, plus a setlist
predicate in `go/setlist.go`):

- `type Form string` and `const CurrentForm Form = "1"` — a form's identity.
- `func AcceptedForms() []Form` — the forms this build recognises, current
  first (today: `[]Form{CurrentForm}`).
- `func FormOf(text []byte) (Form, bool)` — the accepted form a **song**'s
  bytes are canonical in (first match), or `("", false)` when none (it is not
  UTF-8, holds a marker line, or is canonical under no accepted form).
- `func SetlistFormOf(text []byte) (Form, bool)` — the same for a **setlist**.
- `func IsCanonicalSetlist(text []byte) bool` — the setlist counterpart of
  the existing song `IsCanonical`: `WriteSetlist(ParseSetlist(text))` equals
  `text` byte for byte, after the UTF-8 and marker-line gates. The current
  form's setlist checker, and the building block `SetlistFormOf` uses.
- `IsCanonical(text []byte) bool` is unchanged — the current form's song
  checker, the first entry of the song registry.

## Why it needs to be done

[`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6 "Versions" (lines
302–306): *"When the canonical form changes, the service accepts the previous
form as well as the current one for a while (workflow 14), so the Go hook
carries both."* Workflow 14 §Canonical form
([`docs/workflows/14-file-view.md`](../../../docs/workflows/14-file-view.md)
lines 77–82): *"The service accepts the previous form as well as the current
one for a while, so a device that has been offline across the change still
syncs."*

The direct downstream consumer is **`hook.canonical`**
([`tasks/35-hook.tji`](../../35-hook.tji) lines 29–33), which `depends … ,
cifra_go.writer, cifra_go.setlists, cifra_go.versions` and whose note reads
*"Every song and setlist in a new commit canonical under the current or the
previous form … marker lines refused."* The hook must call a **form-aware**,
**song-and-setlist** canonicality check — the disjunction "current or
previous" — so that the day a form changes, the hook's behaviour changes by
data, not by code. This task is where that surface is defined; building it now
(latent, one form) is what lets the hook be written correctly against it.

## Inputs / context

- **The task and its downstream:**
  [`tasks/15-cifra-go.tji`](../../15-cifra-go.tji) lines 36–41 (this task);
  [`tasks/35-hook.tji`](../../35-hook.tji) lines 29–33 (`hook.canonical`, the
  consumer).
- **Governing design:** [`docs/DIRECTION.md`](../../../docs/DIRECTION.md) §3.6
  lines 302–306 (Versions), lines 285, 288–291 (the hook uses the Go
  implementation; the service understands a song only to check it is
  canonical); [`docs/workflows/14-file-view.md`](../../../docs/workflows/14-file-view.md)
  §What a book may hold / §Canonical form / §What the service checks (lines
  51–65 single canonical form, 77–82 the previous-form transition window).
- **The format:** there is exactly **one** canonical form today.
  [`spec/8-normalisation.md`](../../../../cifra.md/spec/8-normalisation.md)
  §8.1 lines 10–11 ("Every document has exactly one **canonical form**") and
  17–18 (it is unique);
  [`spec/9-conformance.md`](../../../../cifra.md/spec/9-conformance.md) §9.1
  "Writer" lines 59–62 ("A writer that checks whether a document is canonical
  does so by canonicalising it and comparing") and §9.1 for the canonicality
  predicate the song checker implements. Profiles (§9) are capability tiers,
  **not** format versions; legacy spellings
  ([`spec/appendix-a-legacy.md`](../../../../cifra.md/spec/appendix-a-legacy.md))
  are reader-accepted input a writer never emits — never an alternate
  canonical form. The spec carries no version token in any document.
- **The code this extends:**
  [`go/cifra.go`](../../../../cifra.md/go/cifra.go) — `IsCanonical` (line 58),
  `Parse`/`Write`/`Canonical`; [`go/write.go`](../../../../cifra.md/go/write.go)
  — `isCanonical` (line 963), `checkUnmarked`/`MarkedTextError`;
  [`go/setlist.go`](../../../../cifra.md/go/setlist.go) — `ParseSetlist` (370),
  `WriteSetlist` (669), `CanonicalSetlist` (731). No `Form`, `FormOf`,
  `SpecVersion` or setlist canonicality predicate exists yet (verified by
  grep).
- **Test idiom:** [`go/canonical_test.go`](../../../../cifra.md/go/canonical_test.go)
  `TestIsCanonical` (lines 595–617) reads a corpus text with
  `os.ReadFile(filepath.Join("..", "corpus", "01-minimal-chart",
  "canonical.cifra.md"))` and asserts `IsCanonical(canonical)` /
  `!IsCanonical(input)` / false on a marked and a non-UTF-8 text. The
  versions test mirrors this. Setlist corpus entries live at
  [`corpus/35-setlist-minimal/`](../../../../cifra.md/corpus/35-setlist-minimal/)
  (`input.setlist.md`, `canonical.setlist.md`).
- **The predecessor's decisions:** `cifra_go.writer`
  ([`writer.md`](writer.md)) — `IsCanonical` takes `[]byte` (the hook reads
  file bytes; the UTF-8 gate must see raw bytes), is unit-tested not
  corpus-tested (the corpus harness drives `Write`/`Canonical` directly),
  `Canonical` is a dedicated model→model function, agreement is by the corpus
  and never by shared code (DIRECTION §3.6).

## Constraints / requirements

- **The spec is not changed.** One canonical form stands. The previous-form
  slot stays empty until a real form change happens in a future spec version;
  this task invents no second published form (that would be a format change
  with no basis — see Decisions).
- **No document-embedded version marker.** Identification is purely by which
  accepted checker the bytes satisfy (workflow 14: acceptance is behavioural,
  no version field). `Form` is the module's own label for a form, not a token
  written into any document.
- **Byte-for-byte, through the existing checkers.** A form's check is the
  existing operational predicate — `isCanonical` for songs
  (`Write(Parse(text)) == text` after the UTF-8/marker gates), its setlist
  twin for setlists — compared byte for byte, never deep-equal.
- **Canonical form over preserving content.** The checks only *classify*
  bytes; they never rewrite or accept non-canonical spelling. A marked text
  (holding a conflict-marker line) is canonical under no form.
- **Implementations agree because they are checked, not shared** (DIRECTION
  §3.6 lines 293–300). The form layer is Go-native; nothing is imported,
  transpiled or vendored from the JS or Python implementations. (The app
  "carries only the current one" — DIRECTION line 305 — so there is no JS
  twin of this registry to match; the shared contract is the format and the
  corpus, both unchanged.)
- **No song text in logs; purpose-written fixtures.** The unit tests use the
  project's own corpus entries and purpose-written songs, never anyone else's
  words. (No service, UI, network or storage is touched, so the
  accessibility, offline-first and no-book-without-an-account rules do not
  apply to this task.)
- **Component boundary.** The module exposes the surface; the hook (a
  separate task, `hook.canonical`, in estante `service/cmd/pre-receive`)
  consumes it. This task writes no hook code.

## Acceptance criteria

### Behaviour delivered

1. Package `cifra` exposes `Form`, `CurrentForm`, `AcceptedForms()`,
   `FormOf(text)`, `SetlistFormOf(text)` and `IsCanonicalSetlist(text)`;
   `IsCanonical` is unchanged.
2. `AcceptedForms()` returns exactly `[]Form{CurrentForm}` today (current
   first; the previous-form slot is empty).
3. `FormOf` / `SetlistFormOf` return `(CurrentForm, true)` for a canonical
   song / setlist, and `("", false)` for a text that is non-UTF-8, holds a
   marker line, or is non-canonical under every accepted form — "the module
   reports which form a text is in."
4. The registry dispatch is a form-list → first-match loop; adding a previous
   form later is appending one `{id, check}` entry ahead of the current one,
   with no change to `FormOf`/`SetlistFormOf`/the hook.
5. `go vet`, `go test` and `go build` are green under `scripts/gate`
   (`go_checks "cifra.md go"`). No change to the corpus or its ledger
   ([`go/internal/corpus/expected-failures.json`](../../../../cifra.md/go/internal/corpus/expected-failures.json)):
   the form layer is not corpus-harness-driven (the harness drives
   `Write`/`Canonical`/`WriteSetlist`/`CanonicalSetlist`), exactly as
   `IsCanonical` is unit- not corpus-tested.

### Tests the task lands with, by level

The `.tji` names **unit** only, and that is the right and only level: this is
pure dispatch logic plus two canonicality predicates, with no new
canonical-text behaviour (the underlying `isCanonical` / setlist round-trip
correctness is already pinned by the writer and setlist corpora). There is no
behavior / e2e-api / e2e-web level for format work, and no corpus-ledger
change.

- **unit — `go/versions_test.go`** (new; white-box `package cifra`):
  - *Dual-form dispatch (the `.tji`'s named case).* Build a synthetic
    two-form list `[]formCheck{{CurrentForm, isCanonical}, {Form("0-crlf"),
    prevCheck}}`, where `prevCheck` recognises the CRLF variant of a
    canonical song (`bytes.Contains(t, "\r\n") && isCanonical(LF-normalised
    t)`) — a faithful model of a text-rule form change (workflow 14 fixes LF
    as a text rule, lines 64–65). Drive the unexported `formOf(forms, text)`:
    - the LF canonical corpus song (`01-minimal-chart/canonical.cifra.md`)
      → `(CurrentForm, true)`; `isCanonical` true, `prevCheck` false — passes
      the current check, fails the previous one;
    - its CRLF variant → `(Form("0-crlf"), true)`; `isCanonical` false,
      `prevCheck` true — passes the previous check, fails the current one
      ("and the reverse");
    - a non-canonical input / a marked text / a non-UTF-8 text →
      `("", false)`.
    Pins DIRECTION §3.6 Versions and workflow 14 §Canonical form (the
    current-or-previous disjunction, and reporting which form).
  - *Production song surface.* `AcceptedForms()` == `[]Form{CurrentForm}`;
    `FormOf(canonical.cifra.md)` == `(CurrentForm, true)`;
    `FormOf(input.cifra.md)` == `("", false)`; `FormOf` of a marked and of a
    non-UTF-8 text == `("", false)`. (Corpus texts read as in
    `canonical_test.go:599–606`.)
  - *Production setlist surface.* Reading
    `corpus/35-setlist-minimal/{canonical,input}.setlist.md`:
    `IsCanonicalSetlist(canonical)` true, `IsCanonicalSetlist(input)` false,
    and false on a marked and a non-UTF-8 setlist;
    `SetlistFormOf(canonical)` == `(CurrentForm, true)`,
    `SetlistFormOf(input)` == `("", false)`. Pins the setlist half of
    `hook.canonical`'s "every song and setlist … canonical under the current
    or the previous form."

### Deferred work

None. The task is self-contained; the previous form is not "deferred work" —
it is future data (one registry entry) that a future spec version's
form-change task will add, not a follow-up this task owes. No tech-debt leaf,
no parking-lot item.

## Decisions

- **Ship the seam with exactly one form; do not invent a second published
  form.** *Rationale:* the spec defines one canonical form
  (§8.1 lines 10–11) and nothing is a "previous form" yet; manufacturing one
  would be a format change with no basis and no corpus. The task's value is
  the *mechanism* — a form registry and a first-match dispatch — so the hook
  can be written against "current or previous" today and a real form change
  later is a one-entry data change. The tiny latent machinery is justified by
  the explicit DIRECTION §3.6 / workflow 14 requirement and the
  `hook.canonical` dependency, against the YAGNI alternative of a song-only
  `IsCanonical` the hook calls directly: that alternative would force the hook
  to grow the form-disjunction itself when the form changes, spreading
  version logic into estante-de-cifras — exactly the coupling DIRECTION §3.6
  places in the Go module ("the Go hook carries both").
- **Prove the dual-form behaviour with a synthetic previous form in the
  test.** *Rationale:* the `.tji` names a test that needs two genuinely
  different forms ("canonical only under the previous form … and the
  reverse"); with one real form, the second must be constructed in-test. A
  CRLF-variant checker is honest — line endings are a fixed text rule
  (workflow 14 lines 64–65), so "LF vs CRLF" is precisely the shape a real
  text-rule form change would take — and it exercises the dispatch without
  pretending the spec has two forms. *Alternative rejected:* two arbitrary
  opaque predicates — they would test the loop but not resemble a real form
  change, making the test less meaningful.
- **`Form` identities are version-like labels owned by the module, not
  document tokens; `CurrentForm = "1"`.** *Rationale:* DIRECTION §3.6 line 302
  — "Each implementation says which version of the specification it conforms
  to" — so a stable identity a diagnostic or log could name is wanted; `"1"`
  is the least presumptuous ordinal for the first spec version, extended to
  `"2"` when the form changes (new form prepended, previous kept). Workflow 14
  confirms there is no marker in the document, so this label never travels in
  a file. *Alternative rejected:* relative `"current"`/`"previous"` labels —
  they carry no stable per-version identity (a text's reported form would
  change meaning across a build), and they drop the spec-version framing
  DIRECTION uses.
- **The form layer covers songs and setlists; add `IsCanonicalSetlist`
  here.** *Rationale:* `hook.canonical` checks "every song **and** setlist …
  canonical under the current or the previous form," but no setlist
  canonicality predicate exists (only song `IsCanonical`). The form-aware
  surface is the single place the hook asks "is this file canonical, under
  which form"; it must be symmetric, so this task adds the setlist twin
  (mirroring `IsCanonical`: `WriteSetlist(ParseSetlist(text)) == text` after
  the gates). *Alternative rejected:* a separate follow-up task for the
  setlist predicate — it is one small function the hook directly needs, and
  splitting it from the form layer that uses it would leave setlist
  form-checking homeless.
- **`IsCanonical` stays unchanged; the registry wraps it.** *Rationale:*
  `IsCanonical` is the stable current-form song predicate (writer.md), used by
  its own unit tests as the current form's building block; `FormOf`'s first
  registry entry *is* `isCanonical`, so there is one definition of "current
  form," not two. *Alternative rejected:* re-expressing `IsCanonical` as
  `FormOf(text) == CurrentForm` — needless churn on a shipped, corpus-adjacent
  function.
- **No design delta.** *Rationale:* DIRECTION §3.6 and workflow 14 already
  describe dual-form acceptance; the spec's single canonical form is correct
  and untouched; the registry and the conformance label are implementation
  concerns. Nothing in the constitution needs amending for this task.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-08.

- `cifra.md 07a72e3`: `go/versions.go` (new) — `Form` type, `CurrentForm="1"`,
  `formCheck` struct, `songForms`/`setlistForms` registries (current form only),
  `AcceptedForms()`, unexported `formOf` dispatch loop, exported `FormOf` and
  `SetlistFormOf`.
- `cifra.md 07a72e3`: `go/setlist.go` (edited) — `isCanonicalSetlist` (unexported,
  mirrors `isCanonical`: UTF-8/marker-line gates then round-trip byte comparison)
  and `IsCanonicalSetlist` (exported) wrapping it.
- `cifra.md 07a72e3`: `go/versions_test.go` (new) — `TestFormOfDualForm` (synthetic
  two-form registry with CRLF-variant previous form — the `.tji`'s named case),
  `TestFormOfSong` (production song surface), `TestFormOfSetlist` (production setlist
  surface using `35-setlist-minimal/canonical` for true and
  `40-setlist-renumbering/input` for false, per implementer deviation note).
- Fixture deviation: `35-setlist-minimal/input.setlist.md` is byte-identical to its
  canonical, so the false case uses `40-setlist-renumbering/input.setlist.md`
  (genuinely non-canonical). Both the canonical and the non-canonical case are
  correctly pinned.
