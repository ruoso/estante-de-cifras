# Refinement — `design.theme_picker`

## TaskJuggler

- Task: `design.theme_picker` — "Draw the theme picker".
- Defined in [`tasks/20-design.tji`](../../20-design.tji) (lines 31–35).
- `note`: *"Decided in workflow 1 (automatic: Estante in light mode, Palco in
  dark); drawn on the account screen. Tests: none — design deliverable (the
  workflow document and its board)."*

## Effort estimate

0.5d (unchanged from the `.tji`). This is a design task: the deliverable is a
mockup board and the governing-document deltas that close the gap, not code.
The decision itself — what the themes are, how automatic works, where the
picker lives and what it syncs — is already made in workflow 1; the budget
covers drawing the picker on two phones, a tablet and a computer, registering
the board in `canvas.json`, and the small text deltas (DIRECTION §6, workflow
1, workflow 13) that mark the gap closed. No new workflow document is written
(see Decisions): the theme is decided in workflow 1, and its *place* is the
account screen of workflow 13.

## Repository

**estante-de-cifras.** The deliverable is a mockup board and
governing-document deltas, all in this repository:

- `docs/mockups/Theme-picker.dc.html` — the new board, registered in
  `docs/mockups/canvas.json` (`boards` entry + `order` array).
- `docs/DIRECTION.md` — §6 (retire the open bullet, line 537).
- `docs/workflows/01-first-run.md` — §Language / §Theme clarified to name
  where the picker lives (the account screen, reached from the header).
- `docs/workflows/13-new-device.md` — §The account screen gains a
  **Preferences** section (theme and language).

No `cifra.md:` work. The theme is an app concern (DIRECTION §3.7): it reskins
the view by swapping a CSS class on the token root, and stores one register in
the home book's `preferences.json`. It never touches the song format — the
chart is identical under every theme beyond colour and typeface (workflow 1,
[`docs/workflows/01-first-run.md`](../../../docs/workflows/01-first-run.md)
lines 113–114). Nothing in `/home/ruoso/devel/cifra.md` changes.

## Inherited dependencies

The `design` parent task `depends bootstrap.workflows`
([`tasks/20-design.tji`](../../20-design.tji) line 7). `theme_picker` carries
no further `depends` of its own in the `.tji`, and needs none: everything it
draws is already decided, and nothing it draws needs a code seam to exist
first.

- **Settled.** `bootstrap.workflows` — the fourteen workflows are decided
  (DIRECTION §7, [`docs/DIRECTION.md`](../../docs/DIRECTION.md) lines 539–569).
  Workflow 1 §Theme fixes the *decision* this task draws (three themes +
  automatic, chosen with the language, kept in the home book); workflow 13
  §The account screen fixes the *surface* the picker sits on.
- **Settled (sibling, already landed).** `design.home_book_format`
  ([`tasks/refinements/design/home_book_format.md`](home_book_format.md),
  complete) fixes where the chosen theme is stored:
  [`docs/home-book-format.md`](../../../docs/home-book-format.md) §4.1
  `preferences.json`, the `theme` register
  (`"estante"` | `"caderno"` | `"palco"` | `"automatic"`, **absent until the
  user chooses**) and the `language` register, each a `{ value, at }` envelope
  merged key by key, the later change winning. The picker writes these keys; it
  does not re-decide the format, and no format change is needed to draw it.
- **Not a dependency (deliberately decoupled).** `shell.tokens`
  ([`tasks/50-shell.tji`](../../50-shell.tji) lines 9–13) builds the themes as
  the app's stylesheet — automatic by the device's light/dark mode, the chosen
  theme from the home book — and `account.account_screen` builds the picker in
  code. This design task hands them a drawn target; it does not wait on them
  (they are downstream).

The downstream consumer that cites this task is the build task
`account.account_screen` (2d, [`tasks/70-account.tji`](../../70-account.tji)
lines 28–32), which `depends design.theme_picker` and builds the account
screen's *"Signed-in devices with sign out, passkeys, language and theme"*
(workflow 13). Its tests — behavior (*devices with sign out, passkeys,
language and theme; axe*) and e2e-web (*another device signed out from here;
theme and language kept across a reload; axe*) — need this drawn screen and
its states to pin. `shell.tokens` (which renders each theme) and
`storage.preferences_surface`
([`tasks/40-storage.tji`](../../40-storage.tji) lines 78–83, which surfaces the
`theme` register from the home book) are the engine the picker drives; both are
already specified.

## What this task is

Draw **the theme picker**: the control through which a user chooses one of the
three themes — **Estante** (neutral, ink-blue), **Caderno** (paper, pen-red,
serif) and **Palco** (dark stage, amber) — or leaves the theme **automatic**,
and where the same surface also holds the **language** picker (workflow 1 puts
the two in the same place). Workflow 1 §Theme already decides the behaviour;
this task decides the one thing it leaves open — *where the picker is drawn and
what it shows* — and draws it. It places the picker in a **Preferences**
section of the **account screen** (workflow 13), reached from the header's
account affordance and **available before sign-in** (preferences live in the
local home book from the first minute), and draws it across the three themes
and both the signed-in and not-yet-signed-in states.

## Why it needs to be done

DIRECTION §6 lists the theme picker as the one open decision that is *decided
but not drawn*: *"The theme picker, decided (workflow 1) but not drawn"*
([`docs/DIRECTION.md`](../../docs/DIRECTION.md) line 537). Until it is drawn,
the downstream work cannot land:

- `account.account_screen`
  ([`tasks/70-account.tji`](../../70-account.tji) lines 28–32) `depends
  design.theme_picker` and builds the account screen with *language and theme*.
  Its behavior and e2e-web tests (*theme and language kept across a reload;
  axe*) need the decided layout, the selected-state treatment and the automatic
  explanation to pin.
- `shell.tokens` ([`tasks/50-shell.tji`](../../50-shell.tji) lines 9–13) renders
  each theme and applies automatic from the device's mode; the picker is where
  the user sets the register it reads, so the two must agree on the four values
  and on *automatic* being a first-class choice.
- `account.account_screen` sits on the account-and-leaving milestone
  ([`tasks/99-milestones.tji`](../../99-milestones.tji)); the picker is part of
  what that milestone delivers.

## Inputs / context

Governing documents (the `.tji` note names workflow 1 and the account screen;
the fuller set below is what it and DIRECTION settle):

- **Workflow 1 §Theme** —
  [`docs/workflows/01-first-run.md`](../../../docs/workflows/01-first-run.md)
  lines 94–114. The normative decision: **three themes** — Estante (neutral,
  ink-blue), Caderno (paper, pen-red, serif) and Palco (dark stage, amber, a
  stand-readable face). *"The user chooses one, from the same place as the
  language"* (lines 99–100). Until they do, the theme is **automatic**:
  *"Estante while the device is in light mode, Palco while it is in dark mode,
  following the device as it changes … Choosing a theme replaces automatic, and
  automatic stays one of the choices"* (lines 102–106). The choice *"is a
  preference, kept in the home book like the language, so it follows the user to
  a new device. Automatic still follows each device's own light or dark mode, so
  a phone in dark mode at a gig shows Palco while the laptop at home shows
  Estante"* (lines 108–111). And: *"The chart itself never changes with the
  theme beyond colour and typeface"* (lines 113–114).
- **Workflow 1 §Language** — lines 88–92. The language is the browser's *"until
  one is chosen in the header, then that one. The choice is a preference, so it
  lives in the home book."* The theme sits *"in the same place as the
  language,"* so this task settles where that place is drawn.
- **Workflow 13 §The account screen** —
  [`docs/workflows/13-new-device.md`](../../../docs/workflows/13-new-device.md)
  lines 68–73. Today it lists **signed-in devices** (each with *sign out*) and
  **passkeys** (listed, removable). This is the surface the picker joins, as a
  Preferences section.
- **DIRECTION §3.2 Personal state** —
  [`docs/DIRECTION.md`](../../docs/DIRECTION.md) lines (the personal-state
  section). Preferences are committed to the home book **automatically** (no
  explicit save); they exist from the first minute, local, before any account.
- **DIRECTION §3.7 The app** — React with React Aria Components; the Worker owns
  the data (the home book, IndexedDB); the main thread never touches IndexedDB;
  the view is the only layer that knows React. A theme change is a message to
  the Worker that writes `preferences.json`; `shell.tokens` applies the class on
  the token root.
- **DIRECTION §6** — line 537. The open-decision bullet this task retires.
- **DIRECTION §7** — lines 539–569. The workflow list. **No item is added** (no
  new workflow; the theme is decided in workflow 1 — see Decisions).
- **The home book's storage** —
  [`docs/home-book-format.md`](../../../docs/home-book-format.md) §4.1
  `preferences.json`: the `theme` register
  (`"estante"` | `"caderno"` | `"palco"` | `"automatic"`, absent ⇒ automatic)
  and the `language` register, `{ value, at }`, merged key by key. The picker
  writes one register per change; a theme change is a one-line diff.
- **The themes, drawn** — [`docs/mockups/Main.dc.html`](../../../docs/mockups/Main.dc.html)
  ("Visual language": the three directions drawn with the same parts) and
  [`docs/mockups/theme.css`](../../../docs/mockups/theme.css): a flat set of
  semantic tokens re-declared per `.theme-<name>` class on the `.est` root —
  `theme-estante` (= `theme-current`, lines 22–47, light), `theme-caderno`
  (lines 49–76, light), `theme-palco` (lines 78–105, dark). There is **no
  light/dark token or `prefers-color-scheme` query**: light vs dark is which
  direction class is active, and Palco is the only dark one — exactly workflow
  1's automatic pairing (light ⇒ Estante, dark ⇒ Palco).
- **The existing account screen, drawn** —
  [`docs/mockups/W13-new-device.dc.html`](../../../docs/mockups/W13-new-device.dc.html)
  lines 144–171 (the computer column, titled *Account*: an avatar/name side
  pane with *sign out of this computer*, and a main pane of *Signed-in devices*
  and *Passkeys*). The board the new one continues from, as `W16` continued from
  `W02` without editing it.
- **Mockup conventions** — [`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md)
  (the `.dc.html` structure, `support.js`+`theme.css`, the `.board-head`, three
  `.dev-col`s = two phones, a tablet, a computer; the root
  `class="est theme-{{theme}} density-{{density}} board"` and the standard
  `theme`/`density` enum tweak; never hard-code colours, only `var(--…)`),
  [`docs/mockups/README.md`](../../../docs/mockups/README.md) ("Decisions the
  drawings carry": every status badge carries a **word, never colour alone**),
  and [`docs/mockups/canvas.json`](../../../docs/mockups/canvas.json) (the board
  layout: a `boards` entry `{x, y, w, h, title}` + the `order` array; workflow
  boards are `w:3208 h:1500 x:0`, stacked on a 1620 `y` stride, the last at
  `y:26720`).
- **The build tasks this hands a target to** —
  `account.account_screen` ([`tasks/70-account.tji`](../../70-account.tji)
  lines 28–32), `shell.tokens` ([`tasks/50-shell.tji`](../../50-shell.tji)
  lines 9–13), `shell.i18n` (lines 22–27: English, Brazilian Portuguese, Latin
  American Spanish, Italian — the language list the picker lists),
  `storage.preferences_surface` ([`tasks/40-storage.tji`](../../40-storage.tji)
  lines 78–83).
- **Sibling design refinements for shape and ritual** —
  [`tasks/refinements/design/explorer.md`](explorer.md),
  [`tasks/refinements/design/instruments.md`](instruments.md),
  [`tasks/refinements/design/home_book_format.md`](home_book_format.md), and the
  design-task convention in [`tasks/refinements/README.md`](../README.md)
  lines 38–45 (a board; DIRECTION §6/§7 updated for the gap closed).

## Constraints / requirements

- **Workflow 1 is normative; this task draws the gap, it does not redesign.**
  The three themes, *automatic* as the default and a first-class choice, the
  home-book preference and the per-device re-evaluation of automatic are all
  settled in workflow 1 and drawn verbatim. This task decides only where the
  picker lives and what it shows.
- **Three themes and automatic — not a light/dark toggle.** The `.tji` note's
  *"automatic: Estante in light mode, Palco in dark"* describes the **automatic
  mapping**, not the whole picker: the picker offers Automatic, Estante, Caderno
  and Palco (Caderno is a third, light, non-automatic choice). The board must
  draw all four.
- **Available before sign-in.** Preferences live in the local home book from the
  first minute (DIRECTION §3.2, workflow 1 §The home book); the picker is
  reachable and writable with no account, writing `preferences.json` locally and
  syncing when there is a network (workflow 8). The signed-in-only sections
  (devices, passkeys) are additive; they do not gate the picker.
- **Offline first.** Choosing a theme or language is a local write to the home
  book — it never waits on the network; automatic needs no network at all. It
  commits automatically (no explicit save, DIRECTION §3.2) and syncs later.
- **Component boundary (DIRECTION §3.6–3.7).** The picker is a React/React Aria
  view; choosing writes `preferences.json` through the Worker (the main thread
  never touches IndexedDB); `shell.tokens` applies the resulting theme class on
  the token root. The app and the service share no code; nothing here is a
  service concern.
- **Accessibility (standing rule), with teeth here.** This is a picker *of
  colours*, so status carried by a **word, never colour alone** is not optional:
  the theme options are a labelled radio group (Automatic, Estante, Caderno,
  Palco), the selected one marked by a **word and an indicator** (e.g.
  *Selected* / a check), not by a highlight colour alone; each option is named
  in text even where a swatch previews it. Every interactive part is a React
  Aria Component, with a full keyboard path through the options; axe at WCAG 2.1
  AA. The board shows the selected-state word.
- **No song text in logs; no copyrighted words.** Not song-facing — the board
  draws settings, no song text. Any avatar/name reuses the invented account
  (*Rafael Lima* / `rafael@example.com`) already on the W13 account screen.
- **No book without an account does not apply here.** The home book is the
  user's own local book, needs no membership, and the picker predates any
  account. (Noted so the rule is not mis-scoped onto it.)
- **Canonical form does not apply.** `preferences.json` is settings, not a song
  or setlist; there is no canonical-vs-non-canonical question. (Noted.)
- **No new runtime dependency and no new architectural seam.** The themes are
  the existing `theme.css` directions; the picker is React/React Aria already
  chosen (DIRECTION §3.7); the storage is the existing `preferences.json`
  register. This task introduces none, so there is **no DIRECTION §3.x delta** —
  only the §6 edit that closes the documented gap and the workflow clarifications
  that place the picker.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause is
*"none — design deliverable (the workflow document and its board)"*).
Acceptance is what the board shows and the governing-document deltas. The board
must be concrete enough that `account.account_screen`'s named tests (below) are
writable against it.

**1. The governing-document deltas decide and place the picker.** Drawn and
stated:

- **Where it lives.** The theme and language picker is a **Preferences** section
  of the **account screen** (workflow 13), reached from the header's account
  affordance, present whether or not the user is signed in. *Pins
  `account.account_screen`'s behavior test* (devices, passkeys, **language and
  theme** on one screen).
- **The four choices.** **Automatic** (the default, selected while the `theme`
  register is absent), **Estante**, **Caderno**, **Palco** — a radio group, each
  option named in text with a small live preview, the selected one carrying a
  **word + indicator**. *Pins `shell.tokens`' unit test* (the theme chosen by the
  device's mode and by the home book) and `account.account_screen`'s axe check.
- **Automatic, explained in words.** The Automatic option says, in words, that
  it follows this device — **light → Estante, dark → Palco** — and that choosing
  a named theme replaces it (workflow 1 lines 102–106). *Pins the behavior
  test's rendering of the automatic state.*
- **What syncs, what is per device.** The chosen value is kept in the home book
  and follows the user to a new device; automatic still re-evaluates per device
  (a dark-mode phone shows Palco while the laptop shows Estante — workflow 1
  lines 108–111). *Pins `account.account_screen`'s e2e-web test* (theme and
  language kept across a reload).
- **Language beside theme.** The same Preferences section lists the languages
  (`shell.i18n`: English, Brazilian Portuguese, Latin American Spanish, Italian),
  the browser's until one is chosen. *Pins the e2e-web* (language kept across a
  reload).

**2. `docs/mockups/Theme-picker.dc.html` exists and is registered.** Drawn to
[`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md) (the `.dc.html`
structure, `support.js`+`theme.css`, the `.board-head`, three `.dev-col`s =
**two phones, a tablet, a computer**), using only `var(--…)` tokens and the
invented account. It must show:

- the **account-screen Preferences** section with the theme radio group
  (Automatic selected, Estante, Caderno, Palco), each option named with a live
  mini-preview, the selected one marked by a **word** (e.g. *Selected*), and the
  language list beneath it;
- the **not-signed-in** state (first run): the Preferences present and writable,
  a *sign in* affordance in place of the devices/passkeys sections;
- the **signed-in** state: Preferences **plus** the W13 *Signed-in devices* and
  *Passkeys* sections, so the picker is shown coexisting with them;
- the effect of a choice: at least one device column drawn in **Palco** (via the
  board's `theme` tweak) and another in **Caderno**, so the three themes appear
  and the "live preview" is honest; the **automatic** explanation visible;
- continuity with `W13` (the same *Account* surface, lines 144–171).

Registered in `canvas.json`: a `boards["Theme-picker.dc.html"]` entry
(`w:3208, h:1500, x:0`, the next `y` on the 1620 stride after the last board —
`y:28340`, after `W15` at `y:26720`) and appended to `order`. (`Main`,
`ChordBox` and the W-boards are not touched.)

**3. Governing-document deltas (same commit, closer's):**

- `docs/DIRECTION.md` §6 line 537: the theme-picker bullet flipped from *"decided
  (workflow 1) but not drawn"* to a **decided-and-drawn** form citing workflow 1
  and `docs/mockups/Theme-picker.dc.html`, mirroring the instrument (524–528) and
  chord-explorer (529–532) bullets.
- `docs/workflows/01-first-run.md` §Language (lines 90–92) / §Theme (lines
  99–100): the phrase *"in the header"* / *"from the same place as the
  language"* clarified to name the place — the account screen's Preferences,
  reached from the header — so the constitution says where the picker is.
- `docs/workflows/13-new-device.md` §The account screen (lines 68–73): a
  **Preferences** bullet added (theme and language, present before sign-in),
  alongside the existing devices and passkeys bullets.
- **No `docs/DIRECTION.md` §7 item and no new workflow document** — the theme is
  decided in workflow 1; this task draws it and places it, it does not add a
  workflow (see Decisions). This is the one way the task differs from
  `design.explorer`/`design.instruments`, which each added a §7 workflow.

**4. No code tests, and none deferred.** The `.tji` `Tests:` clause is honoured
by the design deliverable. The tests for the picker **as built** land in
`account.account_screen` (not this task's, not deferred from it): behavior
(*devices with sign out, passkeys, language and theme; axe*) and e2e-web
(*another device signed out from here; theme and language kept across a reload;
axe*) — [`tasks/70-account.tji`](../../70-account.tji) line 32 — with
`shell.tokens`' unit/behavior/e2e-web tests pinning the rendering of each theme
and of automatic. Naming them here is the handshake, not a deferral.

**5. No deferred WBS follow-up.** A design task with no code seam to build
later; nothing is registered. One product-judgment item (a fast in-header jump
to Palco for a gig, beyond what automatic already gives) is surfaced for human
review (return summary → parking lot), not encoded as a task.

## Decisions

### A board and workflow deltas, not a new workflow document

Unlike `design.explorer` (workflow 16) and `design.instruments` (workflow 15),
which each drew a **new** workflow DIRECTION §6 named as a gap, the theme picker
is already *decided* in workflow 1 — DIRECTION §6 line 537 says so (*"decided
(workflow 1) but not drawn"*). **Chosen:** draw it (a board) and *place* it
(clarify workflow 1 and add a Preferences section to workflow 13), with no new
workflow document and no §7 list item. **Rejected:** a new "workflow 17: the
theme picker" — nothing new is decided, so a new workflow would duplicate
workflow 1 and misrepresent §6; the honest delta is to close line 537 and point
at the existing decision plus the new drawing.

### The picker lives on the account screen, reached from the header — one surface

Workflow 1 says the theme is chosen *"from the same place as the language,"* and
the language *"in the header"*; the `.tji` note and `account.account_screen`
both say the account screen. **Chosen:** one surface — a **Preferences** section
of the account screen (workflow 13), reached from the header's account
affordance — holding both theme and language. This honours *"the same place as
the language,"* matches `account.account_screen`'s bundle of *language and
theme*, and gives automatic + three themes a real home beside devices and
passkeys. The workflow 1 clarification turns *"in the header"* into *"reached
from the header"* (the account affordance opens the surface). **Rejected:** a
separate inline header switcher in addition to the account-screen list — two
controls for one preference that could drift, and more to build for a 0.5d
drawing; the header holds the *entry*, not a second copy of the picker.

### Available before sign-in

**Chosen:** the Preferences section (theme, language) is present and writable
whether or not the user is signed in — preferences live in the local home book
from the first minute (workflow 1 §The home book; DIRECTION §3.2), and the
board draws the not-signed-in state with the picker present and a *sign in*
affordance where devices/passkeys would be. **Rejected:** gating the picker
behind sign-in — it contradicts workflow 1 (the theme and language are
choosable from minute one, before any account) and would make `shell.tokens`'
"chosen theme from the home book" unreachable for a user who never signs in.
`account.account_screen`'s `depends !sign_in` is a build-order sequencing (the
signed-in sections need `sign_in` built first), not a user-facing gate on the
picker.

### Automatic is a first-class, default choice — and the model is three themes

**Chosen:** the picker offers **Automatic, Estante, Caderno, Palco**; Automatic
is selected while the `theme` register is absent, and explained in words (follows
this device: light → Estante, dark → Palco). **Rejected:** a two-way light/dark
toggle (as the `.tji` note's shorthand might suggest) — it would lose Caderno
(a third, light theme) and misrepresent workflow 1, where automatic is one of
four choices and the themes are named directions, not a binary. The device's
light/dark mode is only the input to *automatic*, not the picker's axis; this
also matches `theme.css`, which has no light/dark token and makes Palco the one
dark direction.

### Selected state carried by a word, never colour alone

**Chosen:** the selected theme is marked by a **word + indicator** (e.g.
*Selected* / a check) and every option is named in text, with the live preview
as a secondary cue. **Rejected:** marking the selection by a highlight colour or
by the preview alone — on a *colour* picker that is the sharpest possible
violation of the standing accessibility rule (status by a word, never colour
alone) and would fail axe/WCAG for a colour-blind or high-contrast user. The
board draws the word so `account.account_screen`'s axe test has it to assert.

### A dedicated board, continuing W13 rather than editing it

**Chosen:** a new `docs/mockups/Theme-picker.dc.html` that draws the account
screen's Preferences across the three themes and both auth states, continuing
the *Account* surface drawn in `W13` (lines 144–171) without editing `W13`.
**Rejected:** adding the picker only inside `W13-new-device.dc.html` — a single
device column there cannot show the three themes side by side (the whole point
of a theme picker), and `W13` is the new-device/sign-out focus. This mirrors the
`W16`↔`W02` precedent (`design.explorer` drew continuity with `W02` on a new
board without editing it). `W13`'s text (workflow 13) still gains the Preferences
bullet so the constitution names the section.

## Open questions

(none — all decided.)

One matter is surfaced for the parking lot (human product judgment), not a
blocker and not a WBS task:

- **A fast in-header jump to Palco for a gig** — beyond what *automatic* already
  gives (a dark-mode device shows Palco), a performer might want a one-tap switch
  to Palco without opening the account screen. Whether Estante wants a header
  shortcut in addition to the single Preferences control is a product judgment;
  the picker ships as the one account-screen surface.

## Status

**Done** — 2026-10-13.

- Created `docs/mockups/Theme-picker.dc.html`: two phones, tablet, computer; Preferences section with theme radio group (Automatic/Estante/Caderno/Palco), each option named with a live mini-preview, selected state marked by the word *Selected* + a check; not-signed-in state with a sign-in affordance; signed-in state with W13 devices + passkeys coexisting; columns drawn in Estante, Palco and Caderno to illustrate the three themes live.
- Registered in `docs/mockups/canvas.json`: `boards["Theme-picker.dc.html"]` entry at `y:28340` (1620 stride after W15 at `y:26720`), appended to `order`.
- Edited `docs/DIRECTION.md` §6: theme-picker bullet flipped from *"decided (workflow 1) but not drawn"* to decided-and-drawn, citing workflow 1 and `docs/mockups/Theme-picker.dc.html`.
- Edited `docs/workflows/01-first-run.md` §Language / §Theme: named the place as the account screen's Preferences reached from the header.
- Edited `docs/workflows/13-new-device.md` §The account screen: **Preferences** bullet added (theme and language, present before sign-in).
- No cifra.md changes. No code tests — design deliverable; picker behavior/e2e-web tests land with `account.account_screen` (handshake, not deferral).
