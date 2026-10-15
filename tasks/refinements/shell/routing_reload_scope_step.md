# shell.routing_reload_scope_step — Back after a reload keeps a scope-only history step

## TaskJuggler entry

`tasks/50-shell.tji:78-82`, `task routing_reload_scope_step "Back after a reload keeps a scope-only history step"`:

> Source of debt: shell.routing fixer-3 (tasks/refinements/shell/routing.md).
> After a reload, Back skips history entries from before the reload that
> differ from the current one only in search scope, so on a wide layout one
> Back can skip a scope-only step. Narrow the skip to the case it was added
> for (same song address, a layer dropped by the reload on a phone) so
> scope-only steps are kept. Governing document: DIRECTION section 3.7,
> workflow 2 (Scope delta). Tests: unit (the skip rule); behavior (back after
> a reload under a layer leaves the song, back after a reload keeps a
> scope-only step; axe); e2e-web (the arrange and wizard reload-then-back
> journeys still pass on the three viewports; axe).

## Effort estimate

0.5d.

## Repository

The app only. Nothing lands under `cifra.md/`, and nothing in `service/` or `api/`.

- `app/src/shell/`: a new pure module `reload-step.js` and its `reload-step.test.js`, the wiring in `use-place-history.js`, and new cases in `AppShell.routing.behavior.test.jsx`.
- `e2e/web/tests/routing.spec.js`: two new journeys.

## Inherited dependencies

- `shell.routing` (complete): settled. It built the place/address module (`app/src/shell/place.js`), the history hook (`app/src/shell/use-place-history.js`) and the skip this task narrows. Its Status (`tasks/refinements/shell/routing.md:434`) records the skip as "a reload skips dead same-address steps", and it registered this task (`:440`).
- `shell.routing_rename_across_reload` (complete, not in `depends`): settled. It made `popstate` read an entry through the rename record (`book-renames.js`), and its reload-then-back behavior cases share the helpers this task extends. This task keeps that reading. The skip compares places after the rename, so a fork followed by a reload still skips and resolves as before.

## What this task is

A reload keeps only the address (`bootEntry`, `use-place-history.js:51-61`). The screens open over the place (the editor, arrange, the wizard, history) are steps in the browser's history but not addresses (DIRECTION §3.7). So after a reload under a layer, the entries below the reloaded one can show exactly what is already shown: the same song with no layer. `shell.routing` added a skip for these dead steps: on `popstate`, keep going back. The test for "the same" there is too coarse (`use-place-history.js:179-186`). It compares **addresses** (`urlFromPlace`) and the layers *kept*. A song's address ignores the place's tab and its one-book scope (`place.js:55-61`), and after a reload no layer is open, so every kept list is empty. So any pre-reload entry with the same URL is skipped, including a real step that differs from the current place only in its search scope (`{ tab: 'search', song }` against `{ tab: 'search', book, song }`).

This task narrows the skip to the case it was added for. An entry from before the reload is a dead step only when the reload dropped at least one layer, and the entry is the **same place** as the one the reload landed on, with only layers the reload dropped. The comparison is against the place and layers as they were before the reload, not against the address. Everything else from before a reload is applied as a real step.

## Why it needs to be done

DIRECTION §3.7 promises that the browser's and Android's back "land where the person was". A Back that silently passes over a step breaks that promise. Here it would pass over a scope change: workflow 2 §Scope says the filter is shown in the box and never hidden. The skip compares URLs, so any future change that makes two same-address places differ (a one-book scope set while a song is open on the wide layout, a tab kept under a song) inherits the bug without anyone noticing. Pinning the rule as a pure, tested function ends that. Downstream tasks that add layers or places (the explorer, setlist play, songs.* chrome work) rely on reload-then-back behaving the same way on every layer.

## Inputs / context

- **DIRECTION §3.7**, `docs/DIRECTION.md:475-481`, "The address follows where you are": a reload, a bookmark and back land where the person was. The screens over a place are steps in history but not addresses.
- **Workflow 2 §Scope**, `docs/workflows/02-find-and-play.md:60-67`: a filter is shown in the box while it is on, and it resets at the start of each session, except for a session that starts from a book's address, which opens scoped to that book. (The `.tji` note says "Scope delta". That is the routing task's delta to this section, the book-address exception at L65-67.)
- `app/src/shell/use-place-history.js`:
  - `bootEntry` (`:51-61`) reads `history.state` before the boot effect (`:118-123`) replaces it with `{ place, layers: [], depth }`. That replacement is the only place the pre-reload layers are still visible.
  - `onPopState` (`:156-194`): the current skip is at `:176-190`. `known` (`:174`) is "this session wrote or applied this depth". `kept` (`:167`) is the entry's layers filtered by those open now, so after a reload it is always `[]`. `named` (`:166`) is the entry's own layers.
  - `renamePlace` (`:65-74`) and `resolveBookId` (from `book-renames.js`): the entry's place is renamed before it is compared.
- `app/src/shell/place.js`: `samePlace` (`:79-87`, the tab, the scoped book, the song and the setlist) and `urlFromPlace` (`:55-61`, a song's URL ignores tab and book).
- `app/src/shell/AppShell.jsx`:
  - The place (`:411-417`): `book` is `bookOfScope(scope)` on the search tab.
  - The layers in fixed order (`:418-430`): 'account', 'conflicts', 'songConflict', 'history', 'files', 'newSong', 'editor', 'wizard', 'arrange', 'play', 'explorer'.
  - `applyPlace` (`:461-471`) clears a one-book scope when the applied place has no `book`.
  - The hook is wired at `:491-497`.
- Where the scope-only pair comes from: opening a song from unscoped search gives `{ tab:'search', song }`, and from a one-book scope gives `{ tab:'search', book, song }`. The two have the same URL. With today's UI the shell's scope cannot change while a song is open: the search beside a song on the wide layout is uncontrolled (`SongReading.jsx:565-573`). So the pair arises from history entries written before a reload rather than from a single in-app gesture. That is why the scope-only case is pinned at the behavior level (Decision 4).
- Behavior harness: `app/src/shell/AppShell.routing.behavior.test.jsx`.
  - `traverse` (`:57`), `openSongFromSearch` (`:65`), and `beforeEach` (`:80`), which resets the URL and `sessionStorage` and stubs `matchMedia` to narrow.
  - The existing case *back after a reload under a layer leaves the song, not a dead step* (`:172-194`) simulates a reload with `cleanup()` and a fresh render. jsdom keeps the location and the history stack.
- e2e: `e2e/web/tests/routing.spec.js` (the routing journeys, constants `SONG_URL`, `BOOK_URL`, `EXAMPLE_BOOK`).
  - `e2e/web/lib/journeys.js` `openExampleBook`, `openSongFromSearch` (`:216`), `scopeToBook` (`:237`).
  - `e2e/web/lib/journeys-core.js` `SONG`, `enterArrange` (`:35`), `toPreview` (`:134`). The wizard opens from arrange through **Run the wizard**.
  - Today no arrange or wizard journey goes back after a reload. `arrange.spec.js` and `wizard.spec.js` reload only to check persistence. The journeys the note names are written here.
- Predecessors: `tasks/refinements/shell/routing.md` (Decision 3: a surface is a history step that keeps the place's address), and `tasks/refinements/shell/routing_rename_across_reload.md` (Decision 2: a pure module beside the hook, as `place.js` and `book-renames.js` are).

## Constraints / requirements

- **The address model is unchanged.** `place.js`, the URLs, what pushes and what replaces: this task touches only which pre-reload entries `popstate` skips.
- **The reload still keeps only the address** (DIRECTION §3.7). No layer is reopened by a reload or by `popstate`.
- **Pure rule, injected state.** The decision "is this popped entry a dead step?" is a pure function with no `window`, `history` or React. The hook gathers its inputs.
- **Renames still apply.** The popped entry's place and the pre-reload record's place are both read through the rename record before they are compared. So *back after a fork and a reload lands on the fork* (`AppShell.routing.behavior.test.jsx:298`) and the matching e2e case keep passing.
- **A second reload does not resurrect a dead step.**
  - The first boot writes `layers: []` into the entry it lands on. Read alone, a second reload would see nothing dropped.
  - So the boot carries what the earlier reload dropped forward in the entry's state.
  - Any later write at that depth (a push, or a replace by the person's own action) drops it.
- **Standing rules**:
  - Offline first: no network is involved.
  - Accessibility: the reached screens pass axe at WCAG 2.1 AA.
  - No song text in logs: nothing is logged.
  - Canonical form and no book without an account are untouched; nothing is written to a book.

## Acceptance criteria

### Behavior delivered

1. A reload under one or more layers, followed by Back (in-app or the browser's), leaves the song. Every entry below that is the same place with only layers the reload dropped is passed over, and Back lands on the first real step (search, or the book's songs).
2. After a reload, an entry from before the reload is a real step whenever:
   - it differs from the reloaded place in anything `samePlace` compares (tab, one-book scope, song, setlist), or
   - it names a layer the reload did not drop, or
   - the reload dropped no layer.

   Back lands on it. For a scope-only step, the song stays open with the address unchanged, and the shell's scope follows the entry (`applyPlace`).
3. Once Back has landed on a real step after a reload, the pre-reload record is spent. A later Back onto an earlier entry of the same song (for example song S, then song T, then S under the editor, a reload, Back to T, Back) lands on S rather than skipping it.
4. A reload on an entry that an earlier reload already stripped still skips the same dead steps.

### Implementation

1. **`app/src/shell/reload-step.js`** (new, pure). It exports:
   - `reloadRecord(state)`: what a reload is about to drop, taken from the `history.state` it lands on.
     - It returns `{ place, layers, depth }` when the state is one of ours and its `layers` is non-empty.
     - Otherwise it returns the state's carried `reloaded` record when there is one, and `null` otherwise. That covers no state, not ours, or nothing dropped.
   - `isDeadStep(entry, record, rename)`: `entry` is the popped `{ place, layers, depth }` and `rename` is an id → current id.
     - It is true only when `record` is non-null, `0 < entry.depth < record.depth`, and `samePlace(renamePlace(entry.place), renamePlace(record.place))`.
     - Every kind in the entry's own `layers` must also be in `record.layers`.

   `renamePlace` moves here from the hook (both use it), or is imported from here by the hook.
2. **`use-place-history.js`**:
   - `bootEntry` also returns `reloaded: reloadRecord(history.state)`.
   - The boot effect writes `reloaded` into the entry's state when it is non-null (`{ place, layers: [], depth, reloaded }`), and holds it in a `reloadedRef`.
   - In `onPopState`, the skip at `:176-190` becomes `!known && isDeadStep({ place: state.place, layers: named, depth }, reloadedRef.current, rename)`, and the record is kept across consecutive skips.
   - Applying any entry that is not dead clears `reloadedRef`. So does any push or replace the hook writes.
   - The header comment (`:21-25`, `:32-33`) is updated to say this.

### Tests, by level

**unit**: `app/src/shell/reload-step.test.js`. Pins DIRECTION §3.7, "screens over a place are steps but not addresses", and workflow 2 §Scope. Cases:
- *`reloadRecord`* returns the place and layers of a state with layers. It returns `null` for `null`, a state without `place`, and a state with `layers: []` and no carried record. It returns the carried `reloaded` when the layers are empty.
- *the entry below a reload under the editor is dead*: the same song, `[]` under `['editor']`.
- *an entry naming a dropped layer is dead*: `['arrange']` under `['arrange', 'wizard']`.
- *a scope-only step is kept*: `{ tab:'search', song }` against `{ tab:'search', book, song }`, a layer dropped, not dead. The same holds the other way round.
- *a tab-only step is kept.*
- *another song or a setlist is kept.*
- *a layer the reload did not drop is kept*: an entry with `['history']` under a record with `['editor']`.
- *nothing dropped, nothing dead*: a `null` record.
- *depth bounds*: depth 0 and depth ≥ the record's depth are never dead.
- *a renamed book*: the entry names the old id and the record the new one, and it is dead.

**behavior**: `app/src/shell/AppShell.routing.behavior.test.jsx`. Pins DIRECTION §3.7 and workflow 2 §Scope.
- *back after a reload under a layer leaves the song, not a dead step* (existing, `:172`): unchanged, and it still passes.
- *back after a reload keeps a scope-only step* (new). Before the first render, seed the entries a previous page left: `history.pushState` an unscoped song entry `{ place: { tab:'search', song }, layers: [], depth: 1 }`, then the book-scoped one at the same `SONG_URL` (depth 2).
  - Render, as a reload landing on the second.
  - Emit SHELF/TREE/SOURCE, then click the in-app Back.
  - Assert that the song group is still shown, `location.pathname` is still the song's address, `history.state.depth` is 1, and the scope chip for the book is gone.
  - axe (`checkWcag21aa`) on the result.
  - Seeding `history` is how a behavior test stands for entries written before the page loaded. The e2e lint rules do not apply here.
- *back after a reload under arrange and the wizard leaves the song* (new).
  - Open the song through `openSongFromSearch`, then open arrange and **Run the wizard** (the wizard's entry names `['wizard', 'arrange']`).
  - Reload (`cleanup()`, fresh render, emit SHELF/TREE/SOURCE), then Back.
  - Assert that the pathname is `/`, the song group is gone and the searchbox shows. Both the arrange-only entry and the bare song entry were passed over.
  - axe.
- *after a reload, a same-song step reached past another song is real* (new). Open S, then T, then S, then Edit. Reload, Back (lands on T, `location.pathname` is T's address), then Back again. It lands on S, with S's group shown and the pathname S's address, rather than skipping to search.
- *back after a fork and a reload lands on the fork, not not-here* and *…put-online…* (existing, `:298`, `:304`): unchanged, and they still pass.

**e2e-web**: `e2e/web/tests/routing.spec.js`, on phone, tablet and computer, with axe at WCAG 2.1 AA. It goes through the real UI only. Pins DIRECTION §3.7 and workflow 5 (arrange and the wizard as screens over a song).
- *back after a reload under arrange leaves the song*:
  - `openExampleBook`, `scopeToBook(page, EXAMPLE_BOOK)`, then `openSongFromSearch(page, SONG.search, SONG.title)`. Note the book's URL, then `enterArrange`.
  - `page.reload()`. The song group is visible and the URL matches `SONG_URL`. axe.
  - `page.goBack()`. The URL is the book's, the song group is gone, and `.scope` names the book. axe.
- *back after a reload under the wizard leaves the song*:
  - The same up to `enterArrange`. Then **Run the wizard**, and wait for its first policy button.
  - `page.reload()`, then `page.goBack()`. The URL is the book's, the song group is gone, and `.scope` names the book. axe.

The existing routing journeys stay green: *a song opened, reloaded and still open*, *back from a song to its book*, *back closes the editor before the song*, and *back after a fork and a reload lands on the fork*.

No follow-up is deferred.

## Decisions

1. **Compare places before the reload, not addresses after it.** *Chosen*: the reloaded entry's pre-reload `{ place, layers }` is the reference, and a popped entry is dead only if it is that same place (`samePlace`) with a subset of the dropped layers. That is exactly "a layer the reload dropped set the two apart".

   *Rejected*:
   - (a) Keep the URL comparison and add `samePlace` against the *booted* place. The booted place is re-parsed from the URL, so a song carries the book scope (`placeFromUrl`). The existing case, a song opened from unscoped search, would no longer match its own pre-reload entry. The skip would stop firing on the phone case it exists for.
   - (b) Drop the skip altogether. Back after a reload under a layer would land on an identical screen and seem to do nothing, which is the bug the skip fixed.
2. **The record rides in `history.state` across reloads.** *Chosen*: the boot writes `reloaded` into the entry it lands on, so a second reload before any Back still knows what the first dropped. *Rejected*: `sessionStorage`, as `book-renames.js` does. That record is per entry and would need keying by depth and clearing by hand. `history.state` is already per entry and dies with it.
3. **The record is spent on the first real step or write.** It describes only what the reloaded entry was. Comparing later pops against it would skip a real return to the same song (Acceptance 3). That is a case the old rule got right by comparing with what was shown, and it must not regress.
4. **No e2e for the scope-only step.**
   - Through the real UI, the shell's scope cannot change while a song is open: the beside-song search on the wide layout is uncontrolled (`SongReading.jsx:565-573`).
   - Reaching a scope-only, same-address pair would need injected history, which the e2e lint forbids.
   - So the promise is pinned by the unit rule and the seeded behavior case. The e2e level carries the user-visible journeys the note names: arrange and the wizard, reload and back, on the three viewports.
5. **A pure `reload-step.js` beside the hook.** It follows `place.js` and `book-renames.js` (`routing_rename_across_reload` Decision 2), so the rule the `.tji` asks to unit-test is testable without React or jsdom history.
6. **No design delta.** DIRECTION §3.7 and workflow 2 §Scope already say what Back must do. This task makes the implementation keep that promise.

## Open questions

(none — all decided)

## Status

**Done** — 2026-10-15.

- `app/src/shell/reload-step.js` (new, pure): `reloadRecord` reads what a reload drops from `history.state`; `isDeadStep` is true only for the same place (renames applied) at a depth below the record's, whose layers are all among those dropped. `renamePlace` lives here.
- `app/src/shell/use-place-history.js`: boot writes the `reloaded` record into the entry's state and holds it in a ref; `onPopState` skips only dead steps; the record is spent on the first real step or the next history write. Header comment updated.
- A step that differs only in search scope is now kept after a reload (DIRECTION §3.7, workflow 2 §Scope).
- unit: `app/src/shell/reload-step.test.js`.
- behavior: `app/src/shell/AppShell.routing.behavior.test.jsx` adds the scope-only, arrange-and-wizard and same-song-past-another-song cases, with axe.
- e2e-web: `e2e/web/tests/routing.spec.js` adds the arrange and wizard reload-then-back journeys, with axe.
- No follow-up deferred.
