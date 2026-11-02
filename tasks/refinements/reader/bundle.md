# reader.bundle — The device bundle, built with the app

## TaskJuggler entry

[`tasks/85-reader.tji`](../../85-reader.tji), `reader.bundle` (lines 14–18).

## Effort estimate

1.5d.

## Repository

**Not under `cifra.md/`**: the note does not start with `cifra.md:`. The work lands in `app/`:

- `app/src/device/`: new. The entry, the polyfills, the host-API constant, the build function and its tests.
- `app/scripts/build-device.js`: new. The CLI that `npm run build:device` runs.
- `app/vite.device.config.js`: new. The device build's Vite config.
- `app/vite.config.js`: the Workbox options move into `app/src/pwa/workbox.js`.
- `app/package.json`: scripts only.
- `app/src/songs/song-sheet.js`, `app/src/core/voicings.js`: small optional seams (§Decisions 3–4).
- `.gitignore`: one line for the fixture directory.

Nothing in `remarkable/`: that module is `reader.module`'s.

## Inherited dependencies

None in the `.tji`: `reader.bundle` has no `depends`. Everything it composes is already in the tree and complete:

| Seam | Where |
|---|---|
| The song's sheet | `readSongSheet`, `app/src/songs/song-sheet.js:78` (songs.reading) |
| The default-shape cache | `createShapeCache` and `SHAPE_CACHE_SALT`, `app/src/core/shape-cache.js:163`, `:28` |
| The default-shape fill | `fillDefaultShapes`, `app/src/worker/default-shape-fill.js:130` |
| Rows and diagrams | `chartRows`, `app/src/chart/layout.js:339`; `diagramModel`, `app/src/render/diagram.js:41` |
| Setlists | `parseSetlist` (cifra-md); `setlistRows`, `app/src/books/setlist-display.js:75`; `playableItems` and `playKeyOffset`, `app/src/books/setlist-play.js:59`, `:38` |
| The instrument entry | `surfaceInstruments(...).standard`, `app/src/worker/instruments.js:204` |

Settled.

## What this task is

The reMarkable reader never ports the music core. It runs the web app's own code, built into one JavaScript file that a Go host evaluates in goja. This task builds that file:

- **The entry**, `app/src/device/entry.js`, sets `globalThis.estante`, the **host API, version 1**. It composes the existing modules and adds no music of its own:
  - `load(entry, table)`
  - `sheet(text, offset, opts)`
  - `setlist(text, setlistPath, bookPaths)`
  - `misses()`
  - the constant `hostApi`
- **The polyfills**, `app/src/device/polyfills.js`, supply what goja lacks: `structuredClone` as JSON, `TextEncoder`/`TextDecoder`, and `Intl.PluralRules`.
- **`npm run build`** gains `build:device`, which writes:
  - `app/dist/device/bundle.<hash>.js`: one ES2017 IIFE carrying one locale;
  - `app/dist/device/manifest.json`;
  - a test fixture for the reader outside the served tree: the example book's default-shape table, made by the Worker's own `fillDefaultShapes`.
- **The PWA's Workbox config** ignores `device/**`, so browsers never precache the device payload.

## Why it needs to be done

It is the first leaf of M7 (`tasks/99-milestones.tji:58`), and the reader's whole music path stands on it:

- **`reader.engine`** loads `app/dist/device/` in goja. Its integration test reads the example book at twelve keys against this task's fixture with no misses.
- **`reader.play`** calls `setlist`.
- **`reader.missed_shapes`** starts from `misses()`.
- **`reader.payload`** copies `dist/device/` into `/srv/app/device/` and extends the manifest with the QML and the backends (`docs/remarkable-reader.md` §8).

A change to the app's music reaches the reader only through this build (`docs/remarkable-reader.md` §4: "A change to the app's music reaches the reader by rebuilding the bundle").

## Inputs / context

**Governing design: `docs/remarkable-reader.md`.**

- §3.1 (L172–183): `app/src/device/` holds the entry and polyfills as app code, linted and tested with the app. `app/dist/device/` is built by `npm run build`. `remarkable/` loads the bundle as bytes, never as source.
- §4 (L207–233): no port. Rolldown to ES2017. The host-API table. The polyfills the spike found. One locale, not four. The parsed model and the rebuilt shapes stay in memory and are never re-derived.
- §4.1 (L235–249): the table is read under the **bundle's own salt**. The search never runs on the reading path. A miss leaves its place empty and is searched later by the host.
- §4.2: the spike's measurements. Its code is not in the repository; the polyfill list in §4 is all that survives of it, so this refinement specifies the polyfills from §4.
- §8 (L382–405): the manifest shape `{ version, hostApi, salt, bundle: { path, sha256 }, … }`. Its `qml` and `backend` fields belong to `reader.payload`.
- §9 (L407–422): "Unit (JS): the bundle's entry under Node, `app/`, Vitest". The gate runs the app's build before `remarkable/`'s checks.

**Workflows.**

- `docs/workflows/12-setlists.md` §The key (L54–64): the setlist key is a *target* key. When the song has no `key` property, the target is shown as a note instead.
- Workflow 2: the §7.6 order. While transposed, a song's own voicings are suppressed. This is already in `readSongSheet`, L98–109.

**App seams.**

- `readSongSheet({ text, reading, entry, preferences })`, `app/src/songs/song-sheet.js:78–168`: parse → transpose → `resolveSongVoicings` → shapes, unvoiced, status, block notes. It already threads a session cache via the WeakMap `shapeCacheFor`, L57–66.
- `defaultVoicing`, `app/src/core/voicings.js:58–71`:
  - a hit is rebuilt with `fingeringFromFrets`;
  - **a lookup that returns `undefined` is searched** (1–2.5 s a chord on an rM2);
  - `null` means "no shape".
- `resolveSongVoicings`, `app/src/core/voicings.js:176–242`: memoises defaults per symbol, but only within one call (`defaultsBySymbol`, L203). `unvoiceableKeys` is at L246.
- `createShapeCache({ instrument, table, onOffer })`, `app/src/core/shape-cache.js:163`: `lookup`, `offer`, `toTable`. `shapeCacheKey(chord, instrument)` is at L126.
- `fillDefaultShapes({ texts, entry, cacheModel })`, `app/src/worker/default-shape-fill.js:130–163`: returns register writes; `writes[0]` is `{ path: [id, tuning, SHAPE_CACHE_SALT], value: table }`.
- `surfaceInstruments({}).standard`, `app/src/worker/instruments.js:204`: the standard-guitar entry, which is the instrument in use when the home book names none.
- `app/src/i18n/index.js:20–31` imports four locales statically. `render/diagram.js:15` imports `t`, so the entry's graph reaches i18n. `pluralRules` (L97–102) is the only `Intl.PluralRules` use.
- `transpose`, `app/src/core/transpose.js:189`, and `default-shape-fill.js:73` call `structuredClone`.
- The example book is `app/example-book/*.cifra.md` and `a-short-set.setlist.md`. The app loads it through `import.meta.glob` (`app/src/worker/example-book.js:43`), which is Vite-only. The build script reads the files from disk instead.
- Build:
  - `app/package.json` `build: vite build`.
  - `app/vite.config.js:37–61` is VitePWA generateSW, with `globPatterns ['**/*.{js,css,html,svg,png,woff2}']` and no `globIgnores`.
  - Vite 8.3.2 bundles with rolldown 1.2.12, a dependency of Vite and not of the app.
  - The Vitest default environment is jsdom, with `include: ['src/**/*.{test,spec}.{js,jsx}']` (L63–71).
- Gate: `scripts/gate` L143–154 runs the app's `lint`, then `test`, then `build`. So Vitest runs **before** `dist/` exists, and a unit test cannot read `app/dist/device/`.
- Dockerfile: `COPY --from=app /build/app/dist /srv/app` serves all of `dist/`. That is why the fixture stays out of `dist/`.

## Constraints / requirements

**Shared code, not a port.**

- The entry may only compose existing app modules (`readSongSheet`, `chartRows`, `diagramModel`, `setlistRows`, `playableItems`, `playKeyOffset`, `createShapeCache`). It holds no music logic of its own.
- Where a seam is missing it is added to the shared module, so the web app and the reader keep one path.

**No search on the reading path (§4.1).**

- `sheet` must never call `searchFingerings`.
- A chord the table does not hold comes back as a **pending** shape: its place in the strip is kept and drawn empty. It must not be reported as unvoiceable.
- The chord is queued for `misses()`.
- Nothing is offered back to the table by a read.

**Plain data across the host boundary.**

- Every host call takes and returns JSON-shaped values: no `Map`, `Set`, class instance, function or `undefined` in a returned array.
- The Go side reads values out of goja, and `reader.engine` may move them as JSON.
- The **instrument instance and the parsed model never leave the bundle**.
- `sheet` returns diagram models (`diagramModel`), **never SVG**.

**Memory, never re-derived (§4).** One runtime lives as long as the backend:

- the entry keeps each song's parsed model, keyed by its text;
- it keeps each default shape rebuilt from the table, keyed by dialect and symbol;
- `load` clears both, along with the miss queue;
- a pending shape is not memoised, so a later fill is seen on the next read.

**The salt.**

- The manifest's `salt` is `SHAPE_CACHE_SALT` from `app/src/core/shape-cache.js`, imported and never retyped.
- `estante.salt` exposes the same value, so the host can pick the table (§4.1) and cross-check the manifest.

**One locale.**

- The bundle carries English, the source locale and `DEFAULT_LOCALE`.
- The device config resolves `src/i18n/locales/{pt-BR,es-419,it}.js` to an empty module, so `t` falls back to English as it does for any missing key.
- `i18n/index.js` is not edited.

**ES2017, one IIFE.**

- Vite's build API with `build.lib` (`formats: ['iife']`, `name: 'estanteBundle'`) and `build.target: 'es2017'`.
- Everything is inlined: no dynamic import and no external.
- The entry's first import is `./polyfills.js`, so it runs before any module reads a global.

**Polyfills install only what is absent.**

- `installPolyfills(target = globalThis)` installs:
  - `structuredClone` as `JSON.parse(JSON.stringify(v))`;
  - a UTF-8 `TextEncoder`/`TextDecoder` (encode/decode only, `utf-8` label only; anything else throws);
  - `Intl` when absent;
  - `Intl.PluralRules` when absent: English `select(n)` → `'one'` for 1, `'other'` otherwise; ordinal `one`/`two`/`few`/`other` by English rules; `resolvedOptions()`.
- A native implementation is never replaced, so the browser and Node behave exactly as before.

**The PWA never sees the device payload.**

- `globIgnores: ['device/**']` goes in the Workbox options.
- `build:device` runs after `vite build` (which empties `dist/`), so the ignore guards against a reordered build too.

**The fixture is not served.**

- It is written to `app/dist-test/device/example-book.default-shapes.json`, outside `dist/`, so the Dockerfile's `COPY …/dist` never ships it.
- `.gitignore` gains `dist-test/`.

**Standing rules.**

- **No song text in logs**: the build script prints paths and hashes only.
- **Test fixtures** are the example book's own songs, written for the project.
- Accessibility does not apply: no UI.
- Offline first is untouched: the PWA's precache is unchanged apart from the ignore.

## Acceptance criteria

### Behavior delivered

**`app/src/device/host-api.js`** exports `HOST_API = 1`.

**`app/src/device/entry.js`** imports `./polyfills.js` first, then sets `globalThis.estante` to the following.

**Constants:** `hostApi` (1) and `salt` (`SHAPE_CACHE_SALT`).

**`load(entry, table)`**
- `entry` is an instrument entry as the Worker surfaces it, a roster entry or `surfaceInstruments(...).standard`. `table` is a §4.6 table `{ fingerprint, shapes }`, or `null`.
- It makes the session's cache from the table, read-only on the reading path, and clears the memos and the miss queue.
- It returns `{ fingerprint, tuningId, held }`, where `held` is the number of entries taken from the table. A table of another fingerprint is read as absent, so `held` is 0, as `createShapeCache` already does.

**`sheet(text, offset, opts)`**
- `opts` is `{ variation?, preferences?, targetKey? }`.
- `offset` is normalised modulo 12.
- With `targetKey`, the offset is `playKeyOffset(writtenKey, targetKey)`. When that is `null`, the sheet is read at `offset` and carries `keyNote: targetKey` (workflow 12 §The key).
- It returns, as plain data:
  - `title` and `artist` (song properties);
  - `key`: `{ written, status }`, where `status` is `readSongSheet`'s `transposeStatus`, including the first-chord name for a song with no key;
  - `offset` and `transposed`;
  - `rows`: `chartRows` of the transposed model;
  - `shapes`: in strip order, either `{ key, symbol, source, diagram }` (`diagram` = `diagramModel(fingering, { handed })`, with handedness from the preferences as the reading view resolves it) or `{ key, symbol, pending: true }` for a cache miss;
  - `unvoiced`: unvoiceable keys, excluding pending ones;
  - `notes`: the voicing block's notes at the written key (`blockNotes`);
  - `keyNote` (or `null`).
- An unparseable text returns `{ error: 'unreadable' }` and does not throw.

**`setlist(text, setlistPath, bookPaths)`**
- It returns `{ title, items, missing }`.
- `items` is `playableItems(setlistRows(parseSetlist(text), setlistPath, bookPaths))`, each projected to `{ at, number, title, path, key, note }`, where `path` is the book-root path the row resolved to.
- `missing` is the count of rows that are not playable.

**`misses()`**
- It returns the queued misses, `[{ chord, symbol, dialect }]`: `chord` is the §4.6 table key, deduplicated by it; `symbol` and `dialect` are what a later search needs.
- It does not clear the queue. `load` does.

**`app/src/device/polyfills.js`** exports `installPolyfills(target)` and calls it on `globalThis` (§Constraints).

**`app/src/device/build.js`** exports `buildDevice({ outDir, fixtureDir })`, which:
1. runs Vite's `build()` on `app/vite.device.config.js` with `write: false`;
2. writes the IIFE to `outDir/bundle.<first 8 hex of its SHA-256>.js`;
3. writes `outDir/manifest.json` as `{ version, hostApi, salt, bundle: { path, sha256 } }`:
   - `version` is the first 12 hex of the bundle's SHA-256 (§Decisions 6);
   - `path` is relative to the manifest (`bundle.<hash>.js`);
   - `sha256` is the full lowercase hex;
4. writes `fixtureDir/example-book.default-shapes.json` as `{ salt, entry, table, songs }`:
   - `entry` is `surfaceInstruments({}).standard`;
   - `table` is `fillDefaultShapes({ texts, entry, cacheModel: {} })`'s `writes[0].value`, over every `app/example-book/*.cifra.md` read from disk;
   - `songs` is those files' names.

**Scripts and config.**
- `app/scripts/build-device.js` calls `buildDevice({ outDir: 'dist/device', fixtureDir: 'dist-test/device' })` and prints only paths and the hash.
- `app/package.json`:
  - `"build:device": "node scripts/build-device.js"`;
  - `"build": "vite build && npm run build:device"`.
- `app/src/pwa/workbox.js` exports the Workbox options (the current L42–54, plus `globIgnores: ['device/**']`). `app/vite.config.js` imports them, following the `manifest.js` precedent.
- ESLint covers the new files: `build.js`, `scripts/` and `vite.device.config.js` get Node globals.

### Tests it lands with

**unit, entry under Node.** `app/src/device/entry.test.js` (`// @vitest-environment node`). It imports the entry source and drives `globalThis.estante`, with the instrument `surfaceInstruments({}).standard` and the table made in the test by `fillDefaultShapes` over the example book. Cases:

- **Agreement with the reading view, all twelve keys** (§4 "no port"). For each example-book song at offsets 0–11:
  - `rows` deep-equals `chartRows(transpose(parse(text), offset, …))`;
  - each `shapes[i]` has the `key`, `symbol` and `source` of `readSongSheet`'s shapes for the same text, entry and offset;
  - each `diagram` deep-equals `diagramModel` of that fingering;
  - `misses()` is empty (the §9 promise the engine re-checks in goja).
- **Plain data.** `JSON.parse(JSON.stringify(result))` deep-equals the result, for a sheet and for a setlist.
- **No search on the reading path** (§4.1).
  - With `load(entry, null)`: every default-sourced chord of a song comes back `pending: true` and none is in `unvoiced`;
  - `misses()` counts each distinct chord once, even when the chord recurs at another key;
  - the session cache's table is unchanged: no offer.
  - With a table holding all but one chord: exactly that one is pending.
- **Memo.** Two `sheet` calls on one text and offset return equal results, and the second does not re-parse (spied through the `parsed` seam).
- **Target key** (workflow 12 §The key).
  - `sheet(text, 0, { targetKey: 'D' })` on a song written in C reads at +2;
  - on a song with no `key` property it reads at the written key, with `keyNote: 'D'`;
  - with a minor target on a major song, it carries `keyNote`.
- **Setlist** (workflow 12; cifra.md §10.7). `setlist` over `a-short-set.setlist.md` returns its playable items in order, each with its `key` and `note`. A setlist with one item pointing at an absent song has that item left out and `missing: 1`.
- **Load.**
  - `load` returns `held` equal to the table's size;
  - a table of another fingerprint gives `held: 0`;
  - `hostApi` is 1, and `salt` is `SHAPE_CACHE_SALT`.

**unit, polyfills.** `app/src/device/polyfills.test.js`. On a bare object target:
- all four are installed;
- `structuredClone` deep-copies a parsed song and returns a new object;
- `TextEncoder`/`TextDecoder` round-trip `"Ação, coração — ♯♭"` to the same bytes as Node's;
- `Intl.PluralRules('en').select` gives 1 → `one` and 0, 2 → `other`;
- the ordinal rule gives 1/2/3/4/11/22 → `one`/`two`/`few`/`other`/`other`/`two`.

On `globalThis` under Node, the native implementations are left as they are (identity).

**unit, manifest and built bundle.** `app/src/device/build.test.js` (node environment). It calls `buildDevice` into a temporary `outDir` and `fixtureDir`, because the gate runs Vitest before `npm run build`. Cases:

- **The manifest's fields and hash** (§8):
  - exactly the keys `version`, `hostApi`, `salt` and `bundle`;
  - `hostApi === 1`, and `salt === SHAPE_CACHE_SALT`;
  - `bundle.path` matches `/^bundle\.[0-9a-f]{8}\.js$/` and names a file in `outDir`;
  - `bundle.sha256` equals the SHA-256 of that file's bytes, and the file name's hash is its prefix.
- **ES2017.** ESLint's `Linter` (a direct devDependency) parses the bundle with `ecmaVersion: 2017` and `sourceType: 'script'`, with no fatal error.
- **No polyfill missing.** The bundle is evaluated by `vm.runInContext` in a fresh context with `Intl` deleted and no `structuredClone`, `TextEncoder` or `TextDecoder`. Then `estante.load` and `estante.sheet` on an example song answer, with the same rows as the entry test.
- **One locale.** A string present only in `src/i18n/locales/pt-BR.js` (a distinctive translation, chosen by the implementer) does not occur in the bundle. A string from `en.js` used by `render/diagram.js` does.
- **The fixture.** The fixture's `salt` equals `SHAPE_CACHE_SALT`, and its `table` deep-equals `fillDefaultShapes`' output for the example book under the standard entry.

**unit, Workbox config.** `app/src/pwa/workbox.test.js`:
- `globIgnores` contains `device/**`;
- by Node's `path.matchesGlob`, `device/bundle.0123abcd.js` and `device/manifest.json` are ignored, and `assets/index-abc.js` is still matched by `globPatterns` and not ignored.

Levels: the note names unit only, and that is all this task needs. There is no UI, so no behavior level with axe. The goja level is `reader.engine`'s integration test. No e2e level is needed: the payload is not served until `reader.payload`, whose e2e-api pins it.

Deferred work: none. The search for queued misses is already the WBS task `reader.missed_shapes`. It adds the host call that searches a queued miss within `hostApi` 1, since nothing is served before `reader.payload` (§Decisions 5).

## Decisions

1. **Vite's build API with a second config, not rolldown called directly.**
   - Vite 8 *is* rolldown (1.2.12, its dependency), so this is the "rolldown to ES2017" of §4.
   - Rolldown is not in `app/package.json`. Importing a transitive package is fragile, and adding it means a lockfile change over the network (the memory note on npm deps).
   - Vite's `build({ write: false })` returns the bytes to hash, so the content-hashed name and the manifest come from one pass.

2. **`sheet` wraps `readSongSheet` rather than recomposing the chain.**
   - `readSongSheet` is already the one place that composes the sheet for the reading view and the printed book (its header comment).
   - A third composition would drift: the shapes caption, the first-chord key name, and the suppression of voicings while transposed.
   - `sheet` projects its result to plain data and maps fingerings through `diagramModel`.

3. **The reading-path cache is a read-only view, made in the entry; no new core cache mode.**
   - The entry wraps the session's `createShapeCache`: its `lookup` returns `null` where the table returns `undefined`, so `defaultVoicing` takes "no shape" and never searches, and its `offer` is a no-op.
   - The entry then classifies: a chord `resolveSongVoicings` left unresolved whose real lookup was `undefined` is **pending** and queued; one whose real lookup was `null` is unvoiceable.
   - Alternative: a `searchMisses: false` option in `createShapeCache` and `defaultVoicing`. That is a new core flag with one caller. The wrapper uses only the existing `ShapeCache` interface.

4. **Two optional seams in shared modules, for the memo of §4.**
   - `readSongSheet` gains optional `cache` (overriding the WeakMap `shapeCacheFor`), `parsed` (a held parse of `text`) and `defaults`, all passed through.
   - `resolveSongVoicings` gains an optional `defaults` Map that replaces its per-call `defaultsBySymbol`, keyed `` `${dialect}\u0000${symbol}` `` because one chord key can be spelled two ways and a fingering carries its spelling.
   - The entry evicts a pending (`null`) memo entry whenever it would hide a later fill. Callers that pass nothing behave exactly as today, and the existing tests of both modules keep passing unchanged.
   - Alternative: keep the memo in Go. That is impossible, because the rebuilt fingering is a JavaScript value inside goja. `reader.engine` pins the memo through the host calls.

5. **The host API stays at the four calls the note names.**
   - `misses()` hands back enough to search a miss (`chord`, `symbol`, `dialect`) without parsing anything again.
   - The call that searches it and fills the session cache is `reader.missed_shapes`'s: it decides the priority and the scheduling. It adds that call within `hostApi` 1, because `hostApi` only has to change once a payload is served (`reader.payload`), and nothing is served before then.

6. **`version` is the bundle's short hash for now.**
   - §8 does not define `version`.
   - The app's `package.json` version is `0.0.0`, and a build date makes the build non-reproducible.
   - The hash is deterministic and changes exactly when the bundle does. `reader.payload` broadens the manifest to the QML and backends, and with it what `version` covers.

7. **English is the one locale.**
   - It is the app's source and `DEFAULT_LOCALE`.
   - The bundle's strings are the few the music path reaches (diagram labels via `render/diagram.js`); the reader's screen copy is QML's.
   - The other three are dropped by module resolution in the device config, so `i18n/index.js` keeps one shape for both builds.

8. **The fixture lives outside `dist/`.** It goes in `app/dist-test/device/`: the Dockerfile copies all of `dist/` into `/srv/app`, and a test fixture is not part of the site.

9. **The build test builds into a temporary directory.**
   - The gate runs `npm test` before `npm run build`, so a test that read `app/dist/device/` would see a stale build or none.
   - Building inside the test pins the manifest, ES2017, the polyfills and the one locale on every run, at the cost of a few seconds.

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-11-01.

- The device entry and its parts: `app/src/device/entry.js` (host API 1 as `globalThis.estante`: `load`, `sheet`, `setlist`, `misses`, `hostApi`, `salt`), `app/src/device/polyfills.js` (`structuredClone` as JSON, `TextEncoder`/`TextDecoder`, `Intl.PluralRules`), `app/src/device/host-api.js`, `app/src/device/empty-locale.js` (the other three locales resolve to an empty module).
- The build: `app/src/device/build.js` (`buildDevice`), `app/scripts/build-device.js`, `app/vite.device.config.js`; `npm run build` now also runs `build:device` and writes `dist/device/bundle.<hash>.js` (one ES2017 IIFE, English only), `dist/device/manifest.json`, and the example book's default-shape fixture in `dist-test/device/` (ignored in `.gitignore`, outside the served tree).
- Workbox options moved to `app/src/pwa/workbox.js` with `globIgnores: ['device/**']`; `app/vite.config.js` imports them.
- Seams in shared code, callers unchanged: `readSongSheet` takes optional `cache`, `parsed` and `defaults` and exports `instrumentFor` (`app/src/songs/song-sheet.js`); `resolveSongVoicings` takes an optional `defaults` map (`app/src/core/voicings.js`).
- Tests (unit): `app/src/device/entry.test.js`, `polyfills.test.js`, `build.test.js`, `app/src/pwa/workbox.test.js`. ESLint config gains Node globals for the new build files and ignores `dist-test/**`.
- A fixer made `accountMySongsOnline` in `app/src/worker/new-device.behavior.test.js` wait for the remote shelf to name the book, removing a race unrelated to the bundle. The `syncHome` helper's wider ambiguity is in `tasks/parking-lot.md`.
