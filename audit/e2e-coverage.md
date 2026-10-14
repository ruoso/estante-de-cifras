# E2E coverage audit: are the workflows covered by pure end-to-end journeys?

Scope: `e2e/web/tests/*.spec.js` (40 specs, Playwright against the compose stack), their helpers
(`e2e/web/lib/*`, `e2e/web/fixtures/*`), checked against `docs/workflows/01–17`. `e2e/api/*` is
API-contract coverage (no browser, no UI), so it does not count as a journey here. See §4.6.

Read-only audit. No app or test code was changed.

## What "pure" means here

| Verdict | Meaning |
|---|---|
| **Pure** | Starts at `/`, drives the real UI, and gets state only from real user actions, the real service, real git over HTTP, or real mail. Platform emulation is allowed and noted: `context.setOffline`, the CDP virtual WebAuthn authenticator, `emulateMedia`, Playwright `locale`, `setInputFiles` on the real file input, `grantPermissions`. |
| **Server-seeded** | Pure UI, but a precondition is written straight into Postgres through `e2e/web/lib/db.js`. This is acceptable only when no UI path exists. |
| **Impure** | Does at least one of these: boots into or navigates to a `#dev/*` mount; runs JS in the page (`page.evaluate` / `addInitScript`) to change app or runtime state (synthetic events, `location.hash`, `navigator.*` stubs, window globals); rewrites traffic with `route`; or calls real API endpoints with `page.request` to create state that the UI could create. |

Some helpers are acceptable and are not counted against a spec:

- `page.request.get('/api/books')` only reads a book's `gitUrl`. It changes no state.
- `page.evaluate` / `locator.evaluate` that only reads values: computed style, overflow, an a11y token walk.
- A Node `git` CLI that clones and pushes over the stack's smart-HTTP using the owner's own session cookie. It stands in for a second device or person doing real git through the server.

---

## 1. Per-spec table

| Spec | Workflows | Entry | Injection / mocking found (file:line) | Verdict |
|---|---|---|---|---|
| a11y-chart | (chart a11y), W02 | `#dev/chart` | `#dev/chart` mount `a11y-chart.spec.js:47,75`. The `locator.evaluate` at `:28` only reads. | **Impure** (dev mount) |
| account-screen | W01 lang/theme, W13 | `/` | `seedAccount` (SQL) `:130` via `lib/db.js:28`. CDP WebAuthn `:35-62`, plus a second `usb` authenticator `:188` (platform). Test 1 (`:97`) and test 3 (`:168`) are pure. | **Server-seeded** (test 2) |
| account-sign-in | W07 §Signing in, W13 | `/` | `seedAccount` `:94`. CDP WebAuthn `:39-53`. Test 1 (`:68`) is pure. | **Server-seeded** (test 2) |
| add-by-link | W01 Invited, W07 Mine, W10 | `/` | `seedAccount` `:137,203`. `fillBookToCapacity` (SQL) `:149`. **API shortcuts:** `POST /api/books` `:83`, `POST …/invitations` `:117`, `DELETE …/invitations/:id` `:123`, all of which the Share dialog does in the UI. CDP `:34-48`. | **Impure** (API + SQL seeding) |
| app-loads | shell | `/` | none | **Pure** |
| arrange | W05 | `/` | `setOffline` via `runOffline` `:151` | **Pure** |
| axe-fixture | harness self-test | `/` + `setContent` | `page.setContent(violation.html)` `:33`. This tests the harness, not a workflow. | Impure, but N/A (harness) |
| books | W07 | `/` | none | **Pure** |
| chart | (chart layout) | `#dev/chart` | `#dev/chart` `:28`. Read-only evaluates `:40,45`. | **Impure** (dev mount) |
| conflicts | W09, W08 | `/` → `#dev/*` | `#dev/editor` `:157,324`. `#dev/reading` `:403`. git CLI second writer `:113-152,303-345`. CDP `:39-52`. | **Impure** (dev mounts) |
| edit-in-place | W08, W04, W06 | `/` (real nav via *Files in X*, `:158-164`) | **Synthetic `online` event** `page.evaluate(() => window.dispatchEvent(new Event('online')))` `:169`, used at `:268`. git CLI `:184-238`. CDP `:78-92`. | **Impure** (one injected event) |
| editor | W03, W04 | `/` → `#dev/editor` | `#dev/editor` `:18,28,51,73,112,149`. Clipboard written by `page.evaluate(navigator.clipboard.writeText)` `:79`. | **Impure** |
| explorer | W16, W15 | `/` | `setOffline` `:83,102` | **Pure** |
| file-view | W14, W03, W06 | `/` → `#dev/files` | `#dev/files` `:20,99,153,189` | **Impure** (dev mount) |
| first-run | W01, W02 | `/` | `setOffline` via `runOffline` `:108` | **Pure** |
| history | W06, W04 | `/` → `#dev/editor`, `#dev/history` | `#dev/editor` `:23,59,107`. `#dev/history` `:24,83,111,142`. | **Impure** |
| i18n | W01 Language | `/` | **`navigator.languages` overridden** with `addInitScript` `:37-39`. Playwright `locale` `:31` is platform emulation and is probably enough on its own. | **Impure** (navigator override) |
| instruments | W15 | `/` | none | **Pure** |
| leaving | W17 | `/` | `seedAccount` `:57`. CDP `:27-40`. `setOffline` `:124`. Test 2 (`:111`) is pure. | **Server-seeded** (test 1) |
| lost-access | W08, W10 | `/` → `#dev/editor` | **API shortcuts:** `POST …/invitations` `:203-207`, `GET …/members` + `DELETE …/members/:id` `:228-236`, which the Share dialog does in the UI. `#dev/editor` `:154`, used at `:240`. git CLI `:130-148`. CDP `:55-69`. | **Impure** |
| navigation | shell | `/` | none | **Pure** |
| new-song | W03 | `/` | `setOffline` via `runOffline` `:150` | **Pure** |
| notice-surface | W10 §copyright, W08 | `/` | `takeDownBook` (SQL) `:174` via `lib/db.js:46`. This stands in for the operator command, which has no endpoint by design. git CLI `:131-149`. CDP `:56-70`. | **Server-seeded** (acceptable) |
| offline | shell/W08 | `/` | `setOffline` `:18` | **Pure** |
| online | W07 | `/` | CDP `:18-32`. Download event. | **Pure** |
| portal | shell | `/` | read-only `evaluate` `:29` | **Pure** |
| pwa | shell (update) | `/` | **`context.route('**/sw.js')` rewrites the body** `:102-106`. **Window global** `__estanteNotReloaded` `:112-114,137`. **`reg.update()`** via evaluate `:118-121`. Fetch from the page `:80-83`. | **Impure** (route rewrite; arguably unavoidable to fake a deploy) |
| read-in-place | W08, W06 | `/` | **Synthetic `online` event** `:217`, used at `:341,391`. git CLI `:247-307`. CDP `:125-139`. Test 3 (`:408`) is pure. | **Impure** (tests 1–2) |
| reading | W02 | `/` | `setOffline` `:125` | **Pure** |
| restore-part | W06 | `/` → `#dev/editor`, `#dev/history` | `:19-20,137,148,157,197,204` | **Impure** |
| save-sheet | W04 | `/` → `#dev/editor` | `#dev/editor` `:20,34,191`. **`location.hash` set via `page.evaluate`** `:43-45`, used at `:49,134`. | **Impure** |
| search | W02, W12 | `/` | `setOffline` `:104` | **Pure** |
| setlist-play | W12, W08 | `/` → `#dev/files` | `#dev/files` `:107`. **`navigator.wakeLock` stubbed with window globals** `:159-176,183,188`. **Synthetic `online` event** `:358`, used at `:382`. git CLI `:304-339`. CDP `:219-233`. | **Impure** |
| setlists | W12, W14 | `/` (tests 1–4), `#dev/files` (test 5) | `#dev/files` `:208`. Tests `:59,95,123,149` are pure. | **Impure** (test 5) |
| share | W10, W01, W08, W04 | `/` → `#dev/editor` | `#dev/editor` `:148`, used at `:183,255,260`. git CLI `:125-143`. CDP `:50-64`. The invite→join prefix `:208-248` is pure. | **Impure** |
| sign-out | W13 | `/` → `#dev/editor` | `#dev/editor` `:36-37`. **`location.hash` set via `page.evaluate`** `:149-153`, used at `:202,210,244,249`. `setOffline` `:199`. git CLI `:104-138`. | **Impure** |
| sync-states | W08 | `/` | none | **Pure** |
| theme | W01 | `/` | `emulateMedia` `:30,40` | **Pure** |
| upload | W07 | `/` | `setInputFiles` on the real picker `:35` | **Pure** |
| wizard | W05 | `/` | `setOffline` `:133` | **Pure** |

**Totals (40 specs):** 17 pure · 4 server-seeded only · 19 impure (one of them, axe-fixture, is a harness self-test).

- **Pure (17):** app-loads, arrange, books, explorer, first-run, instruments, navigation, new-song, offline, online, portal, reading, search, sync-states, theme, upload, wizard.
- **Server-seeded only (4):** account-screen, account-sign-in, leaving, notice-surface.
- **Impure (19):** a11y-chart, add-by-link, axe-fixture, chart, conflicts, edit-in-place, editor, file-view, history, i18n, lost-access, pwa, read-in-place, restore-part, save-sheet, setlist-play, setlists, share, sign-out.

---

## 2. Per-workflow matrix

Legend:

- ✅ a pure test covers the journey end to end.
- ⚠️S covered only with server-side seeding.
- ❌I covered only impurely. The note says what is injected.
- ❌ no coverage at all.
- 🔒 blocked by an incomplete task or missing UI.

### W01 First run

| # | Journey | Coverage |
|---|---|---|
| 1.1 | Cold: empty shelf shows the four ways in | ✅ first-run.spec:62 |
| 1.2 | Open the example book; it is searchable and survives an offline reload | ✅ first-run.spec:84 |
| 1.3 | Invited: open the link, make an account with a passkey, book on the shelf with its role | ✅ share.spec:226-248 (the pure prefix of an impure test) |
| 1.4 | Invited from a **song**: the invitation opens on that song after accept | ❌ |
| 1.5 | Dead link (withdrawn or expired) and full book are refused without naming the book | ❌I add-by-link.spec:179,185. The invitation is created and withdrawn through the API (`:117,123`). The book is filled by SQL (`:149`). |
| 1.6 | A non-member opens a plain `/b/<book>` address and gets the "does not open" state | ❌ |
| 1.7 | "Playing on guitar — change?" asked once, persisted | ✅ first-run.spec:119,150 |
| 1.8 | Language: chosen in Preferences, kept across a reload. Browser default. | ✅ account-screen.spec:97 for the chosen language. The browser-default case is only ❌I in i18n.spec:37 (navigator override). |
| 1.9 | Theme: automatic follows the device; chosen theme kept | ✅ theme.spec:25, account-screen.spec:97 |

### W02 Find and play

| # | Journey | Coverage |
|---|---|---|
| 2.1 | App opens on the search box | ✅ search.spec:47 |
| 2.2 | Before typing: recents, then book sections | ❌ |
| 2.3 | A chord typed: explorer row first, then songs | ✅ search.spec:64 |
| 2.4 | Result badges: *voiced for*, *unsaved changes*, *conflict* | ❌ (only the *absence* of "unsaved" is asserted, new-song.spec:80) |
| 2.5 | Scope filter to a book; it resets per session | ❌ (UI exists: `search.scopeToBook`, SearchScreen.jsx:351) |
| 2.6 | Read a song: chart, shapes, full screen | ✅ reading.spec:64 |
| 2.7 | Variation picker in the reading view, remembered | ❌I conflicts.spec:403 (`#dev/reading`) |
| 2.8 | Transpose; remembered per song | ✅ reading.spec:103 |
| 2.9 | While transposed: arrange not offered; a picker choice saves *my shape* | ❌ |
| 2.10 | Offline search, read, explorer | ✅ reading.spec:119, search.spec:101 |

### W03 Write a new song

| # | Journey | Coverage |
|---|---|---|
| 3.1 | Empty shelf → *Write a song* → first save names it in *My songs* | ✅ new-song.spec:58 |
| 3.2 | Search with no match → *Create "query"* | ✅ new-song.spec:89 |
| 3.3 | Book section → *New song in this book* | ✅ new-song.spec:115 |
| 3.4 | File view → *New song*; file named from the title | ❌I file-view.spec:94 (`#dev/files`) |
| 3.5 | Paste a cifra outside a fence → fenced, with Undo | ❌I editor.spec:71 (`#dev/editor?new=1`; clipboard written via `evaluate` `:79`) |
| 3.6 | Editor helpers: template, *Add section*, preview beside the text or a tap away | ❌I editor.spec:58 (preview, `#dev/editor`). *Add section* is ❌. |
| 3.7 | Change the book before the first save; discard a new song | ❌ |
| 3.8 | Offline: a new song written and saved | ✅ new-song.spec:146 |

### W04 Edit and save

🔒 **Product gap:** the reading view's **Edit** button does nothing. AppShell renders `<SongReading>` without `onEdit` (AppShell.jsx:719-730). SongReading defaults `onEdit = () => {}` (SongReading.jsx:117) and wires it to both Edit buttons (`:566,650`). The only real path to edit an existing song is Books → *Files in X* → file (edit-in-place.spec:158-164). No task tracks this.

| # | Journey | Coverage |
|---|---|---|
| 4.1 | Open a song → Edit → typed edit persists across a reload | ❌I editor.spec:33 (`#dev/editor`) |
| 4.2 | Save sheet: what changed and a prefilled note; confirm clears *unsaved* | ❌I save-sheet.spec:73 |
| 4.3 | Save pushes; another device gets it | ❌I share.spec:255-264 (`#dev/editor`) |
| 4.4 | An unreadable voicing line stops the save until it is fixed | ❌I editor.spec:91 |
| 4.5 | *Save all* from a book section makes one commit | ❌I save-sheet.spec:122 (`location.hash` via evaluate) |
| 4.6 | Author name asked on the first save only | ❌I save-sheet.spec:158 |
| 4.7 | *Discard changes* shows what would be lost and reverts | ❌I save-sheet.spec:101 |
| 4.8 | A book you cannot push to: Save offers *make it your own* | ❌ 🔒 books.fork |

### W05 Arrange for an instrument

| # | Journey | Coverage |
|---|---|---|
| 5.1 | Enter arrange; tap a chord; choose a shape (touch and keyboard) | ✅ arrange.spec:61,106 |
| 5.2 | *Only here* warns; enter a shape by hand | ✅ arrange.spec:83 |
| 5.3 | *Choose these for every unchosen chord* | ❌ |
| 5.4 | Wizard: into a new variation, or over this one | ✅ wizard.spec:69,93,128 |
| 5.5 | Add a variation and switch to it | ✅ arrange.spec:122 |
| 5.6 | Arrange edits show as *unsaved*, then save through the sheet or discard, and survive a reload | ❌ (no arrange or wizard test saves or reloads. The "persists" in arrange.spec:146 is not asserted.) |
| 5.7 | Arrange not offered while transposed | ❌ |
| 5.8 | Arrange someone else's song for another tuning; it merges cleanly for both | ❌ |

### W06 History

| # | Journey | Coverage |
|---|---|---|
| 6.1 | Reading → *History* lists the versions | ✅ read-in-place.spec:408 |
| 6.2 | Read a version; *compare with now*; *show the text* | ❌I history.spec:76 (`#dev/history`) |
| 6.3 | Unsaved first entry; restore asks first | ❌I history.spec:98 |
| 6.4 | Restore a whole version as a new version | ❌I history.spec:98,137 |
| 6.5 | Restore one block (section or voicing) | ❌I restore-part.spec:142,191 |
| 6.6 | Merges hidden; a settled conflict listed as *merged, with your resolution* | ❌ |
| 6.7 | History follows a rename | ❌ |
| 6.8 | A deleted song recovered from the file view's history | ❌ (file-view.spec:148 restores a *changed* file, via `#dev/files`) |

### W07 Add a book

| # | Journey | Coverage |
|---|---|---|
| 7.1 | New local book; rename it on the shelf | ✅ books.spec:16 |
| 7.2 | *By link*: paste a link in Add a book | ❌ (UI exists: `books.byLink`, en.js:38-42) |
| 7.3 | *Mine on Estante* re-adds an off-shelf book | ⚠️S add-by-link.spec:194 (`seedAccount` only to sign in by email; a passkey sign-in would make it pure) |
| 7.4 | Put online (private) | ✅ online.spec:61 |
| 7.5 | Download a zip | ✅ online.spec:83 |
| 7.6 | Upload a zip as a new book, or merged (no history: replace per song) | ✅ upload.spec:39,60 |
| 7.7 | Upload with history, unrelated history, committed or uncommitted markers, never-committed edits | ❌ |
| 7.8 | Remove from shelf: device-only book; warns about unsaved or unpushed work and offers a download | ✅ online.spec:102 (device-only). The warnings are ❌. |
| 7.9 | Delete the book as owner (typed name) | ✅ online.spec:92 |

### W08 Sync

| # | Journey | Coverage |
|---|---|---|
| 8.1 | Triggers: open, network back, after save, *Sync now* | ✅ partial: sync-states.spec:82 (*Sync now* on a local, no-op book). Network back is only ❌I (synthetic `online`). |
| 8.2 | Hosted-book shelf states: *N saves waiting*, *offline since*, header mark, cleared | ❌ (task `sync.states_e2e_hosted` is open, 45-sync.tji:29) |
| 8.3 | Clean merge pushed without asking (two devices) | ❌I share.spec:254-264 (`#dev/editor`) |
| 8.4 | A song being read updates in place, notice → history | ❌I read-in-place.spec:309 (synthetic `online` `:341`) |
| 8.5 | Full screen holds the update until exit | ❌I read-in-place.spec:368 (`:391`) |
| 8.6 | Editor with unsaved edits: incoming merged under them | ❌I edit-in-place.spec:240 (`:268`) |
| 8.7 | Push loses a race; retried silently | ❌ |
| 8.8 | Losing access: *no longer shared*, unpushed saves kept, fork or download offered | ❌I lost-access.spec:184 (member removed through the API `:233`; `#dev/editor` `:240`) |
| 8.9 | Home book syncs (preferences follow the account) | ❌ 🔒 service.home_book |

### W09 Conflicts

| # | Journey | Coverage |
|---|---|---|
| 9.1 | Meet one: *needs you*, own version shown, *conflict* badge in search | ❌I conflicts.spec:189 (`#dev/editor` for the owner's colliding edit `:157`; badge never asserted) |
| 9.2 | Keep mine / take theirs, pushed and fetched back | ❌I conflicts.spec:235,247 |
| 9.3 | Edit with markers; save refuses while a marker remains | ❌I conflicts.spec:256 |
| 9.4 | Keep both (voicing → a variation named for them) | ❌I conflicts.spec:371 (`#dev/editor` `:324`, `#dev/reading` `:403`) |
| 9.5 | Abandon the merge | ❌I conflicts.spec:278 |
| 9.6 | Deleted on one side, edited on the other; keep both as two songs | ❌ |
| 9.7 | A non-song file conflict settled in the file view | ❌ |
| 9.8 | Rest of the book carries on; saving there asks to settle first | ❌ |
| 9.9 | A conflict reached from an upload merge | ❌ |

### W10 Share

| # | Journey | Coverage |
|---|---|---|
| 10.1 | Owner invites through the Share UI (role); joiner accepts with a passkey | ✅ share.spec:226-248 (pure prefix) |
| 10.2 | *N of 50*, invitation with who joined, withdraw | ❌I share.spec:268-290 (after the `#dev/editor` steps in the same test) |
| 10.3 | Remove a member (typed confirm); member sees *no longer shared* | ❌I share.spec:293-306; lost-access uses the API |
| 10.4 | Lower a role to reader (*Make reader*) | ❌ (UI exists: en.js:195-197) |
| 10.5 | A reader cannot save; offered a fork | ❌ 🔒 books.fork |
| 10.6 | Share a song: member gets the address; invitation opens on the song | ❌I share.spec:311-335 |
| 10.7 | Expiry and use limits; full book refused | ❌I add-by-link.spec:185 (API invitation + SQL fill; the fill is legitimately server-side) |
| 10.8 | Copyright takedown: reason shown on the book | ⚠️S notice-surface.spec:157 (acceptable: an operator command, no endpoint by design) |
| 10.9 | Members see owner and editors, not other readers | ❌ |

### W11 Fork (all 🔒: `books.fork` and `sync.fork_follow` are open, and `FORK_BOOK` has no Worker handler)

| # | Journey | Coverage |
|---|---|---|
| 11.1 | Make it my own, deliberately from book management | ❌ 🔒 |
| 11.2 | From Save in a book you cannot save to | ❌ 🔒 |
| 11.3 | After losing access with unpushed saves (only *offered*, lost-access.spec:266-268) | ❌ 🔒 |
| 11.4 | Following the original: *N new saves*, *Bring them in* preview | ❌ 🔒 |
| 11.5 | The original goes away; the fork is untouched | ❌ 🔒 |

### W12 Setlists

| # | Journey | Coverage |
|---|---|---|
| 12.1 | Search finds a setlist, marked; it opens | ✅ search.spec:79 |
| 12.2 | Build: Add to setlist → New setlist, add a second song, key and note, save | ✅ setlists.spec:59 |
| 12.3 | Reorder by drag and by keyboard | ✅ setlists.spec:95,123 |
| 12.4 | A song from another book: *Copy and add* | ✅ setlists.spec:149 |
| 12.5 | Remove an item | ❌ |
| 12.6 | Play through: next and previous, setlist key, skip a missing song, wake lock | ❌I setlist-play.spec:98 (`#dev/files` `:107`); :157 (`navigator.wakeLock` stub) |
| 12.7 | Sync waits while playing | ❌I setlist-play.spec:361 (synthetic `online`) |
| 12.8 | A missing item pointed at a song | ❌I setlists.spec:200 (`#dev/files` `:208`) |
| 12.9 | A rename in the file view updates the setlist links | ❌ |

### W13 A new device

| # | Journey | Coverage |
|---|---|---|
| 13.1 | Second device signs in with a passkey (same ecosystem); the shelf and home book come down | ❌ 🔒 service.home_book → account.new_device |
| 13.2 | Emailed-link sign-in, then *add a passkey* offered | ⚠️S account-sign-in.spec:89 (no UI to set an email; 🔒 account.recovery_email) |
| 13.3 | Device used before sign-in: My songs merge or keep both | ❌ 🔒 account.new_device |
| 13.4 | *Only on your iPhone* for device-only books | ❌ 🔒 account.new_device |
| 13.5 | Account screen: signed-in devices; sign another out | ⚠️S account-screen.spec:124. Not legitimate: two contexts can share one passkey by copying the CDP credential (`WebAuthn.getCredentials`/`addCredential`). |
| 13.6 | Passkeys listed, added, removed | ✅ account-screen.spec:168 |
| 13.7 | Sign out and remove: counts unsaved and unpushed work, offers a download | ❌I sign-out.spec:191 (`#dev/editor` via `location.hash` `:202`) |
| 13.8 | Sign out and keep as local books | ❌I sign-out.spec:236 |

### W14 The file view

| # | Journey | Coverage |
|---|---|---|
| 14.1 | Reach it from Books → *Files in X* | ✅ upload.spec:89; edit-in-place.spec:161 (pure step) |
| 14.2 | New song, raw edit, rename; save N files together | ❌I file-view.spec:94 |
| 14.3 | Delete a file (asked once) | ❌I setlists.spec:212 |
| 14.4 | Create a setlist, a folder, the README | ❌ |
| 14.5 | Statuses: unsaved, new, deleted, conflict | ❌ (only as side-effects in impure specs) |
| 14.6 | Book history: commits (merges marked); restore a file or a deleted file | ❌I file-view.spec:148 (changed file only) |
| 14.7 | Offline rename and save | ❌I file-view.spec:185 |
| 14.8 | *Show the file* from the reading view | ❌ (not implemented: no such affordance in SongReading, and no task) |

### W15 Set up an instrument

| # | Journey | Coverage |
|---|---|---|
| 15.1 | Header chip → roster → add from a preset, a custom tuning, a name | ✅ instruments.spec:20 |
| 15.2 | Switch the instrument in use; reading and explorer shapes re-derive | ✅ for the chip text. The re-derivation is ❌. |
| 15.3 | Voicing rules: change a rule, see the effect | ✅ partial: the panel opens. Changing a rule is ❌. |
| 15.4 | Review *my shapes* on the instrument; remove one | ✅ review (explorer.spec:69-71). Removal is ❌. |
| 15.5 | Remove an instrument (confirmation; falls back to guitar) | ❌ |
| 15.6 | Offline add or switch | ❌ |

### W16 Chord explorer

| # | Journey | Coverage |
|---|---|---|
| 16.1 | Search chord row → explorer, ranked and grouped | ✅ explorer.spec:44 |
| 16.2 | Star a shape; *your shape*; persists | ✅ explorer.spec:44,74 |
| 16.3 | Edit the chord input (A → Am) and re-derive; *back* keeps the query | ✅ for *back* (explorer.spec:65). Editing the input is ❌. |
| 16.4 | Enter a shape by hand in the explorer and star it | ❌ |
| 16.5 | A starred shape becomes the reading fallback (*your shape*) | ❌ |
| 16.6 | Full keyboard path through groups and stars | ❌ |
| 16.7 | Offline explore and star | ✅ explorer.spec:74 |

### W17 Leaving

| # | Journey | Coverage |
|---|---|---|
| 17.1 | Leaving region (signed in only); take your data out downloads the home book | ✅ leaving.spec:111 (passkey, pure) |
| 17.2 | Data-out lists owned and member books; *Download everything* | ❌ |
| 17.3 | Delete the account (typed email) → back to first run | ⚠️S leaving.spec:52 (🔒 account.recovery_email for a passkey-only account) |
| 17.4 | Counted warnings: who loses access; unsaved or unpushed work | ❌ |
| 17.5 | Owned shared book → members see *no longer shared*; member-only books untouched | ❌ |
| 17.6 | Offline: data-out works; delete waits for a connection | ✅ leaving.spec:111 |

### Tally

**136 journeys. 44 have pure coverage. 3 more are covered with acceptable server-side seeding, because no UI path exists: 10.8, 13.2 and 17.3. The remaining 89 have no pure coverage.** The 89 break down as:

- **48 with no e2e coverage at all.** 12 of these are 🔒 blocked or have no UI: W11 ×5, 4.8, 10.5, 8.9, 13.1, 13.3, 13.4, 14.8.
- **41 covered only impurely or by avoidable seeding.** This includes 7.3 and 13.5, which use `seedAccount` although a passkey path exists. Most of the 41 are mechanical to fix (§3 P1).

---

## 3. Prioritised gap list (proposed pure journeys)

### P1: remove the shortcuts (the coverage exists; the injection goes)

1. **W04/W06 Edit → save → history, all from `/`.** Open a song from search → *Edit* → type → Save sheet → reload → History from the toolbar → version, compare with now, show text, restore (whole and block). **Blocker:** the reading-view *Edit* is not wired (AppShell.jsx:719-730). Meanwhile, route through Books → *Files in Example Book* → file → editor, as edit-in-place.spec:158-164 does. This replaces editor, save-sheet, history and restore-part's `#dev/editor` and `#dev/history`.
2. **W08 in-place sync without the synthetic event.** In edit-in-place, read-in-place and setlist-play, replace `window.dispatchEvent(new Event('online'))` with `context.setOffline(true)` followed by `setOffline(false)`. Chromium then fires the real `online` event, and sync-triggers.js:42 listens for it. Alternatively, use *Sync now* in Books. No blocker.
3. **W09 conflicts via real navigation.** The owner's colliding edit goes through *Files in Choros da Ana* → file → editor (not `#dev/editor`, conflicts.spec:157,324). The "keep both" variation check goes through search → open song → variation picker (not `#dev/reading`, `:403`). No blocker.
4. **W10 share/remove through the UI only.** In lost-access and add-by-link, make invitations (role, expiry, use limit), withdraw them, remove a member and lower a role through the Share dialog, not `page.request` (lost-access `:203,233`; add-by-link `:83,117,123`). Do the member's unpushed save through the Files path. No blocker. *Book full* keeps `fillBookToCapacity`, which is genuinely impractical through the UI.
5. **W14 and W12 file view from Books.** Replace `#dev/files` (file-view.spec:99,153,189; setlists.spec:208; setlist-play.spec:107) with Books → *Files in Example Book*. No blocker.
6. **W13 sign-out.** Replace `hashTo('#dev/editor…')` (sign-out.spec:202,244) with Books → Files → song. No blocker.
7. **W13 two devices, one passkey.** In account-screen.spec:124, copy the virtual credential from device A to device B with CDP `WebAuthn.getCredentials`/`addCredential`, instead of `seedAccount` and emailed sign-in. That models a synced passkey, which is platform emulation only. Do the same for add-by-link.spec:194 (*Mine on Estante*) with a plain passkey sign-in.

### P2: new pure journeys with the UI already present

8. **W08 hosted shelf states.** Put a book online → `setOffline(true)` → save twice → Books shows *2 saves waiting* and the header mark → `setOffline(false)` → states clear. Task `sync.states_e2e_hosted` is open and needs nothing else.
9. **W03 paste a cifra (real clipboard).** Type the text into the search box, select it, Ctrl+C, then *Write a song* → Ctrl+V → fenced, with Undo. No `navigator.clipboard` call from `evaluate`. No blocker.
10. **W05 arrange persists.** Arrange → choose a shape → *Done* → Save sheet lists the voicing → reload → the shape is chosen. Also: *Choose these for every unchosen chord*, and arrange hidden while transposed.
11. **W12 rename keeps links, and remove item.** Files → rename a song in a setlist → save → the setlist still opens it. Setlist edit → remove an item → save.
12. **W02 search depth.** Recents after opening songs; scope filter (*Search only in X*) then reload resets it; *unsaved* badge after an edit; *conflict* badge in W09.
13. **W15 and W16 completeness.** Remove an instrument (falls back to guitar); remove a starred shape; switching the instrument changes the reading shapes; edit the explorer's chord input; enter a shape by hand and star it; the starred shape appears as *your shape* in the reading view.
14. **W07 by link and upload variants.** Add a book → *By link* → paste the invitation URL. Upload a zip with history, an unrelated history, or a marked file (needs new fixture zips).
15. **W06 merges and renames in history.** After the W09 settle, the history shows *merged, with your resolution*. After a file-view rename, the song's history still lists the old saves.
16. **W09 remaining.** Deleted vs edited; keep both as two songs; a non-song file conflict in the file view; save blocked while the book needs you.
17. **W01 invited to a song, and the non-member address.** Owner → song → Share → invitation; joiner accepts → lands on the song. A third context opens `/b/<id>` and gets "does not open".
18. **W17 counted warnings and the effect on members.** The owner shares a book with a second context, then deletes the account. The dialog counts "shared with 1 person". The member's shelf shows *no longer shared*. Needs `seedAccount` until recovery-email lands.

### P3: blocked

| Journey | Blocker |
|---|---|
| W11 fork ×5, 4.8, 10.5 | `books.fork`, `sync.fork_follow` (65-books.tji:44, 45-sync.tji:63). FORK_BOOK has no Worker handler. |
| W13 13.1, 13.3, 13.4, and 8.9 home-book sync | `service.home_book` (30-service.tji:96) → `account.new_device` (70-account.tji:22) |
| Pure emailed sign-in (13.2) and delete of a passkey-only account (17.3) | `account.recovery_email` (70-account.tji:49), `service.recovery_email` |
| 14.8 *Show the file* from reading; W04 Edit from reading | No task. The UI is missing or unwired (AppShell.jsx:719-730). **Add tasks.** |
| *Leave this book* | `books.leave`, `service.leave_book` |
| Deep-link reload into a song | `shell.routing` (50-shell.tji:64). This is why specs reach for `#dev/*` after `page.goto`. |

---

## 4. Cross-cutting findings

1. **`#dev/*` is the main leak.** 11 specs navigate to a dev mount after a real start: editor, save-sheet, history, restore-part, file-view, setlists, setlist-play, conflicts, share, lost-access, sign-out. Two more boot straight into one: chart and a11y-chart. Every case except the chart gallery has a real path today: Books → *Files in X* → file → editor; reading → *History*; search → song. Proposal:
   - Add one shared helper `openSongInEditor(page, bookTitle, fileName)` modelled on edit-in-place.spec:158-164, plus `openSongFromSearch` / `openHistoryFromReading`.
   - Add an eslint rule or grep gate that bans `#dev/` in `e2e/web/tests`.
   - Note: `shell.dev_mount_open` (50-shell.tji:88) exists only because e2e reloads dev mounts. It goes away if the specs stop doing that.
2. **The reading view's Edit button is dead** (AppShell.jsx:719-730 vs SongReading.jsx:117,566,650). The dev mounts hid this. A pure W04 test would have caught it. This is the top product finding of the audit.
3. **Synthetic `online` event** (edit-in-place:169, read-in-place:217, setlist-play:358). It bypasses the real trigger path. `context.setOffline(true→false)` exercises the same listener (sync-triggers.js:42) for real.
4. **Seeding helpers copied into each spec.** The following are re-declared per file in 13 specs (share, conflicts, lost-access, notice-surface, sign-out, edit-in-place, read-in-place, setlist-play, online, add-by-link, account-*, leaving):
   - `enableVirtualAuthenticator`, `signInWithPasskey`, `makeLocalBook`, `putBookOnline`, `bookFromApi`, `runGit`, `seedSong`, `reloadAndSync`.
   - The "Open the example book" retry loop: first-run, search, reading, arrange, wizard, setlists, setlist-play, read-in-place.

   Move them to `e2e/web/lib/journeys.js` as real-UI helpers. The pure ones are already pure; the problem is drift. Each spec "fixes" its own copy, and that is where shortcuts creep in.
5. **The git CLI second writer uses the owner's own session cookie.** For example, conflicts.spec:126-145: "Ana" and "Beto" are really the same account. That is acceptable (real git through the server), but it never exercises a *member's* permissions. For W08 and W09, a two-browser-context version (owner plus an editor joined through the Share UI, as in share.spec) is the purer model, and it also covers the role checks.
6. **`page.request` writes** (add-by-link:83,117,123; lost-access:203,233) create real server state but skip UIs that exist (Share dialog: invite, withdraw, remove, make reader). Read-only `GET /api/books` for `gitUrl` is fine.
7. **SQL seeding (`lib/db.js`).**
   - `seedAccount` (db.js:28) is used in account-sign-in, account-screen, add-by-link and leaving. It is legitimately needed only for email sign-in and typed-email deletion until recovery-email lands (blocked). In account-screen and add-by-link it can be dropped (§3 P1 #7).
   - `takeDownBook` (db.js:46) is a legitimate stand-in for the operator CLI.
   - `fillBookToCapacity` (db.js:60) is a legitimate stand-in for a 50-account fill.
8. **Platform stubs.**
   - The `navigator.wakeLock` stub (setlist-play:159-176) and the `navigator.languages` override (i18n:37-39) are the remaining runtime injections.
   - For i18n, the Playwright `locale` option alone probably suffices, since Chromium derives `navigator.languages` from it. Try dropping the init script.
   - The wake-lock test could instead assert the visible "screen kept awake" status, as setlist-play:123 already does.
   - pwa's sw.js `route` rewrite (pwa:102-106) is the one injection that is hard to avoid: it fakes a redeploy.
9. **Weak "persists" assertions.** arrange.spec:146 ("the edit persists to the working copy") and wizard.spec:128 never reload or save. Their titles overclaim. setlists.spec:200 asserts only that the dialog closed, not that the item is fixed.
10. **e2e-api** (`e2e/api/*.test.js`) covers service contracts (sharing, sync, git, admin, account) and seeds through `e2e/api/lib/db.js` in 10 files. It is valuable but not a user journey, so it does not count toward workflow coverage.
