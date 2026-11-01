# shell.one_bar — One bar on every screen; no sidebar

## TaskJuggler entry

[`tasks/50-shell.tji`](../../50-shell.tji), task `shell.one_bar` ("One bar on
every screen; no sidebar"), under `task shell`. It `depends !header_chrome,
!narrow_fit` and sits in `milestones.m5_complete`. The note, verbatim:

> On a tablet and a computer a 340px sidebar holds the header and three
> destination rows — the phone's three tabs — and nothing else (48% of the
> 712px tablet's width); once anything opens, the left pane turns into
> something else (search beside a song, the book's page beside its detail,
> nothing beside a setlist) and the destinations and the account disappear.
> The account button lives only on the three destinations' header; every
> deeper screen draws its own bar without it. Replace the sidebar with one bar
> on every screen, in the phone's format: on the destinations the wordmark,
> the Search · Books · Setlists tabs (tablet and computer) and, at its end, the
> instrument chip, Help and the account; on a deeper screen Back, the title
> and the screen's actions, then the same end. No split panes in the shell: the
> computer reads a song alone (no search rail) and a book's detail takes the
> whole screen. The account says whether someone is signed in. Source: sidebar
> review 2026-11-01 (screenshots of the running app; the design canvas
> "Estante without the sidebar"). Tests: behavior (the tabs in the top bar, no
> split; every bar ends with chip, Help and account; the detail and the
> reading view with no side pane; axe); e2e-web (the destinations reached from
> the top bar on tablet and computer, the account reachable from a deeper
> screen, nothing clipped on the three viewports).

## Decisions

1. **One bar, everywhere.** Every screen draws exactly one bar at its top. The
   destinations' bar is the phone's header row; on a tablet and a computer the
   tabs fold into it (the phone keeps them in its bottom tab bar). A deeper
   screen's bar is its own `.appbar` — Back in the wordmark's place, the title,
   its actions — not a second bar under a global one: two bars cost a 800px
   computer screen ~130px, and the phone's format already works.
2. **Every bar ends the same way** (`BarEnd`, `app/src/shell/HeaderChrome.jsx`):
   the instrument chip (tablet and computer; on the phone the chip stays where
   each screen already put it), Help about the page, then the account. A
   hairline sets a deeper screen's own actions apart from that end. The shell
   lends what the end needs through the `ShellChrome` context; outside the
   shell (a screen's own behavior test) `BarEnd` draws only Help. Two phone
   bars have no room for it beside their title, and move part of it rather
   than cut the title (the narrow-fit check): the editor's Help *and* account
   end its bottom bar, where its Help already was; the chord explorer's chip
   sits beside its chord field, as the reading view's phone chip sits in its
   meta row.
3. **The account is everywhere**, the sign-in and invitation screens included
   (consistency over hiding it on account flows) — except the account screen
   itself. From sign-in or the recovery-confirm page, the button closes that
   surface and opens the account screen, whose not-signed-in card leads back.
   From the editor it is safe: the unsaved edit lives in the working copy, and
   the account screen is a layer whose close returns there.
4. **Signed in or not is drawn and said.** Signed in, the account button is a
   filled circle; signed out, or before the device knows, the outline. The state
   is also its accessible description (*Signed in* / *Not signed in*), never the
   fill alone. Accounts carry no name (`Account` is `{ id }`), so there is no
   initial to show; and a visible *Sign in* label is not used, because the
   button opens the account screen (preferences live there for everyone) and
   its name must stay *Account* (label-in-name).
5. **No split panes in the shell.** The computer's reading view drops the
   search rail (Back returns to search with the query still typed); the chord
   explorer drops its rail (its own chord field is above the results); a
   book's detail is a full screen on every device. Tablet and computer share
   one layout; the computer only fits more actions in the bar
   (`READING_ACTIONS_WIDE_QUERY`). Screens with a master-detail of their own —
   history's versions, the wizard beside arrange's chart, the instruments'
   roster, the account's rail — keep it: those are a screen's layout, not the
   shell's navigation.
6. **A destination's list keeps a measured width** on a computer (~880px,
   centred) instead of stretching rows across the window.
7. **The open setlist, the paused book panel and a book's page** keep where
   they were: the setlist is a deeper screen with its own bar; the paused panel
   and the book's page are the Books destination's content under the top bar,
   Books lit.

## Design delta (rides in this task's commit)

- `docs/mockups/GUIDE.md` — app chrome: no sidebar; one bar per screen; `.split`
  with `.pane.side` only for a screen's own master-detail.
- `docs/workflows/01-first-run.md` §The instrument — the header on a tablet or
  computer is the top bar beside the tabs, not the head of a side rail.
- `docs/workflows/03-write-a-new-song.md` — the editor's width note no longer
  blames the side rail.
- `docs/workflows/07-add-a-book.md` — the detail is a full screen everywhere.
- `docs/workflows/13-new-device.md` §The banner — below the top bar.
- The W-boards still draw the sidebar; the canvas *Estante without the sidebar*
  (claude.ai design canvas, 2026-11-01) draws the decision until the boards are
  refreshed.

## Tests

- behavior: `AppShell.behavior.test.jsx` (tabs in the top bar, no split, the
  detail full screen with the bar's end, the banner under the top bar),
  `AppShell.routing.behavior.test.jsx` (upload preview and setlist without the
  tabs; the reload test seeds the song-over-song stack the rail used to push),
  `SongReading.behavior.test.jsx` (no rail; the chip ends the bar),
  `ChordExplorer.behavior.test.jsx` (one screen, no rail).
- e2e-web: the specs that reached destinations through the rail or asserted
  the reading/detail splits follow the top bar.
