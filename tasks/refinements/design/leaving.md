# Refinement — `design.leaving`

## TaskJuggler

- Task: `design.leaving` — "Workflow 17: leaving".
- Defined in [`tasks/20-design.tji`](../../20-design.tji) (lines 21–25).
- `note`: *"Deleting an account and taking one's data out; what happens to
  books others are members of. DIRECTION §6. Tests: none — design deliverable
  (the workflow document and its board)."*

## Effort estimate

1d (unchanged from the `.tji`). This is a design task: the deliverable is a
workflow document and a mockup board, not code. The budget covers writing
`docs/workflows/17-leaving.md` to the shape of the existing sixteen (its
screens, its edge cases, offline, a *Later* note), drawing the `W17` board on
two phones, a tablet and a computer and registering it in `canvas.json`, and
the DIRECTION §6/§7 (and the one §3.6) deltas that close the gap. The weight
is in the one decision the workflows leave genuinely open — *what happens to a
book whose owner leaves* — which this task settles against the ownership model
of workflow 10; everything else reuses settled seams (per-book delete,
per-book download, the sign-out survey, losing-access on the member's shelf).

## Repository

**estante-de-cifras.** The deliverable is a workflow document, a mockup board
and governing-document deltas, all in this repository:

- `docs/workflows/17-leaving.md` — the new workflow document.
- `docs/mockups/W17-leaving.dc.html` — the board, registered in
  `docs/mockups/canvas.json` (`boards` entry + `order` array).
- `docs/DIRECTION.md` — §6 (retire the open **Leaving** bullet, lines 533–534),
  §7 (list workflow 17, and amend the §7 intro at lines 556–557), and one clause
  in §3.6's API description (lines 364–366) naming account deletion as a server
  capability workflow 17 introduces (see Decisions — the one §3.x touch).

**No `cifra.md:` work.** Leaving is an app-and-service concern (DIRECTION
§3.3, §3.7): it deletes an account, its sessions and passkeys, and the books it
owns, and it hands the user their data as the git repositories they already
hold. It never touches the song format — a downloaded book is the same
cifra.md repository it always was (workflow 7), and the account-deletion
endpoint moves registry rows and bare repositories, not song text. Nothing in
`/home/ruoso/devel/cifra.md` changes.

## Inherited dependencies

The `design` parent task `depends bootstrap.workflows`
([`tasks/20-design.tji`](../../20-design.tji) line 7). `leaving` carries no
further `depends` of its own in the `.tji` (lines 21–25), and needs none: as a
design task it writes down a decision and draws it, and every seam it reasons
about is already decided.

- **Settled.** `bootstrap.workflows` — the workflows are decided (DIRECTION §7,
  [`docs/DIRECTION.md`](../../docs/DIRECTION.md) lines 550–580). Three of them
  already fix the pieces leaving composes: **workflow 10** fixes book ownership
  (one owner per book, who may delete it, members and the fifty-person cap, and
  that *handing ownership is deferred*); **workflow 7** fixes the per-book
  download (a zip of the repository as it is on the device) that *taking your
  data out* is built from; **workflow 8** and **workflow 11** fix what a member
  sees when access ends (*no longer shared with you*, device copy kept, a fork
  or download offered, a fork untouched by the original's deletion).
- **Settled (the surface it joins).** Workflow 13 §The account screen
  ([`docs/workflows/13-new-device.md`](../../../docs/workflows/13-new-device.md)
  lines 68–81) is the screen leaving is reached from — Preferences, Signed-in
  devices (with sign out) and Passkeys — and workflow 13 §Signing out (lines
  83–88) is the nearest precedent: the same question of *what on this device is
  the account's*, asked once more and for the last time.
- **Not a dependency (this is a design task).** The build task
  `account.leaving` ([`tasks/70-account.tji`](../../70-account.tji) lines
  42–47) `depends design.leaving, !account_screen, service.books, books.share`
  and will write the screen, the new `DELETE /api/account` endpoint and its
  cascade, and the tests. This design task hands it a decided workflow and a
  drawn target; it does not wait on those build tasks (they are downstream),
  and because it ships no code it has no code tests of its own to drive.

The downstream consumer that cites this task is `account.leaving` (2d,
[`tasks/70-account.tji`](../../70-account.tji) lines 42–47), *"Workflow 17
built: deleting the account, taking the data out."* Its tests — behavior (*the
steps workflow 17 decides; axe*), e2e-api (*deleting an account against the
stack: its books and sessions gone, books others are members of handled as
decided*) and e2e-web (*taking the data out, then deleting the account; axe*)
— need this workflow's decided screens and states, and in particular the
decided answer to *what happens to books others are members of*, to pin.

## What this task is

Decide and draw **workflow 17: leaving** — how a user takes their data out of
Estante and deletes their account, and what becomes of the books other people
are members of. It settles three things DIRECTION §6 names as an open gap:

1. **Taking your data out** — before (or without) deleting, the user can
   download every book on the account, and the home book, as the git
   repositories they already hold locally (workflow 7's per-book download,
   offered book by book and as *download everything*). This is a local,
   offline-capable operation: the client already has every book cloned.
2. **Deleting the account** — a terminal, confirmed action (type-the-name
   confirm, like a book delete) that removes the account, its sessions and its
   passkeys, deletes the books it **owns** (for everyone), ends its membership
   in books others own, and tears the account's books and home book off this
   device. The deletion itself is a server action and is the one thing in the
   app that waits for a connection; the data-out step does not.
3. **What happens to books others are members of** — a book whose owner leaves
   is **deleted for everyone**: on each member's shelf it becomes *no longer
   shared with you*, the local copy they hold stays and cannot be recalled,
   unpushed saves are kept, and a fork or download is offered — exactly the
   losing-access behaviour of workflows 8, 10 and 11, now triggered by the
   owner's departure. A book the leaver was only a **member** of is untouched
   for its owner and the others; only the leaver's membership ends.

The deliverable is the workflow document (screens and edge cases, in the shape
of the sixteen), the `W17` board, and the DIRECTION deltas that mark the gap
closed.

## Why it needs to be done

DIRECTION §6 lists **Leaving** as the one remaining open design gap — the only
§6 bullet with no workflow number, no mockup and no *decided and drawn* tag:
*"Leaving: deleting an account and taking one's data out, and what happens to
books others are members of."* ([`docs/DIRECTION.md`](../../docs/DIRECTION.md)
lines 533–534). Until it is decided and drawn:

- `account.leaving` ([`tasks/70-account.tji`](../../70-account.tji) lines
  42–47) `depends design.leaving` and cannot build. Its behavior, e2e-api and
  e2e-web tests all turn on *what happens to books others are members of* —
  a decision that lives nowhere today: workflow 10 gives the owner only
  *delete the book* and *remove a member*, and defers *handing ownership*
  (§Later, line 120). Without this task the implementer would have to invent
  that policy, which is a design decision, not an implementation one.
- The first-pass-complete milestone (`milestones.m5_complete`,
  [`tasks/99-milestones.tji`](../../99-milestones.tji) lines 42–45) lists
  `account.leaving` among its dependencies; leaving is part of what that
  milestone delivers, and it is blocked behind this drawing.
- Leaving is also a standing-rule obligation the direction already acknowledges
  (DIRECTION §3.3 lines 208–211: *"a service with users' data in it, which
  brings terms of service, a privacy policy and a way to handle a copyright
  notice"*; §8 line 586 the LGPD note). A user must be able to take their data
  and go; the mechanism has to be decided before it is built.

## Inputs / context

Governing documents (the `.tji` note names DIRECTION §6; the fuller set below
is what it and the workflows settle):

- **DIRECTION §6 Open decisions** —
  [`docs/DIRECTION.md`](../../docs/DIRECTION.md) lines 519–548, the **Leaving**
  bullet at lines 533–534. The open gap this task retires, to the
  *decided-and-drawn* form of the instrument (524–528), chord-explorer
  (529–532), screen-reader (535–542) and theme-picker (543–548) bullets.
- **DIRECTION §7 Workflows** — lines 550–580. The workflow list (currently 1–16)
  and its intro (lines 556–557, *"the design-gap workflows of §6 join them as
  each is drawn — workflows 15 and 16 here"*). Workflow 17 is added.
- **DIRECTION §3.3 The one server** — lines 153–223. The registry
  (lines 184–188): *"Postgres holds accounts, sessions and passkeys, and the
  book registry: each book's owner, its members and their roles, and its
  invitations"*; *"A volume holds one bare git repository per book,
  `/data/books/<id>.git`."* The fifty-people cap and no-anonymous-read rule
  (lines 175–182). No-lock-in by per-book download (lines 213–218: *"any book
  can be downloaded as a zip of its git repository, history and all"*). The
  service refusing a *book deleted* before git starts (§3.6 Git over HTTP,
  lines 341–345).
- **DIRECTION §3.6 The API** — lines 361–376. The **Signing in** bullet
  (364–366: passkeys, emailed links, sign-out, listing/removing devices and
  passkeys, workflow 13) — where account deletion joins as the one §3.x delta.
  The **Books** bullet (367–369: *"deleting one (owner only)"*) and **Sharing**
  bullet (371–373: members listed, re-roled, removed; the fifty cap) are the
  seams the cascade reuses.
- **DIRECTION §3.7 The app** — lines 409–446. The Worker owns git, the working
  copy and the index; the main thread never touches IndexedDB (lines 422–424);
  the app speaks only the HTTP API and the format to the service (§3.6 line 289).
- **Workflow 10 §Roles** —
  [`docs/workflows/10-share.md`](../../../docs/workflows/10-share.md) lines
  63–69: *"Owner: one per book. Shares it, invites, removes people, deletes the
  book. Editor: saves to the book. Reader: reads it, and keeps it on their
  shelf."* §At most fifty people (lines 28–39). §Removing someone (lines 78–85):
  *"It takes effect at their next request to the service. What is on their
  device stays; it cannot be recalled. The book becomes no longer shared with
  you on their shelf … An editor … removed, with saves not yet pushed, is told
  those saves can no longer go to the book, and is offered a fork (workflow 11)
  or the download (workflow 7)."* §Later (lines 117–126): **handing ownership is
  deferred** (line 120).
- **Workflow 11 §When the original goes away** —
  [`docs/workflows/11-fork.md`](../../../docs/workflows/11-fork.md) lines 51–54:
  *"the user removed from it, the book deleted — the fork is untouched. It has
  the whole history up to the last time it followed the original … Following
  ends; nothing else does."* §Ways in (lines 9–16): losing access with unpushed
  saves is a way into a fork.
- **Workflow 8 §Losing access** —
  [`docs/workflows/08-sync.md`](../../../docs/workflows/08-sync.md) lines 65–70:
  *"A request refused because the user is no longer a member turns the book into
  no longer shared with you: readable as it is, never synced again. Saves not
  yet pushed are kept, and the book offers a fork or the download."* §What the
  shelf says (lines 27–39: the per-book states, *no longer shared with you*
  among them). §The home book (lines 72–77).
- **Workflow 7 §Downloading a book** —
  [`docs/workflows/07-add-a-book.md`](../../../docs/workflows/07-add-a-book.md)
  lines 54–62: *"Download, on any book, saves the repository as it is on the
  device: the `.git` directory with the whole history, and the working tree,
  unsaved changes included … The zip is written by the zip writer Explore
  Chords already has."* §The book-management screen (lines 12–32).
- **Workflow 13 §The account screen / §Signing out** —
  [`docs/workflows/13-new-device.md`](../../../docs/workflows/13-new-device.md)
  lines 68–96. The screen leaving joins (68–81); the sign-out question (83–88,
  *remove this account's books from this device* vs *keep them as local
  books*, unsaved/unpushed counted and warned, a device-only book never removed
  without the download offered); §Later (91–96).
- **The API contract, today** — [`api/openapi.yaml`](../../../api/openapi.yaml):
  `deleteBook` `DELETE /api/books/{bookId}` (owner only, 204/403/404, lines
  330–345); `removeMember` `DELETE /api/books/{bookId}/members/{userId}` (owner
  only, line 463); `listMembers` (line 410, the member count for the warning);
  `signOut` (line 211), `revokeSession` (237), `removePasskey` (270).
  **There is no `/api/account` deletion endpoint and no bulk-export endpoint** —
  `account.leaving` adds `DELETE /api/account` with the cascade this workflow
  decides.
- **App seams `account.leaving` reuses** (named so the board is drawn against
  real surfaces): the account screen `app/src/account/AccountScreen.jsx` (a
  *Leaving Estante* region sits below Passkeys, as the current-device sign-out
  control sits in the devices region); the sign-out dialog pattern
  `app/src/account/SignOutDialog.jsx` and its Worker survey
  `app/src/worker/sign-out.js` (`SURVEY_SIGN_OUT` — the per-book unsaved and
  saves-not-pushed counts, reused to warn before deletion); per-book download
  `app/src/books/download-zip.js` + the Worker's `DOWNLOAD_BOOK`; the
  type-the-name confirm pattern the book delete already uses
  ([`tasks/refinements/service/books.md`](../service/books.md), app-side confirm,
  no request body).
- **Mockup conventions** —
  [`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md) (the `.dc.html`
  structure, `support.js`+`theme.css`, the `.board-head`, three `.dev-col`s =
  two phones, a tablet and a computer; root
  `class="est theme-{{theme}} density-{{density}} board"` 3208×1500; only
  `var(--…)` tokens; `<sc-for>`/`<sc-if>` with their hint attributes; real
  `<button>`/`<a>` with `aria-label` on icon-only buttons; invented cast, no
  real lyrics), [`docs/mockups/README.md`](../../../docs/mockups/README.md)
  ("Decisions the drawings carry": every status badge carries a **word, never
  colour alone**), [`docs/mockups/canvas.json`](../../../docs/mockups/canvas.json)
  (workflow boards `w:3208 h:1500 x:0`, stacked on a 1620 `y` stride; the last
  board, `Screen-reader.dc.html`, is at `y:29960`).
- **Sibling design refinements for shape and ritual** —
  [`tasks/refinements/design/explorer.md`](explorer.md),
  [`tasks/refinements/design/instruments.md`](instruments.md),
  [`tasks/refinements/design/theme_picker.md`](theme_picker.md), and the
  design-task convention in [`tasks/refinements/README.md`](../README.md)
  lines 38–45 (a workflow document and a board; DIRECTION §6/§7 updated for the
  gap closed).

## Constraints / requirements

- **The workflows are normative; this task composes and decides the one gap.**
  Taking data out (workflow 7), losing access (workflows 8, 10, 11) and the
  account screen (workflow 13) are settled and drawn verbatim; the single new
  decision is *what happens to a book whose owner leaves*, which is settled
  against workflow 10's ownership model (one owner, delete-the-book the only
  owner-teardown primitive, handing ownership deferred) — see Decisions.
- **Canonical form, and no new format question.** A downloaded book is the
  cifra.md repository as it stands (workflow 7); taking data out moves
  repositories, not song text, and writes nothing non-canonical. No cifra.md
  change. (Noted so the rule is not mis-scoped.)
- **No book without an account — honoured by the teardown, not broken by it.**
  Deleting the account ends every membership and deletes every owned book from
  the server; nothing it owned is left reachable without an account, and no
  book is orphaned into an ownerless, unreachable state (DIRECTION §3.3 lines
  175–182). The fifty-person cap is irrelevant to a leaver except as the member
  count shown in the warning (how many lose access).
- **Offline first, with one honest exception.** Taking your data out is a local
  operation — the client downloads from the clones it already holds — and works
  offline (DIRECTION §3.7). **Deleting the account is a server action** that
  waits for a connection: an account, its sessions and its passkeys live only on
  the server (§3.3), and there is no way to destroy them offline. The workflow
  states this plainly; offline, the data-out step still works and the delete
  action says it needs a connection. This is the same kind of bounded exception
  as sign-in needing the network, not a break of *nothing the user does in a
  song waits on the network*.
- **Component boundary (DIRECTION §3.6–3.7).** The screen is a React/React Aria
  view; the local teardown (removing the account's books and the home book from
  this device) runs in the Worker, which owns git and IndexedDB; the deletion
  is a single `DELETE /api/account` call across the one HTTP contract — the app
  and the service share no code. The data-out downloads are the Worker's
  existing `DOWNLOAD_BOOK`.
- **Accessibility (standing rule), with teeth on a destructive flow.** Every
  interactive part is a React Aria Component with a full keyboard path; axe at
  WCAG 2.1 AA. The destructive action is guarded by a **type-the-name confirm**
  (not colour), its danger carried by a **word** in the label (*Delete my
  account*), and the per-book warnings (who loses access, unsaved/unpushed
  counts) are text, never colour alone. A confirmation that this cannot be
  undone is in words.
- **No song text in logs; no copyrighted words.** The board draws settings and
  book titles, no song text; the service logs request metadata only when the
  endpoint is built (`account.leaving`). The board uses the invented cast — the
  leaver's own account, the band book *Banda do Bairro* (owned, shared), a book
  the leaver only reads (*Choros da Ana*, owned by Ana), and *My songs* — and
  invented member names, never real lyrics or real addresses.
- **No new runtime dependency.** The zip writer, the git Worker, the API client
  and React Aria all already exist; leaving introduces no library. It does
  introduce one **new server endpoint and a cascade** (`DELETE /api/account`),
  which `account.leaving` builds — this task names it as a seam and justifies
  the one §3.6 delta, but writes no code or contract.

## Acceptance criteria

This is a **design task — no code tests** (the `.tji` `Tests:` clause is
*"none — design deliverable (the workflow document and its board)"*).
Acceptance is what the workflow document decides, what the board shows, and the
DIRECTION deltas. The document and board must be concrete enough that
`account.leaving`'s named tests (below) are writable against them.

**1. `docs/workflows/17-leaving.md` exists** (first line `Status: decided`, in
the shape of the sixteen: screens, edge cases, offline, a *Later* note) and
decides:

- **Where leaving lives.** A **Leaving Estante** region at the foot of the
  account screen (workflow 13), reached from the header's account affordance,
  shown only when signed in. *Pins `account.leaving`'s behavior test* (the
  steps are rendered on the account screen).
- **Taking your data out.** A step that lists every book on the account — the
  books the user owns, the books they are a member of, and the **home book** —
  each with a **Download**, plus **Download everything**; built on workflow 7's
  per-book download (the repository as it is on the device, history and working
  tree, offline-capable). *Pins `account.leaving`'s e2e-web* (*taking the data
  out, then deleting the account*).
- **Deleting the account.** A terminal, **type-the-name-confirm** dialog stating
  in words what will happen: the account, its sessions and its passkeys are
  removed; the books the user owns are deleted for everyone; access to books
  others own ends; **this cannot be undone**. *Pins `account.leaving`'s
  behavior test and its axe check* (the confirm, the warnings).
- **The warnings, counted.** Per **owned** book shared with others, *how many
  people will lose access* — *"Banda do Bairro · shared with 12 people — they
  will lose access"* (from `listMembers`); and per book, **unsaved changes and
  saves not yet pushed** that are only on this device (reusing the sign-out
  survey), with the download offered before the terminal step. *Pins the
  behavior test's rendering of the warning states.*
- **What happens to books others are members of.** Decided in words: a book the
  leaver **owns** is deleted for everyone — it becomes *no longer shared with
  you* on each member's shelf (workflow 8), their local copy stays and cannot
  be recalled, unpushed saves are kept, a fork or download is offered, and a
  fork already made is untouched (workflow 11). A book the leaver is only a
  **member** of is untouched for its owner and the others; only the leaver's
  membership ends. *Pins `account.leaving`'s e2e-api* (*its books and sessions
  gone, books others are members of handled as decided*).
- **The cascade and the endpoint, as a seam.** Deleting the account is one
  `DELETE /api/account` call whose server cascade removes the account's
  sessions, passkeys and memberships, withdraws invitations it made, and
  soft-deletes + removes the bare repositories of the books it owns (reusing
  `deleteBook`'s mechanism); then the Worker removes the account's books and the
  home book from this device, and the session ends. The deletion waits for a
  connection; the data-out step does not. *Pins the e2e-api assertions on the
  stack.*
- **Edge cases and offline**, each decided: offline (data-out works, delete
  says it needs a connection); an owned book nobody else shares (deleted, no
  *they lose access* line); a book the leaver only reads (membership ends,
  owner keeps it); unsaved/unpushed work (counted and warned, download offered,
  before the terminal action); the home book (exported with the rest, removed
  on deletion).
- A **Later** note: handing ownership of a book instead of deleting it
  (so a band book outlives its creator — already workflow 10 §Later); a single
  combined archive instead of per-book downloads; leaving a single shared book
  (dropping one membership) without deleting the account; a grace period / undo
  window before the account is truly gone.

**2. `docs/mockups/W17-leaving.dc.html` exists and is registered.** Drawn to
[`docs/mockups/GUIDE.md`](../../../docs/mockups/GUIDE.md) (the `.dc.html`
structure, `support.js`+`theme.css`, the `.board-head` *Workflow 17 · Leaving*,
three `.dev-col`s = **two phones, a tablet, a computer**), using only `var(--…)`
tokens and the invented cast, no real lyrics. It must show:

- the **Leaving Estante** region on the account screen (continuity with the W13
  *Account* surface, below Passkeys);
- the **take-your-data-out** step: the book list (owned, member, and the home
  book) each with *Download*, and *Download everything*;
- the **delete-account** confirm dialog with the *what will happen* text, the
  **per-owned-book member-count warnings** (*shared with N people — they will
  lose access*), the **unsaved/unpushed** counts, the **type-the-name** field,
  and the danger action labelled with a **word** (*Delete my account*);
- the **member's side**: a shelf where a book shows *no longer shared with you*
  because its owner left, the local copy still readable, a fork/download
  offered (continuity with workflow 8's shelf states);
- the **offline** state: the data-out step working, the delete action saying it
  needs a connection;
- status carried by a **word**, never colour alone, throughout.

Registered in `canvas.json`: a `boards["W17-leaving.dc.html"]` entry
(`w:3208, h:1500, x:0`, the next `y` on the 1620 stride after the last board —
**`y:31580`**, after `Screen-reader.dc.html` at `y:29960`) and appended to
`order`. (`Main`, `ChordBox` and the other W-boards are not touched.)

**3. Governing-document deltas (same commit, closer's):**

- `docs/DIRECTION.md` §6 lines 533–534: the **Leaving** bullet flipped from the
  open form to a **decided-and-drawn** form citing workflow 17 and
  `docs/mockups/W17-leaving.dc.html`, mirroring the instrument (524–528),
  chord-explorer (529–532), screen-reader (535–542) and theme-picker (543–548)
  bullets.
- `docs/DIRECTION.md` §7: **workflow 17 — Leaving** added to the list (after 16),
  and the §7 intro (lines 556–557) amended from *"workflows 15 and 16 here"* to
  *"15, 16 and 17 here"*.
- `docs/DIRECTION.md` §3.6 §The API, the **Signing in** bullet (lines 364–366):
  a clause added naming **deleting the account (workflow 17)** beside sign-out
  and device/passkey removal — the one §3.x touch, because leaving adds a
  genuinely new server capability and endpoint (see Decisions).

**4. No code tests, and none deferred.** The `.tji` `Tests:` clause is honoured
by the design deliverable. The tests for leaving **as built** land in
`account.leaving` (not this task's, not deferred from it) — behavior (*the
steps workflow 17 decides; axe*), e2e-api (*deleting an account against the
stack: its books and sessions gone, books others are members of handled as
decided*) and e2e-web (*taking the data out, then deleting the account; axe*),
[`tasks/70-account.tji`](../../70-account.tji) line 46. Naming them here is the
handshake, not a deferral.

**5. No deferred WBS follow-up.** A design task with no code seam to build
later; nothing is registered. Two matters are surfaced for human product
judgment (return summary → parking lot), not encoded as WBS tasks: **handing
ownership** of a book to a successor on leaving (already workflow 10 §Later —
reiterated here, and the chosen *delete-for-everyone* policy is the first-pass
answer in its absence), and a standalone **leave one shared book** verb
(dropping a single membership without deleting the account), which needs its
own small design decision before it is a leaf.

## Decisions

### A workflow document and a board, per the design-area convention

Unlike `design.theme_picker` and `design.screen_reader` (which closed §6
bullets that were decided elsewhere, so added no §7 workflow), leaving is a
genuine journey DIRECTION §6 names without a number — like `design.explorer`
(workflow 16) and `design.instruments` (workflow 15). **Chosen:** a new
`docs/workflows/17-leaving.md` written to the shape of the sixteen, a new
`W17-leaving.dc.html` board, the §6 bullet retired and a §7 item added.
**Rejected:** folding leaving into workflow 13 (new-device/account) — it is a
distinct journey with its own screens, edge cases and a decision no other
workflow carries (the owner-leaves policy), and §6 names it in its own right;
a workflow document is the honest home for it.

### A book whose owner leaves is deleted for everyone

This is the one genuinely open decision (DIRECTION §6 line 533, *"what happens
to books others are members of"*). Workflow 10 gives the owner exactly two
teardown primitives — *delete the book* (for everyone) and *remove a member* —
and **defers handing ownership** to §Later (line 120). **Chosen:** on leaving,
the books the user **owns are deleted for everyone**; each becomes *no longer
shared with you* on members' shelves (workflow 8 §Losing access), the local
copy they hold stays and cannot be recalled, unpushed saves are kept, and a
fork or download is offered — identical to workflow 10 §Removing someone and
workflow 11 §When the original goes away, now triggered by the owner's
departure. A book the leaver only **belongs to** is untouched; only their
membership ends (the registry drops one member; the owner keeps the book).
**Rejected:** (a) **transferring ownership to another member** — this is
workflow 10's explicitly-deferred *handing ownership* (line 120); building it
inside leaving would pull a deferred feature forward, and choosing a successor
automatically (oldest editor? first member?) is a product judgment nobody has
made. (b) **Orphaning the book** (keeping it ownerless on the server) —
contradicts *no book without an account / every book has one owner* (DIRECTION
§3.3, workflow 10 §Roles) and leaves an unreachable, unmanageable repository.
(c) **Blocking deletion while the user owns shared books** — traps a user in an
account they want to leave, which the whole workflow exists to prevent. The
chosen policy is the one the existing ownership model already supports, loses
nothing a member took care to fork or download, and is drawn so the owner sees
the blast radius (*shared with N people — they will lose access*) before
confirming. Handing ownership stays a named *Later* that would soften it.

### Taking your data out is the per-book download, run over every book

**Chosen:** *take your data out* lists every book (owned, member, and the home
book) and downloads each as the git repository it already is on the device
(workflow 7 §Downloading a book), with a *Download everything* convenience;
no new server export endpoint. **Rejected:** a server-side *"export all my
data"* endpoint producing one combined archive — the client already holds every
book as a local clone, so the download is purely local and works offline, and a
server archive would duplicate data the browser has and add a new endpoint for
no gain. A single combined archive is noted as a *Later* nicety over the same
per-book zips, not a blocker.

### Deletion waits for a connection; the data-out step does not

**Chosen:** the data-out step is offline-capable (local clones), and the account
deletion is a server action (`DELETE /api/account`) that needs a connection,
stated plainly in the workflow and drawn as an offline state. **Rejected:** a
queued *delete when back online* — a terminal, irreversible, cross-user action
(it cuts off everyone sharing the owned books) should not fire unattended from a
device that has since gone away; the user confirms it with the network present,
sees it happen, and the session ends. This keeps *offline first* honest: nothing
in a **song** waits on the network; an account-lifecycle action reaching the
server is the bounded exception, as sign-in already is.

### The teardown reuses sign-out's survey and the book-delete confirm

**Chosen:** the warnings reuse the sign-out survey's per-book unsaved and
saves-not-pushed counts (`SURVEY_SIGN_OUT`, `app/src/worker/sign-out.js`) and a
device-only book offers its download first (workflow 13 §Signing out); the
terminal guard is the **type-the-name confirm** the book delete already uses
(app-side, [`tasks/refinements/service/books.md`](../service/books.md)); the
owned-book cascade reuses `deleteBook`'s soft-delete + repo removal. **Rejected:**
a bespoke leaving-only survey or confirm — leaving is the most destructive
action in the app and should feel exactly like the sign-out and book-delete the
user already knows, only final; reuse also keeps `account.leaving` to its 2d.

### The one §3.6 delta, and no openapi or §3.x–§3.7 change here

**Chosen:** amend §3.6's API **Signing in** bullet to name *deleting the
account (workflow 17)*, because leaving adds a genuinely new server capability
and endpoint the constitution's API list should mention. **Rejected:** editing
`api/openapi.yaml` or §3.7 in this task — the contract and the endpoint are
code, written in `account.leaving`; a design task edits DIRECTION and the
workflows only. No §3.7 app-architecture change is needed: the Worker/view/API
boundary is unchanged, the teardown uses the Worker that already owns git and
IndexedDB, and the one new endpoint is an addition to the existing contract,
not a new seam.

## Open questions

(none — all decided.)

Two matters are surfaced for the parking lot (human product judgment), not
blockers and not WBS tasks:

- **Handing ownership on leaving** — letting a departing owner pass a shared
  book (a band book, a class book) to a successor so it outlives them, instead
  of deleting it for everyone. This is workflow 10's deferred *handing
  ownership* (line 120); the chosen *delete-for-everyone* policy is the
  first-pass answer in its absence. Whether leaving should be where handing
  ownership finally lands is a product call.
- **Leaving one shared book without deleting the account** — a member dropping
  a single membership (there is no self-remove endpoint today; removing the
  book from the shelf keeps the membership, so *Mine on Estante* re-offers it).
  A real need, but a separate small design decision, not part of workflow 17.

## Status

**Done** — 2026-10-13.

- Created `docs/workflows/17-leaving.md` (Status: decided; screens and regions on the account screen, taking-your-data-out with per-book and all-at-once downloads, delete-account with type-the-name confirm, per-owned-book member-count and unsaved/unpushed warnings, cascade and endpoint seam as `DELETE /api/account`, edge cases, offline, Later).
- Created `docs/mockups/W17-leaving.dc.html` (3 `.dev-col`s: two phones — Leaving Estante region on account screen, take-your-data-out with offline state; tablet — member's *no longer shared with you* shelf; computer — delete-account confirm dialog with counted warnings, type-the-name field, danger label *Delete my account*).
- Registered `W17-leaving.dc.html` in `docs/mockups/canvas.json` (`boards` entry `y:31580` on the 1620 stride after `Screen-reader.dc.html` at `y:29960`, appended to `order`).
- Edited `docs/DIRECTION.md` §6 (Leaving bullet → decided-and-drawn citing workflow 17 and `W17-leaving.dc.html`), §7 (intro amended from "15 and 16" to "15, 16 and 17"; workflow 17 added to the list), §3.6 Signing-in bullet (clause added naming deleting the account, workflow 17).
- No cifra.md changes (app-and-service concern only; no format change).
