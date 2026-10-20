# books.share_needs_online — Share on a book only on this device leads to putting it online

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task share_needs_online`
(lines 212-217), in milestone `m3_service` (`tasks/99-milestones.tji:32`).

## Effort estimate

0.5d.

## Repository

The app only: `app/src/books/` (a new `ShareNeedsOnline.jsx`,
`SongSharePanel.jsx`, `ShareSheet.jsx`, `book-display.js`, `BookDetail.jsx`
for the shared refusal wording), `app/src/shell/AppShell.jsx` (the song-share
wiring), `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`, their tests beside
them, and one e2e-web spec under `e2e/web/tests/`. A design delta in
`docs/workflows/10-share.md` (§Sharing a song). Nothing under `cifra.md/`,
`service/` or `api/`.

## Inherited dependencies

- `books.share_people` — **settled** (`complete 100`): the song's Share is
  `SongSharePanel` beside the chart on wide and `ShareSheet` (song mode) on
  narrow, both mounted from `AppShell` (share_people Decision 6); both call
  `useSharing` on mount.
- `books.online` — **settled** (`complete 100`): `PUT_ONLINE` →
  `BOOK_ONLINE {previousBookId, bookId}` / `BOOK_ONLINE_REFUSED {bookId,
  reason}`; the new shelf entry has `role: 'owner'`; *My songs* put online
  also becomes the account's `mySongs` (online Decision 3,
  `app/src/worker/logic.js:2596-2684`).
- Used, already complete: `account.sign_in_two_doors` (the one `SignIn`
  surface, its `onSignedIn`/`onDone`), `account.sign_in` (a signed-in
  device for the e2e), the e2e helpers `writeSongFromScratch`
  (`e2e/web/lib/journeys-account.js:348`), `enableVirtualAuthenticator` and
  `makeAccount` (`e2e/web/lib/journeys.js:138`).

## What this task is

Share is offered on every song (`app/src/songs/SongReading.jsx:596` the
More menu item, `:757` the computer's toolbar button), and both song-share
surfaces ask the service about the book as soon as they open. For a book
only on this device — *My songs* before it goes online, any book made here
— the service has never heard of it: signed out the members call is a 401
and the panel says *Something went wrong. Try again.* (and Try again fails
the same way); signed in it is a 404, *This book isn't available.* This
task makes Share on such a book say what is true — *this book is only on
this device; put it online to invite people* — with the privacy line Put
online carries in the book detail, and offer the way on: **Put online**
right there, or, signed out, **Sign in to put it online** first. Once the
book is online the same surface becomes the owner's ordinary song share,
ready to invite. Nothing is asked of the service until Put online is
pressed.

## Why it needs to be done

A first-time teacher's first Share hits an error with no way forward
(persona exploration 2026-10-19). Workflow 10 shares only books on Estante,
and a new user's songs all start in a local *My songs* (workflow 1
L41-44), so this is the first Share almost every new user presses. It is
an M3 (Estante online) blocker. Downstream, `books.setlist_invitation`
says Share on a setlist in a local book "behaves as
books.share_needs_online": it reuses the component this task builds.

## Inputs / context

- `docs/workflows/10-share.md` §Sharing a song (L165-170, extended by this
  task's delta below), L22-25 (a book on Estante starts private; its owner
  opens it up from *share*), L84-90 (**Where it sits**: song Share is a
  panel on wide, the sheet on a phone).
- `docs/workflows/07-add-a-book.md` §Putting a book online (L127-134): Put
  online, on a local book, creates it on Estante private, never shared by
  default.
- `docs/workflows/13-new-device.md` §Signing in, or making an account
  (L10-50), §A device used before signing in (L222-243: the local *My
  songs* and the *Your two My songs* choice when the account already has
  one).
- DIRECTION §3.3 (no book reachable without an account; at most fifty
  people), and the offline-first rule (nothing waits on the network).
- `app/src/shell/AppShell.jsx:945-953` — `sharingFacts(bookId)` reads
  title, role and owner name from `orderedBooks(shelf)`, which also gives
  each entry's `kind: 'shared' | 'local'` (`app/src/books/book-display.js:161`);
  `:1475-1499` builds `songShare` (SongSharePanel on wide, ShareSheet
  otherwise); `:618-651` `followBookId` on `BOOK_ONLINE` already moves the
  `sharing` state to the adopted service id; `:836-867` the `SignIn` early
  return (the shell's surface state stays underneath, so `onDone` →
  `setSignIn(null)` returns to where the person was); `:283`
  `useAccountStatus` → `{status: 'unknown'|'in'|'out', refresh}`.
- `app/src/books/SongSharePanel.jsx:28-40` — props and the `useSharing`
  call; `isOwner = role === 'owner'`; `:85-88` intro, `SongAddress`,
  `LoadState`.
- `app/src/books/ShareSheet.jsx:72-90` — the same, song mode when
  `songPath`; `:141-142` `SongAddress`; `:196` the `Share {name}` heading.
- `app/src/books/sharing-parts.jsx:23-29` `errorCopy`, `:35-60`
  `useSharing` (loads on mount), `:63-83` `LoadState`.
- `app/src/books/BookDetail.jsx:385-395` the `BOOK_ONLINE` /
  `BOOK_ONLINE_REFUSED` listeners, `:411-414` `putOnline` sends
  `command(CommandKind.PUT_ONLINE, { bookId })`, `:425-434` the refusal
  wording, `:481-495` the local book's Put online card.
- `app/src/i18n/locales/en.js:195-201` — `books.putOnline`,
  `putOnlineBody` (*Only on this device. Putting it online creates it on
  Estante, private: only you can open it, until you invite people to it, at
  most 50.*), `putOnlineQuota`, `putOnlineSignedOut`, `putOnlineOffline`,
  `putOnlineError`; `:279` `sharing.shareTitle`.
- Tests to extend: `app/src/books/SongSharePanel.behavior.test.jsx` (the
  `makeClient(routes)` loopback from `app/src/books/sharing-fixtures.js:18-39`
  records calls and throws on an unknown route),
  `app/src/books/ShareSheet.behavior.test.jsx` (song sheet cases
  `:122-151`), `app/src/books/BookDetail.behavior.test.jsx:90-101`
  (put-online refusal), `app/src/shell/AppShell.routing.behavior.test.jsx:732-835`
  ("AppShell share surfaces"); e2e precedent `e2e/web/tests/share.spec.js:230-246`
  (`shareSong`, the song surface by role `dialog` / `complementary` named
  `Share <song>`).
- Predecessor refinements: `tasks/refinements/books/share.md` (Decision 2,
  the `/i/<token>#<path>` song invitation), `share_people.md` (Decision 6,
  surfaces by mode mounted from AppShell), `online.md` (Decision 4, create
  before push — a refused create changes nothing on the device),
  `tasks/refinements/account/sign_in_two_doors.md` (`onSignedIn` vs
  `onDone`).

## Constraints / requirements

1. **Which books.** "Only on this device" is the shelf entry's kind:
   `orderedBooks(shelf)` `kind === 'local'`. `sharingFacts` gains
   `isLocal`. A hosted book of any role is unchanged. The home book holds no
   songs and is not reached here.
2. **No service call** while the surface shows the local state: neither
   `listMembers` nor `listInvitations` nor `createInvitation`. The
   `useSharing` / `useCreateInvitation` calls move into a child of
   `SongSharePanel` and `ShareSheet` rendered only for a hosted book, so no
   hook runs conditionally.
3. **The words.** Heading *Share {song}* as today (the surface keeps its
   accessible name). Body: *{book} is only on this device. Put it online to
   invite people.* followed by the existing `books.putOnlineBody` privacy
   line. No `SongAddress` — a local book has no address anyone else can
   open. Copy in all four locales.
4. **The way on, by account status** (`useAccountStatus`, passed down from
   AppShell):
   - `in` or `unknown` → a **Put online** button. It sends
     `PUT_ONLINE {bookId}` (the same command BookDetail sends; no new
     Worker path). While it runs the button is disabled and the surface
     says *Putting it online…* (`role="status"`).
   - `out` → a **Sign in to put it online** button opening the one `SignIn`
     surface (`setSignIn({})` — a plain sign-in, no invited lead). On
     `onDone` the shell returns to the open song with the same share
     surface (its state is untouched underneath); account status is
     refreshed by the existing `onSignedIn`, so the surface now offers Put
     online.
   - `BOOK_ONLINE_REFUSED` for this book → the reason in words
     (`role="alert"`), worded by the one function BookDetail also uses
     (below); a `signed_out` refusal also shows the sign-in button.
5. **After Put online.** `BOOK_ONLINE` → `followBookId` moves `sharing` to
   the new id; the shelf entry is `kind: 'shared'`, `role: 'owner'`; the
   surface re-renders as the owner's ordinary song share (invite form on
   wide, the song invite on the sheet) and only then loads members and
   invitations. Nothing else the user was doing changes.
6. **One wording of the refusal.** `BookDetail.jsx:425-434`'s ladder moves
   to `putOnlineFailureKey(reason)` in `app/src/books/book-display.js`
   (returns the i18n key or `null`); BookDetail and `ShareNeedsOnline` both
   call it. The copy itself is unchanged.
7. **Offline first.** Opening Share on a local book offline needs nothing;
   Put online offline is refused with `books.putOnlineOffline` (*You're
   offline. Connect, then put it online.*), as in the book detail.
8. **Accessibility.** React Aria `Button`s; the explanation is text, not
   colour; keyboard path Share → Put online (or Sign in) → the invite form;
   axe WCAG 2.1 AA on the local state of both surfaces.
9. **Reusable.** `ShareNeedsOnline` takes `{ store, bookId, bookTitle,
   accountStatus, onSignIn }` and draws only the body, so
   `books.setlist_invitation` can put it in its setlist Share surface.
10. Test songs are written for the purpose (as `share.spec.js`'s).

## Acceptance criteria

Behavior: Share on a song in a book only on this device, on a phone and on
a wider screen, signed in and signed out, says the book is only on this
device and offers Put online (or Sign in to put it online first); after
Put online the same surface invites people; no service call is made before
Put online. Workflow 10 §Sharing a song records it (the delta below).

Tests, by level:

- **unit:** `app/src/books/book-display.test.js` — `putOnlineFailureKey`:
  `quota`, `signed_out`, `offline`, any other reason → the error key, none
  → `null` (online Decision 4's refusals, worded once).
- **behavior:** `app/src/books/ShareNeedsOnline.behavior.test.jsx` —
  - status `in`: the words (*only on this device*, *Put it online to invite
    people*, the private line) and a Put online button; pressing it sends
    `PUT_ONLINE {bookId}` on the store and shows *Putting it online…*;
  - status `out`: *Sign in to put it online* and no Put online; pressing it
    calls `onSignIn`;
  - `BOOK_ONLINE_REFUSED` `offline` and `signed_out` (the latter also
    showing the sign-in button) worded as in the book detail;
  - axe clean in each state.
- **behavior:** `app/src/books/SongSharePanel.behavior.test.jsx` and
  `app/src/books/ShareSheet.behavior.test.jsx` — a local book (`isLocal`)
  with a `makeClient({})` client: the needs-online body under the
  `Share {song}` heading, no `Song address`, and **zero recorded calls**
  (workflow 10 §Sharing a song: nothing asks Estante before Put online);
  axe clean.
- **behavior:** `app/src/shell/AppShell.routing.behavior.test.jsx`
  ("AppShell share surfaces") — a song in a local book opened, Share
  pressed: the needs-online surface, and no `fetch` to `/api/books/…`; the
  Worker emits `BOOK_ONLINE {previousBookId, bookId}` with a shelf now
  holding the hosted owner entry → the same surface shows the owner's
  invite and fetches members (Constraint 5); signed out, *Sign in to put it
  online* opens the `Sign in or make an account` surface, and closing it
  returns to the song with the surface still open (Constraint 4).
- **behavior:** `app/src/books/BookDetail.behavior.test.jsx` — the existing
  put-online refusal case (:90-101) stays green through
  `putOnlineFailureKey`.
- **e2e-web:** `e2e/web/tests/share-needs-online.spec.js` — on phone,
  tablet and computer: `writeSongFromScratch` (signed out, a song written
  for the test into *My songs*); open it, Share (toolbar or More, as
  `share.spec.js` `shareSong`) → the surface says *only on this device*,
  axe; *Sign in to put it online* → `makeAccount` (virtual authenticator) →
  back on the song with the surface; *Put online* → the surface becomes the
  owner's song invite; create the invitation → the link carries `/i/` and
  `#<path>` of the song; the book's row reads *On Estante · private*.
  Workflow 10 §Sharing a song, workflow 7 §Putting a book online, workflow
  13 §Signing in. Real UI only (`writeSongFromScratch`, `makeAccount` and
  the surface's own buttons).

No e2e-api: the task calls no endpoint it does not already call.

## Decisions

1. **Put online in place, not a jump to the book detail.** The surface
   sends `PUT_ONLINE` itself and stays open; `followBookId` already moves
   it to the new id, so it turns into the ordinary owner share and the
   person goes straight on to inviting — what the note asks for ("leads to
   putting the book online and then inviting"). Alternative: a *Go to the
   book* link to BookDetail's Put online card — two screens away from the
   invite the person wanted, and a Back that lands nowhere near the song.
   The command, events and refusal wording are the existing ones, so no
   new Worker seam.
2. **Sign in, then one more press — no automatic put-online after sign-in.**
   Putting a book online publishes it to Estante (privately), a step the
   person should take with its own press after reading what it does. And
   the `SignIn` surface is an early return in AppShell, so the share
   surface is unmounted while it shows: a refusal fired during sign-in
   would have nowhere to be worded. Alternative: continue with `PUT_ONLINE`
   from `onSignedIn` as the invitation does with `openByLink` — rejected
   for both reasons; the invitation's continuation is the acceptance the
   person already asked for, Put online is not. Signing into an account
   that already has a *My songs* may raise *Your two My songs* (workflow 13
   §A device used before signing in); that surface is unchanged and the
   share surface is there behind it.
3. **Share stays offered on a local book's song.** Hiding it would leave a
   new user no clue that sharing exists or how to reach it; the note asks
   that Share say so in words. Alternative: hide or disable Share until the
   book is online — rejected.
4. **`unknown` account status offers Put online.** The probe can be
   pending or offline; the Worker's refusal (`signed_out` → the sign-in
   button, `offline` → the offline line) words the truth when the press is
   made. Alternative: wait for the probe — makes the surface wait on the
   network.
5. **The refusal wording moves to one function** (`putOnlineFailureKey`)
   used by BookDetail and the new body, rather than a copy in each — two
   call sites, and the same words in both places.
6. **No board change.** The note scopes no board; the surface reuses the
   song share's frame and the book detail's Put online copy, and the
   workflow 10 delta words the state.

### Design delta

`docs/workflows/10-share.md` §Sharing a song — a new paragraph: Share on a
song in a book only on this device says so in words, offers Put online
(signed out: Sign in to put it online first, back to the same panel), asks
Estante nothing until Put online, and becomes the owner's ordinary song
share once the book is online. Written with this refinement; rides in the
closer's commit.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-20.

- `app/src/books/ShareNeedsOnline.jsx` (new): the needs-online body, `{ store, bookId, bookTitle, accountStatus, onSignIn }` — Put online / Sign in to put it online, "Putting it online…" status, refusal alert; reusable by `books.setlist_invitation`.
- `app/src/books/SongSharePanel.jsx`, `app/src/books/ShareSheet.jsx`: the `useSharing` calls moved into a child rendered only for a hosted book, so a local book makes no service call.
- `app/src/books/book-display.js`, `app/src/books/BookDetail.jsx`: the refusal wording is one function, `putOnlineFailureKey`, used by both.
- `app/src/shell/AppShell.jsx`: `sharingFacts` gains `isLocal`; account status and sign-in passed to the share surfaces; `BOOK_ONLINE` turns the surface into the owner's song share.
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`: new `sharing.needsOnline*` strings.
- `docs/workflows/10-share.md` §Sharing a song: the local-book paragraph.
- Tests: unit `app/src/books/book-display.test.js`; behavior `ShareNeedsOnline.behavior.test.jsx` (new), `SongSharePanel`/`ShareSheet` behavior (zero calls), `app/src/shell/AppShell.routing.behavior.test.jsx`; e2e-web `e2e/web/tests/share-needs-online.spec.js` on phone, tablet and computer.
- Deviation: a Books row for an owned book reads "On Estante · can save"; the e2e checks the row for "On Estante" and the book detail for "On Estante · private". A book missing from the shelf counts as local for song Share (the gap before `BOOK_ONLINE`).

