// The message protocol between the main thread and the data Worker
// (DIRECTION §3.7 L394-401). Every message is a plain, structured-cloneable
// envelope so it survives `postMessage` across the real Worker boundary:
// commands travel main -> Worker, events travel Worker -> main. The `kind`
// field is an open string, so later storage and sync tasks (a clone's
// progress, a merge landing, a sync finishing — §3.7 L399-401) add message
// types without reshaping the channel.
//
// Framework-free: this module imports no React. It is the only thing the store
// and the Worker logic share (the constructors), which keeps the boundary thin.

// Rides on every envelope. No runtime negotiation is built — the service
// worker (`skipWaiting: false`) guarantees the Worker and the main thread are
// the same build within one load, so skew cannot occur mid-session — but the
// schema is still guarded by a version the day a migration needs it.
export const PROTOCOL_VERSION = 1;

// Direction tags. The store only ever reduces events; the Worker logic only
// ever handles commands. Each side ignores a message in the wrong direction.
export const COMMAND = 'command';
export const EVENT = 'event';

// Commands: main -> Worker. Open to extension. `OPEN` brings the Worker's
// database up (storage.fs). `WRITE`/`SAVE`/`DISCARD` are the working-copy flow
// (storage.working_copy): WRITE persists the editor's current text, SAVE
// canonicalises + commits + pushes, DISCARD puts files back as last saved.
// Later tasks add clone / fetch / merge / index without touching the envelope.
export const CommandKind = Object.freeze({
  OPEN: 'open',
  WRITE: 'write',
  SAVE: 'save',
  DISCARD: 'discard',
  // Sync the home book and re-surface its preferences (storage.preferences_surface):
  // fetch → merge key by key → commit → push, then re-emit PREFERENCES so a
  // register a sync changed reaches the slice. The sync engine drives this on
  // its schedule; it is the testable trigger for the re-emit.
  SYNC_HOME: 'sync_home',
  // Run one sync pass (sync.engine, workflow 8 §When it runs). Payload
  // `{ reason }` names why it fired — 'open' | 'foreground' | 'online' |
  // 'after-save' | 'timer' | 'sync-now' — carried for observability only; the
  // action is identical (Decision 2). The Worker's scheduler coalesces the five
  // triggers into non-overlapping passes, so a flood of SYNC commands collapses.
  // The two DOM-only triggers (foreground, network back) arrive as SYNC commands
  // from the thin main-thread adapter (sync-triggers.js); open, after-save and
  // the five-minute timer fire inside the Worker. *Sync now* (sync.states)
  // reuses this command.
  SYNC: 'sync',
  // The history reads (storage.history), each a local, offline read under the
  // book lock: SONG_LOG a song's versions (rename-followed, merges hidden unless
  // resolved), READ_VERSION a version's exact bytes, RESTORE_VERSION a version
  // into the working copy (uncommitted), BOOK_LOG the book's whole log for the
  // file view.
  SONG_LOG: 'song_log',
  READ_VERSION: 'read_version',
  RESTORE_VERSION: 'restore_version',
  // Restore ONE block of a version into the working copy (songs.restore_part,
  // workflow 6 §Restoring). Payload `{ bookId, path, commit, fromPath, block }`:
  // like RESTORE_VERSION but `block` is the ref the view minted from the
  // compare-with-now diff — `{ kind: 'section', name, fromName }` or
  // `{ kind: 'voicing', tuning, variation }`. The Worker re-parses the historical
  // blob (`fromPath@commit`) and the current working copy, splices that one block
  // into the working model, writes it canonical at the song's CURRENT path
  // uncommitted (one lock, no commit/push), and emits RESTORED carrying a
  // `restored` flag — `true` when a block landed, `false` when the restore brings
  // nothing back (a no-op, or a voicing block pruned to nothing). The existing
  // host opens the save sheet only when `restored` is not false.
  RESTORE_PART: 'restore_part',
  BOOK_LOG: 'book_log',
  // Song search across every loaded book (storage.index, workflow 2). Payload
  // `{ query, scope? }`; the Worker queries its in-memory index and replies with
  // a SEARCH_RESULTS event. `scope` optionally narrows to book ids
  // (`{ books: [...] }`) or a folder prefix within a book (`{ bookId, prefix }`).
  SEARCH: 'search',
  // The pre-typing browse the search screen lands on (songs.search, workflow 2
  // L13-16). BROWSE reads every indexed location grouped by book over the
  // existing `index_locations` data (no re-parse — Decision 3) and replies with
  // a BROWSE_RESULTS event; `scope` narrows it the same way SEARCH's does.
  BROWSE: 'browse',
  // Record a song as recently opened (songs.search, workflow 2 L17-20).
  // Payload `{ bookId, path }`; the Worker writes a capped, most-recent-first
  // list into the device-local `meta` store (NOT the synced home book — no
  // commit) and replies with a RECENTS event. `songs.reading` calls this on
  // open; the search screen displays it.
  RECORD_RECENT: 'record_recent',
  // The shelf write path (books.shelf, workflow 7). CREATE_BOOK `{ title,
  // author }` makes an empty local songbook with no account — `git.init` +
  // §2.1 scaffold + one commit — writes its `shelf.local` entry through the
  // home book (provisioning a local home book if none exists), re-surfaces
  // SHELF and emits BOOK_CREATED. RENAME_BOOK `{ bookId, name, author }` writes
  // the book's shelf label (shared) or title (local) register and re-surfaces
  // SHELF — a label kept in the home book that changes nothing in the
  // repository (workflow 7 L16-18). Both commit locally, never push.
  CREATE_BOOK: 'create_book',
  RENAME_BOOK: 'rename_book',
  // The four acts of the per-book detail (books.online, workflow 7 L46-63,
  // L128-137), each going through the Worker because git and IndexedDB live
  // there (DIRECTION §3.7). PUT_ONLINE `{ bookId, author }` creates the book on
  // Estante (POST /api/books), adopts the service id as the on-device id
  // (Decision 3), sets the git remote, pushes the first commit, and migrates the
  // shelf register from `shelf.local` to `shelf.books`; it emits BOOK_ONLINE on
  // success or BOOK_ONLINE_REFUSED (quota / signed-out / offline) when the
  // service create fails — nothing is written on the device in that case
  // (Decision 4). `bookId` is the current on-device id (the local id).
  // DOWNLOAD_BOOK `{ bookId }` zips the repository as it is on the device
  // (`.git` + working tree, unsaved included, remote stripped) and replies with
  // BOOK_DOWNLOAD carrying the Blob; all local. REMOVE_BOOK `{ bookId, author }`
  // deletes this device's clone and tombstones the shelf register, leaving the
  // service book untouched; all local. DELETE_BOOK `{ bookId, author }` (owner
  // only) deletes the book from Estante for everyone (DELETE /api/books/{id}),
  // then removes the local clone and tombstones the shelf register. REMOVE_BOOK
  // and DELETE_BOOK both reply with BOOK_REMOVED so the view closes the detail.
  PUT_ONLINE: 'put_online',
  DOWNLOAD_BOOK: 'download_book',
  REMOVE_BOOK: 'remove_book',
  DELETE_BOOK: 'delete_book',
  // Leaving one shared book (books.leave, workflow 10 §Leaving a book).
  // LEAVE_BOOK `{ bookId, author }` (a reader or an editor) ends the membership
  // on Estante first (DELETE /api/books/{id}/membership); only on its 204, or a
  // 404 (already not a member — Decision 3), it runs REMOVE_BOOK's teardown if
  // the book is on this shelf (a *Mine on Estante* row's book is not). It replies
  // BOOK_LEFT, or LEAVE_FAILED with nothing local touched.
  LEAVE_BOOK: 'leave_book',
  // Leaving the account on this device (account.sign_out, workflow 13 §Signing
  // out). SURVEY_SIGN_OUT `{}` counts this device's local-only work — unsaved
  // changes and saves not yet pushed per book — and flags the books only on this
  // device, replying with SIGN_OUT_SURVEY; a read, no teardown. SIGN_OUT
  // `{ mode, author }` performs the teardown: `mode:'remove'` drops every clone
  // (the account's shared books and this device's local books) and tombstones
  // their shelf registers; `mode:'keep'` migrates each shared book into the local
  // shelf map and strips its git remote (the inverse of PUT_ONLINE), leaving the
  // already-local books. Either way the home book stays and its remote is stripped
  // idempotently; it replies with SIGNED_OUT. All local; no network (Decision 4).
  SURVEY_SIGN_OUT: 'survey_sign_out',
  SIGN_OUT: 'sign_out',
  // Deleting the account on this device (account.leaving, workflow 17 §cascade
  // device-teardown). LEAVE_ESTANTE `{}` is dispatched by the main thread
  // ONLY after a 204 from DELETE /api/account — the account is already gone
  // server-side, so this is a local sweep, the inverse ordering of SIGN_OUT
  // (Decision 3): it runs the same remove-branch teardown SIGN_OUT's `mode:'remove'`
  // does — drop every clone (the account's shared books, this device's local
  // books, and the home book), tombstone their shelf registers, drop their index
  // entries — with no POST /api/auth/signout to follow (the session is already
  // revoked). It replies with LEFT_ESTANTE, after which the surface returns to its
  // first-run, not-signed-in state. The SURVEY_SIGN_OUT read is reused unchanged to
  // count the per-book warnings the delete dialog shows.
  LEAVE_ESTANTE: 'leave_estante',
  // Make a book the user's own copy (books.fork, workflow 11). FORK_BOOK
  // `{ bookId, author }` is dispatched by every *make it your own* offer: Save in
  // a book the user cannot push to (the save sheet), a book refused as a
  // reader's push (`cannot_save`), a book the user lost access to (`gone`), and
  // the book detail's **Fork** card. The Worker asks the service to copy the
  // book (POST /api/books/{id}/fork); on a 404 it puts its own copy online
  // instead (POST /api/books + push — Decision 2). It relocates the working copy
  // to the fork's id (unsaved edits and unpushed commits carried), marks the
  // history *Made your own from …*, replaces the original on the shelf in one
  // home-book write (with the fork's `original` register), moves the search
  // entries, and replies BOOK_FORKED; a refusal replies FORK_FAILED and leaves
  // the device unchanged.
  FORK_BOOK: 'fork_book',
  // Join a shared book from its invitation (books.add_by_link, workflow 1
  // §Invited, workflow 7 §By link). ADD_BY_LINK `{ token, author }` accepts the
  // invitation (POST /api/invitations/{token}/accept) and, on a 200 Book, clones
  // it over git-over-HTTP into bookDir(serviceId), writes its
  // `shelf.books[serviceId]` entry with the GRANTED `role` (reader/editor — the
  // joiner never chooses, Decision), indexes it and emits BOOK_CLONED; the role
  // is the invitation's. A 401 emits NEED_ACCOUNT (no clone, no shelf write — the
  // account-first gate, Decision 2); a 409/404 emits BOOK_REFUSED with the mapped
  // reason ('full' | 'dead' | 'error') and leaves the shelf unchanged. The
  // Worker's fetch carries the same-origin session cookie the sign-in minted.
  // ADD_MINE `{ bookId, gitUrl, label, role, author }` clones a book the account
  // is ALREADY a member of (no accept — "mine on Estante", Decision 5), writing
  // the same shelf entry and emitting BOOK_CLONED. LIST_MINE lists the account's
  // books not yet on this device's shelf (GET /api/books minus the local shelf,
  // Decision 5) and replies with a MINE event; a 401 replies MINE
  // `{ status: 'signed_out' }`.
  ADD_BY_LINK: 'add_by_link',
  ADD_MINE: 'add_mine',
  LIST_MINE: 'list_mine',
  // Open the bundled example book (account.first_run, workflow 1 §Cold).
  // Payload `{ title, author }`: the localised shelf label (the view knows the
  // language) and the device-local commit identity. The Worker provisions a
  // local home book if none exists, seeds the bundled book as a local git
  // repository under a reserved id (idempotently — a second open reuses the one
  // repository), writes its `shelf.local` entry, re-surfaces SHELF, indexes the
  // book, and emits BOOK_CREATED. All local — no account, no network, no push.
  OPEN_EXAMPLE_BOOK: 'open_example_book',
  // Read a song's working-copy text into the view (songs.editor, Decision 4).
  // Payload `{ bookId, path }`: the Worker reads the live working-copy bytes
  // (NOT a committed version — READ_VERSION reads HEAD and would miss unsaved
  // edits) and replies with a SOURCE event. This is the read-back
  // storage.working_copy left out (it built WRITE/SAVE/DISCARD and no way to
  // read the current text back). Local, offline, no commit.
  OPEN_SOURCE: 'open_source',
  // The reading view's state reads and writes (songs.reading, workflow 2). Reading
  // state is the user's, not the song's — kept in the home book's songs.json
  // (DIRECTION §3.2, home-book-format §4.5), never in the song. OPEN_SONG
  // `{ bookId, path }` reads the per-song `{ transposition, variations }`
  // projection and replies with a SONG event (the read path the `song` slice
  // re-surfaces after a write); a local, offline read, no commit. SET_TRANSPOSITION
  // `{ bookId, path, semitones }` writes the signed `transposition` register and
  // re-surfaces SONG; SET_VARIATION `{ bookId, path, tuning, variation }` writes
  // the per-tuning `variation` register and re-surfaces SONG. Both go through
  // `home-book.set` — one lock, canonical, auto-committed, never pushed (a
  // preference, like the instrument writes); the paired OPEN_SOURCE carries the
  // text the view parses. No song text crosses on any of the three.
  OPEN_SONG: 'open_song',
  SET_TRANSPOSITION: 'set_transposition',
  SET_VARIATION: 'set_variation',
  // Start a new song (songs.new_song, workflow 3). NEW_SONG `{ targetBookId?,
  // folder?, mySongsTitle?, author }` ensures the target book exists — for *My
  // songs* (when no `targetBookId`), idempotently under the reserved
  // `local-my-songs` id, provisioning a local home book and a `shelf.local`
  // entry if absent and re-surfacing SHELF; for a chosen book, a no-op — then
  // allocates a free `untitled[-N].cifra.md` placeholder path against the
  // book's working copy (in `folder` when given, else at the root) and replies
  // with a NEW_SONG_READY event. All local — no account, no network, no push.
  // `mySongsTitle` is the localised *My songs* shelf label and README identity
  // (the view knows the language), used only when provisioning *My songs*.
  NEW_SONG: 'new_song',
  // The first save of a new song (songs.new_song, workflow 3 §The first save).
  // NAME_AND_SAVE `{ bookId, fromPath, author, message?, title? }`: the Worker
  // parses the working-copy file for its title, derives the title's ASCII slug
  // filename (`deriveSongFilename`, with a collision suffix against the folder),
  // renames the placeholder to it, then canonicalises, commits and pushes (a
  // local book commits only; an online book pushes, or queues offline), and
  // replies with the existing SAVED event carrying the final `path`. The app
  // never renames it afterwards (DIRECTION §4 L446-448). `message` is the save
  // sheet's note — the commit message (songs.save_sheet Decision 5); absent, it
  // falls back to the W03 *Add {title}*. `title` is the name the save sheet
  // prompts for when the song has no title line yet (songs.save_sheet acceptance
  // 7); it feeds `deriveSongFilename` and the default message when the parsed
  // title is empty.
  NAME_AND_SAVE: 'name_and_save',
  // Compute the per-file save preview (songs.save_sheet, Decision 2). PREVIEW_SAVE
  // `{ bookId, paths }`: for each path the Worker reads the last-saved version
  // (HEAD) and the working copy, parses both and runs the semantic `diff`,
  // replying with a SAVE_PREVIEW event carrying `{ path, title, changes, summary,
  // isNew }` per path — one reply serving a single save and *save all* alike. A
  // read only: no canonicalise, no commit, no push. The Worker owns HEAD and the
  // working copy (DIRECTION §3.7); the view renders what it returns.
  PREVIEW_SAVE: 'preview_save',
  // Persist the author's display name to the home book (songs.save_sheet,
  // Decision 4; workflow 4 §Who made the change). SET_IDENTITY_NAME `{ name,
  // author }`: the Worker provisions a local home book if none exists and writes
  // the `authorName` register into preferences.json (home-book-format §4.1),
  // then re-surfaces PREFERENCES so the slice carries it and the first save is
  // the only one that asks. Offline, auto-committed, never pushed (a preference).
  SET_IDENTITY_NAME: 'set_identity_name',
  // Persist the chosen theme and language to the home book (account.account_screen,
  // design.theme_picker; workflow 13 §Preferences; home-book-format §4.1). Each is
  // the SET_IDENTITY_NAME template: provision a local home book, write the
  // `{ value, at }` register into preferences.json, re-surface PREFERENCES so
  // ThemeRoot/LocaleRoot re-apply off the slice, and flush. SET_THEME `{ theme,
  // author }` — `theme` is one of CHOSEN_THEMES (resolve.js); `automatic` clears
  // the register to a tombstone (Decision 3) so a new device follows its own
  // light/dark mode, never a literal `"automatic"`. SET_LANGUAGE `{ language,
  // author }` — `language` is one of LOCALE_IDS (i18n). Each validates its value
  // at the boundary and rejects an invalid one (no write). Offline, auto-committed,
  // never pushed (a preference); the value is never logged (standing rule).
  SET_THEME: 'set_theme',
  SET_LANGUAGE: 'set_language',
  // Record that the first-open "Playing on guitar — change?" prompt was answered
  // (songs.first_song, workflow 1 §The instrument). MARK_INSTRUMENT_PROMPT_SEEN
  // `{ author }`: the Worker provisions a local home book if none exists and
  // writes the `instrumentPromptSeen` register into preferences.json
  // (home-book-format §4.1), then re-surfaces PREFERENCES so the slice carries it
  // and the reading view never asks again — on this device or, after sync, the
  // next. Offline, auto-committed, never pushed (a preference, like
  // SET_IDENTITY_NAME and USE_INSTRUMENT). It carries only the device commit
  // identity and the boolean — no song text, no path.
  MARK_INSTRUMENT_PROMPT_SEEN: 'mark_instrument_prompt_seen',
  // The file view's reads and file operations (books.file_view, workflow 14).
  // BOOK_TREE `{ bookId }` walks the working tree and replies with a TREE event
  // (every allowed file with its working-copy status). MOVE_FILE `{ bookId,
  // fromPath, toPath }` moves/renames a file in the working copy keeping its
  // kind and rewrites the book's setlist links to it, all uncommitted, replying
  // with FILE_MOVED. DELETE_FILE `{ bookId, path }` removes a file from the
  // working copy (a committed file shown deleted until save; a never-saved file
  // unlinked), replying with FILE_DELETED. COMMIT_DIFF `{ bookId, commit }`
  // reads each file a commit touched with its before/after text, replying with a
  // COMMIT_DIFF event the view line-diffs. All local, offline; BOOK_LOG,
  // RESTORE_VERSION, OPEN_SOURCE, WRITE, SAVE and PREVIEW_SAVE are reused.
  BOOK_TREE: 'book_tree',
  MOVE_FILE: 'move_file',
  DELETE_FILE: 'delete_file',
  COMMIT_DIFF: 'commit_diff',
  // Setlists (books.setlists, workflow 12). LIST_SETLISTS `{}` walks every
  // loaded book's working tree for its `*.setlist.md` files and replies with a
  // SETLISTS event (each setlist's book, path, title and song count) — a local,
  // offline read. ADD_TO_SETLIST `{ targetBookId, setlistPath, newTitle?, song:
  // { bookId, path, title } }` adds a song to a setlist as one locked, uncommitted
  // working-copy change (the file_view move+relink precedent): when the song is
  // from another book it is copied into the target book first (workflow 12 §Songs
  // from another book), a `newTitle` creates the `*.setlist.md`, and the item is
  // appended in canonical form — all under one `withLock(targetBookId)`, replying
  // with SETLIST_UPDATED. A following SAVE commits the copy and the setlist change
  // as one commit. Opening and editing a setlist reuse OPEN_SOURCE, BOOK_TREE,
  // WRITE, SAVE and DISCARD with cifra-md's pure §10.10 ops in the view
  // (Decision 3).
  LIST_SETLISTS: 'list_setlists',
  ADD_TO_SETLIST: 'add_to_setlist',
  // The instrument write path (music.instruments, workflow 15). Each mutation is
  // a home-book change written through `home-book.set` — one lock, canonical,
  // auto-committed, no push (DIRECTION §3.2; workflow 16 L119-122) — followed by
  // an INSTRUMENTS re-surface. SAVE_INSTRUMENT `{ id?, definition, preset?,
  // author }` adds (no id → mint one, write the `definition` and `rules`
  // registers, and set it in use when it is the first) or edits a definition
  // (id → rewrite only its `definition` register). SET_INSTRUMENT_RULES `{ id,
  // rules, author }` writes the `rules` register — a named preset `{ preset }`
  // or a frozen `{ preset: 'custom', config }` (home-book §4.3). USE_INSTRUMENT
  // `{ id, author }` writes the singleton `instrumentInUse` preference (switching;
  // absent means the standard guitar). REMOVE_INSTRUMENT `{ id, author }`
  // tombstones the instrument's two registers, every `shapes.json[id]` leaf, and
  // each `songs.json[*].variation[<tuning>]` no remaining instrument still uses,
  // falling back to the standard guitar when the in-use or last one goes.
  // SAVE_SHAPE `{ id, tuning, chord, shorthand, author }` writes one my-shape leaf
  // — the opaque fret shorthand (cifra.md §7), keyed by the chord as the music
  // core matches it (home-book §4.4) — the star in the chord explorer
  // (music.explorer, workflow 16 L108-133). REMOVE_SHAPE `{ id, tuning, chord,
  // author }` tombstones one my-shape leaf (home-book §4.4, §5.3). SYNC_HOME
  // re-surfaces INSTRUMENTS alongside the rest.
  SAVE_INSTRUMENT: 'save_instrument',
  SET_INSTRUMENT_RULES: 'set_instrument_rules',
  USE_INSTRUMENT: 'use_instrument',
  REMOVE_INSTRUMENT: 'remove_instrument',
  REMOVE_SHAPE: 'remove_shape',
  SAVE_SHAPE: 'save_shape',
  // Conflict resolution (sync.conflicts, workflow 9): a book the engine left
  // reading *needs you* is paused with an in-progress merge the user settles one
  // piece at a time. All four run in the Worker under the book lock; none waits
  // on anything but the final push. OPEN_CONFLICTS `{ bookId }` engages the book:
  // it recomputes the byte-deterministic merge, materialises it in the working
  // copy (every clean-merged file lands; each conflicted song stays at *ours*),
  // and emits a CONFLICTS event with the recomputed per-book model. Idempotent —
  // re-opening recomputes and re-emits. RESOLVE_CONFLICT `{ bookId, path, choice,
  // text?, author }` settles one file: `choice` is 'mine' / 'theirs' (resolve the
  // whole file's marked text by that side, §11.12.4), 'edit' (`text` is the
  // user's edited text — refused if it still holds a marker line, §11.12.3),
  // 'keep' / 'delete' (a deleted-vs-edited `file` conflict — keep the edited song
  // or delete it, workflow 9 §Settling one), 'keep_both' (a voicing conflict —
  // keep ours in its block and write theirs into a variation named for the
  // author, sync.keep_both) or 'keep_both_song' (a region-conflicted song —
  // keep ours and write theirs's version beside it as <name>-<author>.cifra.md).
  // It re-emits CONFLICTS; when the last
  // conflict in the book is settled it commits the two-parent merge and pushes.
  // COMMIT_MERGE `{ bookId, author }` forces the settle-and-push when every file
  // is already resolved (the book-level *everything settled* path); normally
  // RESOLVE_CONFLICT does it. ABANDON_MERGE `{ bookId }` resets the book to
  // exactly before the sync (working copy back to *ours*, the in-progress merge
  // and the retained incoming ref dropped) and clears *needs you* (workflow 9
  // §Leaving one). A SAVE in a book with an in-progress merge is refused outright
  // with *settle the conflicts first* (SAVE_REFUSED reason 'merge_in_progress').
  OPEN_CONFLICTS: 'open_conflicts',
  RESOLVE_CONFLICT: 'resolve_conflict',
  COMMIT_MERGE: 'commit_merge',
  ABANDON_MERGE: 'abandon_merge',
  // Uploading a book from a zip (sync.upload, workflow 7 §Uploading a book).
  // The Worker reads the zip as a git remote to pull from; the view (books.upload_ui)
  // picks the zip, renders the preview and sends the confirm. PREVIEW_UPLOAD
  // `{ target, bytes }` — `bytes` is the zip as an ArrayBuffer/Uint8Array (read
  // from the File on the main thread, crossing by structured clone as DOWNLOAD's
  // bytes cross the other way), `target` is `{ kind: 'new' }` (import as a new
  // book) or `{ kind: 'existing', bookId }` (merge / replace into a book the user
  // can save to). The Worker materialises a scratch repo under `/uploads/<id>`,
  // reads the uploader's uncommitted edits as one synthetic *changes from the
  // upload* commit, and classifies song by song WITHOUT writing to the target,
  // replying with UPLOAD_PREVIEW. A non-zip buffer, a CRC failure or a zip-slip
  // entry name is refused (ERROR, never a crash). IMPORT_UPLOAD `{ uploadId,
  // choice, perFile?, title?, author }` lands it on confirm — `choice` is
  // 'new_book' (the zip's history becomes a fresh local book's, or a folder/no
  // -history zip's one canonical first commit), 'latest_without_history' (the
  // escape hatch for history that holds conflict markers — the latest clean tree
  // as one first commit), 'merge' (the cifra-aware merge into the existing book,
  // the zip's ref as theirs) or 'replace' (a no-history zip into an existing book:
  // `perFile` names the matching files to replace, non-matching added, one ordinary
  // commit). A new book replies BOOK_CREATED; a clean merge/replace commits, pushes
  // and emits a SYNC fact; a colliding merge leaves the book `needs_you` (SYNC) for
  // the existing conflict session. CANCEL_UPLOAD `{ uploadId }` removes the scratch
  // repo. Nothing in the zip is executed; only repository paths are read.
  PREVIEW_UPLOAD: 'preview_upload',
  IMPORT_UPLOAD: 'import_upload',
  CANCEL_UPLOAD: 'cancel_upload',
  // Following an original (sync.fork_follow, workflow 11 §Following the
  // original). Bringing in is never automatic: a pass only counts (ORIGINAL).
  // PREVIEW_BRING_IN `{ bookId }` — under the fork's lock, fetch the original's
  // `link` (the shelf's `original` register) into `refs/remotes/original/main`
  // and classify song by song as an upload does, writing nothing to the fork;
  // replies BRING_IN_PREVIEW. BRING_IN `{ bookId, followId, note, author? }` —
  // merge that ref into `main` as a merge commit (never a fast-forward) carrying
  // `note` as its message, unsaved edits carried on top, push to the fork's own
  // remote and move the register's `followedAt`; replies BRING_IN_DONE. A
  // `followId` that no longer matches (a second preview, a pass that moved
  // `main`) is refused as `stale`. CANCEL_BRING_IN `{ bookId, followId }` drops
  // the fetched ref. The views are books.bring_in's and books.fork's.
  PREVIEW_BRING_IN: 'preview_bring_in',
  BRING_IN: 'bring_in',
  CANCEL_BRING_IN: 'cancel_bring_in',
});

// Events: Worker -> main. `READY` carries the Worker's persisted `meta`;
// `ERROR` carries a message and a code. The working-copy outcomes
// (storage.working_copy): `SAVED` (commit + whether the push landed),
// `DISCARDED`, and `SAVE_REFUSED` (a marked or unreadable file named, with the
// first marker line). `PREFERENCES` carries the home book's preferences.json as
// a flat map of `{value, at}` registers (shell.tokens defines the consumer; the
// producer that reads the home book is storage.preferences_surface). Later
// tasks add progress / completion kinds the same way.
export const EventKind = Object.freeze({
  READY: 'ready',
  ERROR: 'error',
  SAVED: 'saved',
  DISCARDED: 'discarded',
  SAVE_REFUSED: 'save_refused',
  PREFERENCES: 'preferences',
  // The home book's shelf.json surfaced (storage.shelf_surface): `{ books, local }`
  // — two nested maps of `{value, at}` registers. `books` is the shared books
  // keyed by book id (each a map of `label`/`link`/`position` registers); `local`
  // is this device's local-only books (each a map of `title`/`position`),
  // narrowed to the device's namespace (home-book-format §4.2, §7). The producer
  // that reads the home book is storage.shelf_surface; the search screen and the
  // future book-management screen read it for labels.
  SHELF: 'shelf',
  // The history outcomes (storage.history): SONG_LOG carries a song's filtered
  // version list, VERSION a version's exact bytes, BOOK_LOG the book's whole log,
  // and RESTORED `{ bookId, path, restored? }` so the UI can open the save sheet on
  // the song just restored into the working copy. A whole-version RESTORE_VERSION
  // omits `restored`; a block RESTORE_PART (songs.restore_part) sets it — `false`
  // when the restore brings nothing back, so the UI shows a word-carried notice
  // instead of opening an empty save sheet.
  SONG_LOG: 'song_log',
  VERSION: 'version',
  RESTORED: 'restored',
  BOOK_LOG: 'book_log',
  // The search index (storage.index). SEARCH_RESULTS carries a query's ranked
  // results — `{ query, results: [{ bookId, path, title, artist, score,
  // unsaved, voicedFor?, conflict? }] }`; `unsaved` is wired from the index's
  // location records now, `voicedFor`/`conflict` are the seam their owning
  // tasks (music / sync) fill (songs.search Decision 7). INDEX_STATUS carries a
  // per-book build state — `{ bookId, state }` where state is 'building' |
  // 'ready' — so the search screen can say a book is still loading (workflow 2
  // L159-162). Two kinds, not one, so results and status update their slices at
  // their own cadence (Decision 4).
  SEARCH_RESULTS: 'search_results',
  INDEX_STATUS: 'index_status',
  // The pre-typing browse (songs.search). BROWSE_RESULTS carries every indexed
  // location grouped by book — `{ books: [{ bookId, count, songs: [{ path,
  // title, artist, unsaved }] }] }` — for the "books as sections" listing
  // (workflow 2 L15-16). RECENTS carries the device-local recents list,
  // most-recent-first — `{ recents: [{ bookId, path, at }] }` — for the
  // "Recent" section (workflow 2 L13-20); it is never read from the home book.
  BROWSE_RESULTS: 'browse_results',
  RECENTS: 'recents',
  // A new local book was created (books.shelf, CREATE_BOOK): `{ bookId }`, the
  // minted id of the book just added. It rides alongside the SHELF re-surface
  // that adds the book to the slice; the book-management screen uses it to move
  // focus to the new book (workflow 7 L25, Decision 2). It carries no title —
  // the title reaches the view through the shelf slice (standing no-logging /
  // no-labels rule).
  BOOK_CREATED: 'book_created',
  // The per-book detail's act outcomes (books.online, workflow 7). BOOK_ONLINE
  // `{ previousBookId, bookId }` reports a successful put-online: the book's
  // on-device id changed from `previousBookId` (the local id) to `bookId` (the
  // adopted service id, Decision 3), so the open detail re-selects the book and
  // the SHELF re-surface that rides alongside shows it *On Estante · private*.
  // BOOK_ONLINE_REFUSED `{ bookId, reason }` reports a failed put-online, the
  // service create having been refused — `reason` is a word the view turns into
  // copy (never colour alone): 'quota' (413), 'signed_out' (401), 'offline' (no
  // network) or 'error'; nothing was written on the device (Decision 4).
  // BOOK_DOWNLOAD `{ bookId, bytes }` carries the zip as a `Uint8Array` (bytes
  // cross the Worker boundary cleanly) the main thread wraps in a Blob and saves
  // as a file. BOOK_REMOVED `{ bookId }` reports that a remove or delete
  // finished (the local clone is gone and the shelf register tombstoned), so the
  // view closes the detail; the SHELF re-surface drops the row. These are
  // transient command replies (like SAVED / NEW_SONG_READY), folded into
  // ephemeral view state, not reducer slices.
  BOOK_ONLINE: 'book_online',
  BOOK_ONLINE_REFUSED: 'book_online_refused',
  BOOK_DOWNLOAD: 'book_download',
  BOOK_REMOVED: 'book_removed',
  // Leave replies (books.leave). BOOK_LEFT `{ bookId }`: the membership ended
  // and, if the book was on this shelf, its clone is gone and its register
  // tombstoned; the view closes the detail and the reducer drops the book from
  // the `mine` slice (a left book is never offered again, Decision 4).
  // LEAVE_FAILED `{ bookId, reason }`: nothing changed — `reason` is a word,
  // 'network' (unreachable) or 'refused' (a 401 or a 409); the confirmation
  // says the person did not leave (Decision 7).
  BOOK_LEFT: 'book_left',
  LEAVE_FAILED: 'leave_failed',
  // Make-it-my-own replies (books.fork). BOOK_FORKED `{ previousBookId, bookId,
  // via }`: the book now lives under its fork's id `bookId` (`via` 'service' — the
  // service copied it — or 'own' — the device put its own copy online after
  // losing access); the SHELF re-surface that rides alongside shows the fork in
  // the original's place. The hosts holding the old id (the save sheet, the
  // editor, the file view, the detail) move to the new one. FORK_FAILED
  // `{ bookId, code, message }`: nothing changed on the device; `code` is a word
  // the view turns into copy — 'offline', 'quota' (413), 'signed_out' (401),
  // 'not_hosted' or 'error'. Transient command replies, like BOOK_ONLINE.
  BOOK_FORKED: 'book_forked',
  FORK_FAILED: 'fork_failed',
  // Sign-out replies (account.sign_out). SIGN_OUT_SURVEY `{ books }` carries one
  // record per shelf book — `{ id, title, kind, role, savesWaiting, unsavedSongs,
  // onEstante }` — for the dialog to warn about local-only work and offer a
  // download before a book only on this device is removed. SIGNED_OUT `{ mode }`
  // reports the local teardown is done (clones gone / migrated, shelf re-surfaced);
  // the main thread then POSTs /api/auth/signout and returns to the not-signed-in
  // state. Transient command replies, like BOOK_REMOVED (Decision 2).
  SIGN_OUT_SURVEY: 'sign_out_survey',
  SIGNED_OUT: 'signed_out',
  // Leaving reply (account.leaving, workflow 17 §cascade device-teardown).
  // LEFT_ESTANTE `{}` reports the local sweep after a DELETE /api/account 204 is
  // done — the account's books and the home book dropped, their shelf registers
  // tombstoned and index entries cleared — so the surface returns to its first-run,
  // not-signed-in state. A transient command reply, like SIGNED_OUT.
  LEFT_ESTANTE: 'left_estante',
  // Joining a shared book (books.add_by_link, workflow 1 §Invited, workflow 7).
  // BOOK_CLONED `{ bookId }` reports that an ADD_BY_LINK / ADD_MINE cloned the
  // book, wrote its shelf register (with the granted role) and indexed it; the
  // view opens it on its song list and the SHELF re-surface that rides alongside
  // shows it *On Estante* with the role word. NEED_ACCOUNT `{ token }` reports an
  // accept answered 401 — no session yet (the account-first gate, Decision 2); the
  // main thread shows the generic invited screen and the SignIn surface, then
  // re-sends ADD_BY_LINK with the same token on sign-in (accept is idempotent).
  // BOOK_REFUSED `{ reason }` reports a dead or full link — `reason` is a word the
  // view turns into copy (never colour alone): 'full' (409 book_full → "This book
  // is full"), 'dead' (409 invitation_withdrawn/expired/exhausted, or 404 →
  // "This link doesn't open a book"), or 'error' (offline/other); it names NO
  // book, id or owner (a dead link reveals nothing, workflow 1 §Invited). These
  // three are transient command replies (like BOOK_ONLINE / SAVED), folded into
  // ephemeral view state, not reducer slices. MINE `{ status, books }` is the
  // "mine on Estante" list in reply to LIST_MINE: `status` is 'ready' (with
  // `books: [{ id, label, gitUrl, role }]`, the account's off-shelf books),
  // 'signed_out' (a 401 — the sheet shows "Sign in to see them"), or 'error'; it
  // folds into the `mine` reducer slice the Add-a-book sheet reads.
  BOOK_CLONED: 'book_cloned',
  NEED_ACCOUNT: 'need_account',
  BOOK_REFUSED: 'book_refused',
  MINE: 'mine',
  // A song's working-copy text, in reply to OPEN_SOURCE (songs.editor,
  // Decision 4): `{ bookId, path, text }`. The editor loads it into its
  // CodeMirror buffer; the `source` slice keeps it per book and path.
  SOURCE: 'source',
  // A song's reading state, in reply to OPEN_SONG and re-surfaced after
  // SET_TRANSPOSITION / SET_VARIATION (songs.reading, Decision 2): `{ bookId,
  // path, transposition, variations }`. `transposition` is the signed semitone
  // offset (`0` the written key); `variations` is the per-tuning map
  // `{ [tuning]: label }` of the variations in use (home-book-format §4.5). The
  // `song` slice keeps it per book and path, like `source`, so each open song's
  // reading state re-surfaces on its own without disturbing another's. It carries
  // no song text (standing no-logging rule).
  SONG: 'song',
  // The per-file save preview, in reply to PREVIEW_SAVE (songs.save_sheet,
  // Decision 2): `{ bookId, previews: [{ path, title, changes, summary, isNew }] }`.
  // `changes` is the diff's ordered record list and `summary` its neutral-English
  // one-liner (cifra_js.diff); `title` is the working copy's title and `isNew`
  // whether the path has no committed version yet. The `savePreview` slice keeps
  // it per book for the save sheet and the discard confirm to render.
  SAVE_PREVIEW: 'save_preview',
  // A new song's target book and placeholder path are ready, in reply to
  // NEW_SONG (songs.new_song, Decision 2): `{ bookId, path }`. A transient
  // command reply, NOT a read model — the host folds it into ephemeral view
  // state ("which song is open" is the view's, Decision 5) and mounts the
  // editor on the returned book/path, so the editor's debounced WRITE has a
  // concrete destination from the first keystroke (SongEditor.jsx:113). It
  // adds no reducer slice; the host observes it through the store's event
  // subscription.
  NEW_SONG_READY: 'new_song_ready',
  // The file view (books.file_view, workflow 14). TREE carries the book's whole
  // working tree in reply to BOOK_TREE: `{ bookId, entries: [{ path, status }] }`
  // where status is 'unsaved' | 'new' | 'deleted' | 'conflict' | null (in step),
  // only the allowed kinds (`.git` and anything else excluded). The `tree` slice
  // keeps it per book. FILE_MOVED `{ bookId, fromPath, toPath }` and FILE_DELETED
  // `{ bookId, path }` are transient confirmations the view folds into ephemeral
  // state and reacts to by re-requesting BOOK_TREE (no reducer slice, like
  // NEW_SONG_READY / RESTORED). COMMIT_DIFF carries one commit's per-file texts
  // in reply to the COMMIT_DIFF command: `{ bookId, commit, files: [{ path,
  // status, before, after }] }`; the view runs the pure `lineDiff` over
  // before/after (songs.history Decision 6) — also transient, folded into the
  // open commit's view state.
  TREE: 'tree',
  FILE_MOVED: 'file_moved',
  FILE_DELETED: 'file_deleted',
  COMMIT_DIFF: 'commit_diff',
  // Setlists (books.setlists, workflow 12). SETLISTS carries every loaded book's
  // setlists in reply to LIST_SETLISTS: `{ setlists: [{ bookId, path, title,
  // count }] }`, folded into the `setlists` slice the Setlists destination
  // reads. SETLIST_UPDATED `{ bookId, setlistPath, path, copied }` confirms an
  // ADD_TO_SETLIST landed in the working copy — a TRANSIENT event, like
  // FILE_MOVED: the view observes it (to re-list and show the unsaved state) and
  // it carries no reducer slice.
  SETLISTS: 'setlists',
  SETLIST_UPDATED: 'setlist_updated',
  // The instrument surface (music.instruments, workflow 15): the whole roster
  // projected from the home book's instruments.json, the resolved in-use
  // instrument (its id, or null for the implicit standard guitar), the standard
  // guitar fallback, and the per-instrument saved shapes — `{ instruments,
  // inUseId, standard }`. A whole-slice replace folded by the reducer, re-emitted
  // on every instrument mutation and on SYNC_HOME. The value shape of
  // instruments.json/shapes.json is this task's (home-book §1.2, §4.3, §4.4); the
  // producer that reads the home book and projects it is `instruments.js`.
  INSTRUMENTS: 'instruments',
  // A per-book sync fact (sync.engine, workflow 8 §What the shelf says): the
  // single source of sync truth is the Worker, which emits a book's state as it
  // moves through a pass; the shelf renders it (sync.states) — the engine ships
  // facts, not presentation (Decision 5). `{ bookId, phase, savesWaiting?,
  // lastInStep?, at }` where `phase` is a word (never colour alone): 'syncing'
  // (a pass is in flight, or a lost race outlasted its retries), 'in_step'
  // (nothing to do, or the push landed), 'saves_waiting' (local commits could
  // not go up — offline or the service unreachable), 'offline' (the change
  // check / fetch could not reach the service), 'needs_you' (a merge conflict —
  // the book halts for sync.conflicts), 'gone' (the caller is no longer a
  // member — sync.lost_access), 'cannot_save' (the push was refused as a
  // reader's, `403 forbidden` — still a member, fetched and read, its saves
  // waiting for the fork; books.fork, carrying `savesWaiting`) or 'taken_down' (the service removed the book for
  // a copyright notice; still a member — books.notice_surface, carrying the
  // operator's reason as `reason`). `savesWaiting` counts the local-ahead commits
  // for the "N saves waiting" word; `lastInStep` is the instant the book was last
  // in step; `reason` is the take-down message on a `taken_down` fact. A book an
  // event does not touch keeps its slice reference.
  SYNC: 'sync',
  // A clean merge landed on a songbook, per changed song file
  // (sync.read_in_place, workflow 8 §"A song open while it changes"; DIRECTION
  // §3.7 L423-424, which anticipates "a merge landing" as its own message):
  // `{ bookId, changed: [{ path, author, commit }] }`. Each `path` is a
  // `*.cifra.md` whose bytes moved between the pre-merge local head and the merged
  // head; `author` is the incoming commit's display name (the person the reader
  // is about to see — *updated by Ana* — not the device's own merge identity,
  // Decision 5); `commit` is that commit's oid (the "see what changed" history
  // link's target). A TRANSIENT event, like RESTORED / FILE_MOVED: it adds no
  // reducer slice — the open reading view observes it with `useWorkerEvent` and
  // re-issues OPEN_SOURCE for its own open path, so the merged text flows through
  // the `source` slice on demand (Decisions 1, 2). Emitted only for songbooks
  // (the home book re-surfaces through PREFERENCES / SHELF / INSTRUMENTS) and
  // never when the merge changed nothing. A song whose unsaved working text was
  // re-merged under the incoming version (sync.unsaved: no longer deferred, now
  // merged under the edit) is named here the same way — it is the fact the
  // deferred editor view (songs.edit_in_place) consumes to show the merged
  // working text and say what came in (workflow 8 §"A song open while it
  // changes"). It carries path, author name and commit oid only — never song
  // text (standing rule).
  MERGED: 'merged',
  // The recomputed in-progress-merge model for one paused book (sync.conflicts,
  // workflow 9): emitted on OPEN_CONFLICTS and after every RESOLVE_CONFLICT, and
  // cleared (payload with no conflicts) when the merge is committed or abandoned.
  // `{ bookId, inProgress, songs, deleted, incoming, savesHeld }`:
  //   - `inProgress` is false once the book is settled/abandoned (the panel and
  //     the save guard read this to stand down);
  //   - `songs` is one entry per song still in conflict, in book order:
  //     `{ path, title, count, author, marked, items, markedLines }` — the
  //     per-song model from conflict-model.js (`items` the regions in musical
  //     terms, `markedLines` the ours lines the reading view marks);
  //   - `deleted` is one entry per deleted-vs-edited song: `{ path, title,
  //     author, deleted }` (which side deleted it);
  //   - `incoming` is the clean-merged files that came in with the merge, for the
  //     *came in … already here* list: `{ path, title, author, summary }`;
  //   - `savesHeld` are the book's unsaved songs whose save is held until the
  //     merge settles (the *saving in this book* card): `{ path, title }`.
  // It carries titles, authors, chord/bar texts and marker lines, never whole
  // song text beyond the conflicted regions the screens must draw; no logging
  // (standing rule). A per-book reducer slice (`conflicts`), folded by bookId.
  CONFLICTS: 'conflicts',
  // The upload preview, in reply to PREVIEW_UPLOAD (sync.upload, workflow 7
  // §The preview): what the upload would do, song by song, before anything is
  // written. `{ uploadId, target, branch, hasHistory, sharedHistory,
  // historyMarkers?, previews: [{ path, title, status, changes?, summary?,
  // line? }] }` — `uploadId` names the materialised scratch repo so IMPORT /
  // CANCEL act on it without re-reading the zip (Decision 8); `branch` is the
  // zip's checked-out branch (null for a no-history zip); `hasHistory` /
  // `sharedHistory` drive the new-book / merge / replace copy; `historyMarkers`
  // (`{ commit, path, line, latestClean }`) is present only when the zip's history
  // holds a conflict marker line, offering the latest-without-history escape hatch.
  // Each preview's `status` is a word: 'added', 'changed' (with the diff `summary`
  // and `changes`), 'conflict', 'replace' (no-history replace-with-the-uploaded
  // -version, with its diff) or 'unresolved' (a marked working-tree file left out,
  // `line` the 1-based first marker line). It carries titles and musical summaries,
  // never whole song text (standing rule). The target book is not mutated. The
  // `uploadPreview` ephemeral view state the books.upload_ui screen renders.
  UPLOAD_PREVIEW: 'upload_preview',
  // A fork's original, learned on a sync pass (sync.fork_follow, workflow 11
  // lines 42-46, 51-54): `{ bookId, newSaves, gone }` for every shelf book whose
  // `original` register is present and not yet gone — `newSaves` the number of
  // saves on the original the fork does not have (0 when the change check said
  // nothing, so a count clears after a bring-in), `gone` true once the original
  // is no longer shared with the user (following ends; the register's `goneAt`
  // records it). An unreachable change check emits nothing — the last facts
  // stand. Never touches the fork's own SYNC phase. Folded into the `originals`
  // reducer slice by bookId.
  ORIGINAL: 'original',
  // The bring-in preview, in reply to PREVIEW_BRING_IN: `{ bookId, followId,
  // original: { bookId, title }, newSaves, previews }` — `previews` the upload's
  // row shape `{ path, title, status, changes?, summary?, line? }`, `followId`
  // the token BRING_IN / CANCEL_BRING_IN quote. `{ bookId, gone: true }` when
  // the original refused the fetch (removed, deleted, taken down — following
  // ends, the fork untouched); `{ bookId, error: 'unreachable' }` when it could
  // not be reached (offline, 5xx), nothing recorded. Never song text.
  BRING_IN_PREVIEW: 'bring_in_preview',
  // The bring-in outcome, in reply to BRING_IN: `{ bookId, kind: 'merged',
  // pushed }`, `{ bookId, kind: 'needs_you' }` (a conflict handed to workflow 9,
  // its incoming ref `refs/remotes/original/main`) or `{ bookId, kind: 'stale' }`.
  BRING_IN_DONE: 'bring_in_done',
});

// Build a command envelope (main -> Worker). `payload` is any
// structured-cloneable value; `kind` is open so callers in later tasks pass
// kinds this module does not yet name.
export function command(kind, payload = {}) {
  return { v: PROTOCOL_VERSION, dir: COMMAND, kind, payload };
}

// Build an event envelope (Worker -> main), same shape, opposite direction.
export function event(kind, payload = {}) {
  return { v: PROTOCOL_VERSION, dir: EVENT, kind, payload };
}
