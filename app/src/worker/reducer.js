// The pure reducer that folds Worker events into the main-thread store's
// state (DIRECTION §3.7 L397-401). State is a map of named slices; a component
// reads the one slice it needs through `useSlice`. The reducer returns the
// *same* reference for every slice an event does not touch, so "only what
// shows it moves" — `useSyncExternalStore`'s `Object.is` bail-out skips the
// re-render of any component whose slice did not change.
//
// Framework-free: no React here. The reducer never puts a non-cloneable value
// into state; it only ever stores what arrived over the wire.

import { EVENT, EventKind } from './protocol.js';

// The slices a component can subscribe to. Both start empty: no connection to
// the Worker's database yet, no persisted meta yet.
export const initialState = {
  // The lifecycle of the Worker's IndexedDB connection, carried as a word
  // (never colour alone): 'idle' | 'ready' | 'error'. `persisted` carries the
  // result of `navigator.storage.persist()` once storage comes up — true
  // (granted) / false (denied) / null (unavailable or not asked yet) — so a
  // later task can nudge toward export when the durable store was denied
  // (DIRECTION §3 L114-115).
  connection: { status: 'idle', error: null, persisted: null },
  // The Worker's persisted `meta` record once it reports it, else null.
  meta: null,
  // The home book's preferences (preferences.json), a flat map of `{value, at}`
  // registers keyed by name — `theme`, `language`, … (home-book-format §4.1).
  // The theme root reads `preferences.theme.value` to resolve the applied theme
  // (shell.tokens). Starts empty: no register until the user chooses, and the
  // producer that reads the home book (storage.preferences_surface) is deferred,
  // so while absent the app's theme is automatic, following the device.
  preferences: {},
  // The home book's shelf (shelf.json), surfaced as `{ books, local }`: two
  // nested maps of `{value, at}` registers — the shared books keyed by book id
  // (each `label`/`link`/`position`), and this device's local-only books (each
  // `title`/`position`), narrowed to the device's namespace (home-book-format
  // §4.2, §7). The search screen reads `shelf.books[id].label.value` to label a
  // book, falling back to the `bookId` when absent (songs.search Decision 6).
  // Starts empty: no shelf until the home book is cloned and read
  // (storage.shelf_surface); while absent every book is labelled by its id.
  shelf: {},
  // The outcome of the last save/discard per book, keyed by `bookId`
  // (storage.working_copy). Each entry carries its status as a word (never
  // colour alone): 'saved' (with `commit` and whether the push landed),
  // 'discarded', or 'refused' (with the refused `path`/`reason` and the first
  // marker `line`/`marker`). A book an event does not touch keeps its exact
  // entry reference, so a view watching one book does not re-render on another's
  // save. Starts empty: nothing saved yet.
  save: {},
  // A song's history (storage.history), keyed by `bookId` then `path`. Each entry
  // is `{ entries, versions: { [commit]: text }, restored }`: `entries` is the
  // filtered, newest-first version list (SONG_LOG), `versions` caches the exact
  // bytes of versions read (VERSION), and `restored` is a monotonic token bumped
  // each time a version is restored into the working copy (RESTORED) so the view
  // can open the save sheet — even on restoring the same version twice. A path an
  // event does not touch keeps its exact reference ("only what shows it moves").
  // Starts empty: no history read yet.
  history: {},
  // The book's whole log for the file view (storage.history), keyed by `bookId`
  // (BOOK_LOG): `{ commits }`, every commit newest first with the files each
  // touched. A book an event does not touch keeps its reference. Starts empty.
  bookLog: {},
  // The book's working tree for the file view (books.file_view), keyed by
  // `bookId` (TREE): `{ entries }`, every allowed file with its working-copy
  // status as a word. A book an event does not touch keeps its reference.
  // Starts empty.
  tree: {},
  // The last song-search query and its ranked results (storage.index,
  // SEARCH_RESULTS): `{ query, results }`, each result `{ bookId, path, title,
  // artist, score, unsaved, voicedFor?, conflict? }`. The whole slice is
  // replaced on each SEARCH_RESULTS and left untouched by every other event, so
  // only the search screen re-renders. `unsaved` is wired from the index now;
  // `voicedFor`/`conflict` are the seam their owning tasks fill (songs.search
  // Decision 7). Starts empty: nothing searched yet.
  search: { query: null, results: [] },
  // The per-book index build state (storage.index, INDEX_STATUS), keyed by
  // `bookId`: 'building' while a book's songs are being indexed, 'ready' once
  // done — carried as a word, so the search screen can say a book is "still
  // loading" rather than looking empty (workflow 2 L159-162). A book an event
  // does not touch keeps its reference. Starts empty: no book indexed yet.
  index: {},
  // The per-book song count (books.row_opens_songs), keyed by `bookId`: the
  // `songs` a `ready` INDEX_STATUS carries — songs only, unsaved included, the
  // number a book's search section shows — so the shelf row and the book's bar
  // say *N songs* (workflow 7 L21-23). A book with no count yet is absent (the
  // row says *still loading*); a `null` status drops the book's entry.
  songCounts: {},
  // The pre-typing browse: every indexed song grouped by book (songs.search,
  // BROWSE_RESULTS): `{ books: [{ bookId, count, songs: [{ path, title,
  // artist, unsaved }] }] }`. A separate slice from `search` so the pre-typing
  // browse and the as-you-type results never clobber each other's reference
  // (Decision 3); replaced whole on each BROWSE_RESULTS. Starts empty: nothing
  // browsed yet.
  browse: { books: [] },
  // The device-local recents, most-recent-first (songs.search, RECENTS):
  // `[{ bookId, path, at }]`. Kept in the Worker's `meta` store, never the
  // home book — what was played on the phone is not synced to the laptop
  // (workflow 2 L17-20, Decision 2). Replaced whole on each RECENTS. Starts
  // empty: nothing opened yet.
  recents: [],
  // The per-file save preview (songs.save_sheet, SAVE_PREVIEW), keyed by
  // `bookId`: `{ [bookId]: { previews } }`, each preview `{ path, title,
  // changes, summary, isNew }` — "what changed, in musical terms" the save sheet
  // and the discard confirm render (Decision 2). Keyed by book like `save`, so a
  // preview for one book leaves another's reference untouched; replaced whole on
  // each SAVE_PREVIEW for that book (one sheet is open at a time). Starts empty:
  // nothing previewed yet.
  savePreview: {},
  // A song's working-copy text for the editor (songs.editor, SOURCE), nested
  // by `bookId` then `path`: `{ [bookId]: { [path]: { text } } }`. Nested, like
  // `history`, so a SOURCE for one song leaves every other song's entry at its
  // exact reference (referentially stable per path — the editor subscribes to
  // one path and must not re-render when another is loaded). Starts empty: no
  // song opened in an editor yet.
  source: {},
  // A song's reading state for the reading view (songs.reading, SONG), nested
  // by `bookId` then `path`: `{ [bookId]: { [path]: { transposition, variations } } }`.
  // `transposition` is the signed semitone offset; `variations` the per-tuning
  // `{ [tuning]: label }` map (home-book-format §4.5). Nested like `source`, so a
  // SONG for one song leaves every other song's entry at its exact reference
  // (the reading view subscribes to one path and must not re-render when another
  // opens). Starts empty: no song opened to read yet.
  song: {},
  // The instrument surface (music.instruments, INSTRUMENTS): the whole roster
  // projected from instruments.json, the resolved in-use id (null for the
  // implicit standard guitar), the standard-guitar fallback, and each
  // instrument's saved shapes — `{ instruments, inUseId, standard }`. Replaced
  // whole on each INSTRUMENTS event (like `preferences`/`shelf`), and left
  // untouched by every other event, so only the instrument surface re-renders.
  // Starts empty: the chip shows the standard guitar until OPEN surfaces it.
  instruments: { instruments: [], inUseId: null, standard: null },
  // The per-book sync state (sync.engine, SYNC), keyed by `bookId`: `{ phase,
  // savesWaiting, lastInStep, reason, at }`. `phase` is carried as a word (never
  // colour alone) — 'syncing' | 'in_step' | 'saves_waiting' | 'offline' |
  // 'needs_you' | 'gone' | 'cannot_save' | 'taken_down' (workflow 8 §What the
  // shelf says; 'cannot_save' is books.fork's reader-push refusal;
  // 'taken_down' is books.notice_surface, carrying the operator's copyright-notice
  // `reason`). The engine is the single source of
  // sync truth; the shelf (sync.states) renders this slice. A book an event does
  // not touch keeps its exact entry reference, so a view watching one book does
  // not re-render on another's pass ("only what shows it moves"). Starts empty:
  // nothing synced yet.
  sync: {},
  // The "mine on Estante" list for the Add-a-book sheet (books.add_by_link,
  // MINE): `{ status, books }` where `status` is a word (never colour alone) —
  // 'idle' (not asked yet), 'ready' (with `books: [{ id, label, gitUrl, role }]`,
  // the account's off-shelf books), 'signed_out' (a 401 — the sheet shows "Sign
  // in to see them") or 'error'. Replaced whole on each MINE event (like
  // `shelf`), left untouched by every other event. Starts idle: nothing listed
  // until the sheet opens and sends LIST_MINE.
  mine: { status: 'idle', books: [] },
  // The per-book in-progress-merge model (sync.conflicts, CONFLICTS), keyed by
  // `bookId`: `{ inProgress, songs, deleted, incoming, savesHeld }` recomputed
  // in the Worker on engage and after each resolution (workflow 9). Held in
  // memory only — no new IndexedDB store (engine.md's rejected conflict store);
  // a reload re-engages and recomputes. A book with no in-progress merge has no
  // entry (the panel and the save guard stand down). A book an event does not
  // touch keeps its entry reference. Starts empty: nothing paused yet.
  conflicts: {},
  // A fork's original, per fork (sync.fork_follow, ORIGINAL), keyed by the
  // fork's `bookId`: `{ newSaves, gone }` — how many saves its original has that
  // the fork does not (*Ana's Choros has 3 new saves*, workflow 11 line 46), and
  // whether the original is no longer shared with the user (following ends,
  // :51-54). Empty until a pass reaches the service; only followed forks appear.
  originals: {},
  // Every loaded book's setlists for the Setlists destination (books.setlists,
  // SETLISTS): `[{ bookId, path, title, count }]`, replaced whole on each
  // LIST_SETLISTS reply (like `shelf`/`mine`). `null` means "not listed yet",
  // so the destination can tell loading from genuinely empty. ADD_TO_SETLIST's
  // confirmation is transient (SETLIST_UPDATED, no slice), like FILE_MOVED.
  setlists: null,
  // The home book's attach (account.new_device, HOME_ATTACHED): `{ attached,
  // restored }` once the Worker has attached it on sign-in — `restored` true when
  // the account's settings came down, which the shelf's *Home book restored*
  // notice reads (workflow 13 §What comes down; W13 frame 2). Null until an
  // attach this session; a next start begins without it (the notice is shown
  // until dismissed, or until the next start).
  home: null,
  // The shelf fill (account.new_device, SHELF_FILL), keyed by `bookId`: `{ state,
  // progress, songs }` with `state` a word — 'waiting' | 'cloning' | 'ready' —
  // for each of the account's books coming down onto this device, in shelf
  // order (workflow 13 §What comes down). A book an event does not touch keeps
  // its entry reference. Starts empty: nothing filling.
  fill: {},
  // The two-*My songs* offer (account.new_device, MY_SONGS_CHOICE): `{ offered,
  // accountBookId, ready, kind }`, replaced whole on each event (workflow 13 §A
  // device used before signing in). Null until the Worker has evaluated it.
  mySongsChoice: null,
};

// Fold one message into the state. Only event-direction messages change
// anything; a command, a malformed message, or an event of an unknown kind
// returns the *same* state reference (forward-compatible: an event kind a
// later build adds is ignored, not a crash).
export function reduce(state, message) {
  if (!message || message.dir !== EVENT) return state;

  switch (message.kind) {
    case EventKind.READY:
      // The connection is up and the Worker reported its meta: both slices
      // move. `meta` becomes the reported record (a plain, cloned object);
      // `persisted` carries the storage-durability result from bring-up.
      return {
        ...state,
        connection: {
          status: 'ready',
          error: null,
          persisted: message.payload?.persisted ?? null,
        },
        meta: message.payload?.meta ?? null,
      };

    case EventKind.ERROR:
      // Only the connection slice moves; `meta` keeps its reference, so a
      // component showing meta does not re-render on an unrelated error.
      return {
        ...state,
        connection: { status: 'error', error: message.payload ?? null },
      };

    case EventKind.SAVED: {
      // A save landed: record the commit under the book's key — whether it went
      // up is the SYNC facts' to say (songs.save_feedback Constraint 2). Only this book's entry moves; the rest of `save` keeps its
      // references (DIRECTION §3.7 "only what shows it moves").
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        save: {
          ...state.save,
          [bookId]: {
            status: 'saved',
            commit: message.payload?.commit ?? null,
          },
        },
      };
    }

    case EventKind.DISCARDED: {
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        save: { ...state.save, [bookId]: { status: 'discarded' } },
      };
    }

    case EventKind.SAVE_REFUSED: {
      // A marked or unreadable file stopped the save: carry the refused path and
      // reason as a word, with the first marker line, so the view can point at it.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        save: {
          ...state.save,
          [bookId]: {
            status: 'refused',
            path: message.payload?.path ?? null,
            reason: message.payload?.reason ?? null,
            line: message.payload?.line ?? null,
            marker: message.payload?.marker ?? null,
          },
        },
      };
    }

    case EventKind.SONG_LOG: {
      // A song's filtered version list arrived: set `entries` under the book's
      // path, preserving any cached `versions` and the `restored` token. Only this
      // path's entry moves; other paths and books keep their references.
      const bookId = message.payload?.bookId;
      const path = message.payload?.path;
      if (!bookId || !path) return state;
      const prevBook = state.history[bookId] ?? {};
      const prevPath = prevBook[path] ?? {};
      return {
        ...state,
        history: {
          ...state.history,
          [bookId]: {
            ...prevBook,
            [path]: {
              versions: {},
              restored: 0,
              ...prevPath,
              entries: message.payload?.entries ?? [],
            },
          },
        },
      };
    }

    case EventKind.VERSION: {
      // A version's exact bytes arrived: cache them under the book's path by
      // commit, preserving `entries` and `restored`. Only this path's entry moves.
      const bookId = message.payload?.bookId;
      const path = message.payload?.path;
      const commit = message.payload?.commit;
      if (!bookId || !path || !commit) return state;
      const prevBook = state.history[bookId] ?? {};
      const prevPath = prevBook[path] ?? {};
      return {
        ...state,
        history: {
          ...state.history,
          [bookId]: {
            ...prevBook,
            [path]: {
              entries: [],
              restored: 0,
              ...prevPath,
              versions: {
                ...(prevPath.versions ?? {}),
                [commit]: message.payload?.text ?? '',
              },
            },
          },
        },
      };
    }

    case EventKind.RESTORED: {
      // A version was restored into the working copy: bump the `restored` token
      // under the book's path so the view opens the save sheet. Preserves
      // `entries` and `versions`. Only this path's entry moves.
      const bookId = message.payload?.bookId;
      const path = message.payload?.path;
      if (!bookId || !path) return state;
      const prevBook = state.history[bookId] ?? {};
      const prevPath = prevBook[path] ?? {};
      return {
        ...state,
        history: {
          ...state.history,
          [bookId]: {
            ...prevBook,
            [path]: {
              entries: [],
              versions: {},
              ...prevPath,
              restored: (prevPath.restored ?? 0) + 1,
            },
          },
        },
      };
    }

    case EventKind.BOOK_LOG: {
      // The book's whole log arrived: replace this book's entry. Only this book's
      // entry moves; the rest of `bookLog` keeps its references.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        bookLog: {
          ...state.bookLog,
          [bookId]: { commits: message.payload?.commits ?? [] },
        },
      };
    }

    case EventKind.TREE: {
      // The book's working tree arrived (books.file_view): replace this book's
      // entry. Only this book's entry moves; the rest of `tree` keeps its
      // references.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        tree: {
          ...state.tree,
          [bookId]: { entries: message.payload?.entries ?? [] },
        },
      };
    }

    case EventKind.SEARCH_RESULTS:
      // A search completed: replace the `search` slice with the query and its
      // ranked results. Only this slice moves; every other slice keeps its
      // reference ("only what shows it moves").
      return {
        ...state,
        search: {
          query: message.payload?.query ?? null,
          results: message.payload?.results ?? [],
        },
      };

    case EventKind.INDEX_STATUS: {
      // A book's index changed build state: set it under the book's key. Only
      // this book's entry moves; the rest of `index` keeps its references, so a
      // view watching one book does not re-render on another's progress.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      const next = message.payload?.state ?? null;
      let songCounts = state.songCounts;
      if (next === null) {
        if (bookId in songCounts) {
          songCounts = { ...songCounts };
          delete songCounts[bookId];
        }
      } else if (next === 'ready' && typeof message.payload?.songs === 'number') {
        if (songCounts[bookId] !== message.payload.songs) {
          songCounts = { ...songCounts, [bookId]: message.payload.songs };
        }
      }
      return {
        ...state,
        index: { ...state.index, [bookId]: next },
        songCounts,
      };
    }

    case EventKind.BROWSE_RESULTS:
      // The pre-typing browse arrived: replace the `browse` slice with every
      // indexed location grouped by book. Only this slice moves; every other
      // slice keeps its reference ("only what shows it moves"). A separate slice
      // from `search`, so browsing and searching never clobber each other.
      return { ...state, browse: { books: message.payload?.books ?? [] } };

    case EventKind.RECENTS:
      // The device-local recents arrived (or changed): replace the `recents`
      // slice with the most-recent-first list. Only this slice moves. An absent
      // payload resets to empty.
      return { ...state, recents: message.payload?.recents ?? [] };

    case EventKind.PREFERENCES:
      // The home book's preferences surfaced (or changed): replace the slice
      // with the reported map of registers. Only this slice moves; a component
      // watching, say, `save` keeps its reference and does not re-render
      // ("only what shows it moves"). An absent payload resets to empty.
      return { ...state, preferences: message.payload ?? {} };

    case EventKind.SHELF:
      // The home book's shelf surfaced (or changed): replace the slice with the
      // reported `{ books, local }` map of registers, copying the PREFERENCES
      // fold exactly (whole-slice replace). Only this slice moves; a component
      // watching, say, `preferences` keeps its reference and does not re-render
      // ("only what shows it moves", DIRECTION §3.7 L410-414). An absent payload
      // resets to empty — two independently-changing home-book files move two
      // slices independently (Decision 2).
      return { ...state, shelf: message.payload ?? {} };

    case EventKind.SETLISTS:
      // The loaded books' setlists surfaced (books.setlists): replace the slice
      // whole, like `shelf`. An absent payload resets to the empty list (listed,
      // none found) — distinct from the `null` initial (not listed yet).
      return { ...state, setlists: message.payload?.setlists ?? [] };

    case EventKind.SAVE_PREVIEW: {
      // A save preview arrived: set this book's previews. Only this book's entry
      // moves; the rest of `savePreview` keeps its references ("only what shows
      // it moves"). An absent payload resets this book to an empty list.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        savePreview: {
          ...state.savePreview,
          [bookId]: { previews: message.payload?.previews ?? [] },
        },
      };
    }

    case EventKind.SOURCE: {
      // A song's working-copy text arrived: set it under the book's path.
      // Nested like SONG_LOG so only this path's entry moves — every other
      // song the editor is not showing keeps its reference (Decision 4).
      const bookId = message.payload?.bookId;
      const path = message.payload?.path;
      if (!bookId || !path) return state;
      const prevBook = state.source[bookId] ?? {};
      return {
        ...state,
        source: {
          ...state.source,
          [bookId]: {
            ...prevBook,
            [path]: { text: message.payload?.text ?? '', unsaved: message.payload?.unsaved === true },
          },
        },
      };
    }

    case EventKind.SONG: {
      // A song's reading state arrived (OPEN_SONG reply, or a re-surface after a
      // SET_TRANSPOSITION / SET_VARIATION write): set it under the book's path.
      // Nested like SOURCE so only this path's entry moves — every other song the
      // reading view is not showing keeps its reference (Decision 2).
      const bookId = message.payload?.bookId;
      const path = message.payload?.path;
      if (!bookId || !path) return state;
      const prevBook = state.song[bookId] ?? {};
      return {
        ...state,
        song: {
          ...state.song,
          [bookId]: {
            ...prevBook,
            [path]: {
              transposition: message.payload?.transposition ?? 0,
              variations: message.payload?.variations ?? {},
            },
          },
        },
      };
    }

    case EventKind.INSTRUMENTS:
      // The instrument surface surfaced (or changed): replace the slice with the
      // reported `{ instruments, inUseId, standard }`, copying the PREFERENCES
      // fold exactly (whole-slice replace). Only this slice moves; a component
      // watching another slice keeps its reference ("only what shows it moves").
      // An absent payload resets to the empty roster.
      return {
        ...state,
        instruments: message.payload ?? { instruments: [], inUseId: null, standard: null },
      };

    case EventKind.SYNC: {
      // A book's sync state moved (sync.engine): set it under the book's key.
      // Only this book's entry moves; the rest of `sync` keeps its references,
      // so a view watching one book does not re-render on another's pass. The
      // engine carries the whole fact each time (whole-entry replace), so a
      // field it omits resets rather than lingering from a previous phase.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        sync: {
          ...state.sync,
          [bookId]: {
            phase: message.payload?.phase ?? null,
            savesWaiting: message.payload?.savesWaiting ?? 0,
            lastInStep: message.payload?.lastInStep ?? null,
            // The operator's take-down reason, set only on a `taken_down` fact
            // (books.notice_surface). The whole-entry replace resets it to null
            // on any other phase, so a book that leaves `taken_down` drops it.
            reason: message.payload?.reason ?? null,
            at: message.payload?.at ?? null,
          },
        },
      };
    }

    case EventKind.CONFLICTS: {
      // A book's in-progress-merge model arrived (sync.conflicts): set it under
      // the book's key, like SYNC. A payload with `inProgress: false` means the
      // merge was committed or abandoned — drop the entry so the panel and the
      // save guard stand down. Only this book's entry moves; the rest keep their
      // references.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      if (message.payload?.inProgress === false) {
        if (!(bookId in state.conflicts)) return state;
        const next = { ...state.conflicts };
        delete next[bookId];
        return { ...state, conflicts: next };
      }
      return {
        ...state,
        conflicts: {
          ...state.conflicts,
          [bookId]: {
            inProgress: true,
            songs: message.payload?.songs ?? [],
            deleted: message.payload?.deleted ?? [],
            incoming: message.payload?.incoming ?? [],
            savesHeld: message.payload?.savesHeld ?? [],
          },
        },
      };
    }

    case EventKind.ORIGINAL: {
      // A fork's original was counted on a pass (sync.fork_follow): set it under
      // the fork's key, whole-entry replace like SYNC, so a count that cleared
      // after a bring-in reads 0. Only this fork's entry moves.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        originals: {
          ...state.originals,
          [bookId]: {
            newSaves: message.payload?.newSaves ?? 0,
            gone: message.payload?.gone === true,
          },
        },
      };
    }

    case EventKind.BOOK_FORKED: {
      // A book became its fork (books.fork): the original's id is off the shelf.
      // Its sync fact and its original count go with it — a `gone` or
      // `cannot_save` that no longer names a book must not keep the Books
      // header's out-of-step mark lit; the fork's own facts arrive with the next
      // pass. The search, browse and recent rows already on screen are re-pointed
      // at the fork, so a row listed before the fork opens the fork's song — not
      // the original's vanished copy — until the next reply replaces them.
      const previous = message.payload?.previousBookId;
      const forkId = message.payload?.bookId;
      if (!previous || !forkId) return state;
      const follow = (row) => (row?.bookId === previous ? { ...row, bookId: forkId } : row);
      const names = (rows) => Array.isArray(rows) && rows.some((r) => r?.bookId === previous);
      let next = state;
      const edit = () => {
        if (next === state) next = { ...state };
        return next;
      };
      if (previous in state.sync) {
        edit().sync = { ...state.sync };
        delete next.sync[previous];
      }
      if (previous in state.originals) {
        edit().originals = { ...state.originals };
        delete next.originals[previous];
      }
      if (names(state.search?.results)) {
        edit().search = { ...state.search, results: state.search.results.map(follow) };
      }
      if (names(state.browse?.books)) {
        edit().browse = { ...state.browse, books: state.browse.books.map(follow) };
      }
      if (names(state.recents)) {
        edit().recents = state.recents.map(follow);
      }
      return next;
    }

    case EventKind.BOOK_LEFT: {
      // A leave finished (books.leave Decision 4): drop the left book from the
      // "mine on Estante" list so its row disappears without a second LIST_MINE.
      // Only this slice moves; a book not in it leaves the state untouched.
      const id = message.payload?.bookId;
      const books = state.mine?.books ?? [];
      if (!books.some((b) => b.id === id)) return state;
      return { ...state, mine: { ...state.mine, books: books.filter((b) => b.id !== id) } };
    }

    case EventKind.HOME_ATTACHED:
      // The home book's attach finished (account.new_device): replace the slice.
      return {
        ...state,
        home: {
          attached: message.payload?.attached === true,
          restored: message.payload?.restored === true,
        },
      };

    case EventKind.SHELF_FILL: {
      // One book of the shelf fill moved (account.new_device): set its entry,
      // whole-entry replace like SYNC. Only this book's entry moves.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      const progress = message.payload?.progress;
      const songs = message.payload?.songs;
      return {
        ...state,
        fill: {
          ...state.fill,
          [bookId]: {
            state: message.payload?.state ?? 'waiting',
            progress: typeof progress === 'number' ? progress : null,
            songs: typeof songs === 'number' ? songs : null,
          },
        },
      };
    }

    case EventKind.MY_SONGS_CHOICE:
      // The two-*My songs* offer was (re-)evaluated: replace the slice whole.
      return {
        ...state,
        mySongsChoice: {
          offered: message.payload?.offered === true,
          accountBookId: message.payload?.accountBookId ?? null,
          ready: message.payload?.ready === true,
          kind: message.payload?.kind ?? 'other',
        },
      };

    case EventKind.SIGNED_OUT:
    case EventKind.LEFT_ESTANTE:
      // Signed out on this device (account.sign_out / account.leaving): the
      // account's attach, its fill and its *My songs* offer are no longer this
      // device's to show. Nothing else moves.
      if (state.home === null && Object.keys(state.fill).length === 0 && state.mySongsChoice === null) {
        return state;
      }
      return { ...state, home: null, fill: {}, mySongsChoice: null };

    case EventKind.MINE:
      // The "mine on Estante" list arrived (books.add_by_link): replace the slice
      // whole with the reported `{ status, books }`, like SHELF. Only this slice
      // moves; the Add-a-book sheet re-renders, nothing else. An absent payload
      // resets to idle.
      return {
        ...state,
        mine: {
          status: message.payload?.status ?? 'idle',
          books: message.payload?.books ?? [],
        },
      };

    default:
      return state;
  }
}
