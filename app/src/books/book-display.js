// book-display.js — the pure display derivation for the book-management screen
// (books.shelf). It turns one book's register map (from the `shelf` slice:
// `{ label|title, link, position, … }` registers) into what a row shows: its
// title, where it lives, whether the user can save, and its sync state; and it
// orders the shelf by each book's `position`. No React, no i18n, no I/O — the
// view maps these tokens to copy through `t()` and renders them (DIRECTION §3.7
// L410-414). Pinning the format: home-book-format §4.2 (shelf.json), §5.3
// (tombstones). Pinning the design: workflow 7 L14-21.

// A register is the §3 `{ value, at }` envelope; its `value` is `null` for a
// tombstone (§5.3). A register's displayable value is its `value` when it is a
// non-empty, non-null value, else nothing.
function registerValue(register) {
  const value = register?.value;
  return value === null || value === undefined || value === '' ? undefined : value;
}

/**
 * A book's displayed title: the shelf label (a shared book's `label` register)
 * or title (a local book's `title` register) when present and non-tombstone,
 * else the opaque `bookId` — the same fallback the search screen uses
 * (SearchScreen.jsx:335), extended to local titles (Decision 3). A README-heading
 * fallback for a label-less shared book is deferred to when shared books exist
 * (Decision 4); in M2 a local book always carries a `title`. Pins workflow 7
 * L16-18; home-book-format §5.3.
 *
 * @param {Object} book one book's register map from the `shelf` slice
 * @param {string} bookId the opaque id, the fallback
 * @returns {string}
 */
export function titleFor(book, bookId) {
  return registerValue(book?.label) ?? registerValue(book?.title) ?? bookId;
}

/**
 * Where a book lives, as a copy key the view translates (never colour alone,
 * mockups README L26): a `local` book is `onDevice`, a shared (`books`) book is
 * `onEstante`. Pins workflow 7 L19.
 *
 * @param {'local' | 'shared'} kind which shelf map the book is in
 * @returns {'onDevice' | 'onEstante'}
 */
export function whereFor(kind) {
  return kind === 'local' ? 'onDevice' : 'onEstante';
}

/**
 * Whether the user can save to a book: a `local` book is always savable; a
 * shared book's role is the membership seam (Decision 5) — `editor` can save,
 * `reader` cannot, and an absent role is `null` (the seam is not filled yet, so
 * the view renders no role word). Pins workflow 7 L20.
 *
 * @param {'local' | 'shared'} kind
 * @param {Object} book one book's register map
 * @returns {boolean | null} true (can save) / false (reader) / null (unknown)
 */
export function canSaveFor(kind, book) {
  if (kind === 'local') return true;
  const role = book?.role?.value;
  if (role === 'editor') return true;
  if (role === 'reader') return false;
  return null;
}

/**
 * A book's meta line, the same on its shelf row and on the bar above its songs
 * (books.row_opens_songs): `{where} · {role} · {count} songs`, or `… · still
 * loading` while the book's index is building or no count has arrived yet. The
 * role is left out when it is unknown. Pins workflow 7 L19-23.
 *
 * @param {'local' | 'shared'} kind
 * @param {Object} book one book's register map
 * @param {{ count?: number, building?: boolean, t: Function }} opts the
 *   `songCounts` entry, whether the `index` says *building*, and the translator
 * @returns {string}
 */
export function bookMetaFor(kind, book, { count, building = false, t }) {
  const where = t(`books.${whereFor(kind)}`);
  const canSave = canSaveFor(kind, book);
  const role = canSave === true ? t('books.canSave') : canSave === false ? t('books.reader') : null;
  const songs =
    building || typeof count !== 'number' ? t('search.stillLoading') : t('search.songCount', { count });
  return [where, role, songs].filter(Boolean).join(' · ');
}

// A book's sync state is no longer read from the `shelf` slice: it was a
// placeholder over a `book.sync.value` register `shelf_surface` never populated.
// The live source is the engine's `sync` reducer slice, derived to a word by
// `sync-display.js` (sync.states), which the Books screen renders directly. The
// retired `syncStateFor` lived here (books.shelf Decision 5); its render-when-
// present contract is now `syncDisplayFor`.

// Whether a book's register map should still show a row. A book put online or
// removed from the shelf has every one of its registers TOMBSTONED (an explicit
// `null`, §5.3) by books.online, so it must not show: a migrated local book
// would otherwise ghost beside its new hosted entry, and a removed book would
// linger. The signal is "has registers, and every one is a tombstone/empty" —
// a book with no registers yet (`{}`, a shared book surfaced before its label)
// is NOT removed and keeps its row, and a label-less book with a live
// `position` keeps its row. So the discriminator is a tombstone, never a merely
// absent register.
function isVisible(book) {
  if (!book || typeof book !== 'object') return true;
  const keys = Object.keys(book);
  if (keys.length === 0) return true;
  return keys.some((key) => registerValue(book[key]) !== undefined);
}

// Compare two book ids for a stable, deterministic order (ties on position).
function byId(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Every book on the shelf, ordered for display: the shared books (`shelf.books`)
 * and this device's local books (`shelf.local`, already narrowed to the device
 * by the surface, §7), ascending by each book's `position` register, ties broken
 * stably by id, and a book with no `position` last (also stable by id). Pins the
 * shelf order (home-book-format §4.2 `position`), books.shelf acceptance 2.
 *
 * @param {{ books?: Object, local?: Object }} shelf the `shelf` slice
 * @returns {Array<{ id: string, book: Object, kind: 'local' | 'shared' }>}
 */
export function orderedBooks(shelf) {
  const entries = [];
  const books = shelf?.books ?? {};
  const local = shelf?.local ?? {};
  for (const id of Object.keys(books)) {
    if (isVisible(books[id])) entries.push({ id, book: books[id], kind: 'shared' });
  }
  for (const id of Object.keys(local)) {
    if (isVisible(local[id])) entries.push({ id, book: local[id], kind: 'local' });
  }
  entries.sort((a, b) => {
    const pa = a.book?.position?.value;
    const pb = b.book?.position?.value;
    const na = typeof pa === 'number';
    const nb = typeof pb === 'number';
    if (na && nb) return pa === pb ? byId(a.id, b.id) : pa - pb;
    if (na) return -1; // a has a position, b does not: a first
    if (nb) return 1;
    return byId(a.id, b.id); // neither has a position: stable by id
  });
  return entries;
}

/**
 * A fork's `original` register value — `{ bookId, title, link, followedAt,
 * goneAt? }` (home-book-format §4.2) — or `null` for a book that is not a fork
 * (or whose register was tombstoned). Pins workflow 11 §What a fork is.
 *
 * @param {Object} book one book's register map
 * @returns {{ bookId: string, title?: string, goneAt?: string } | null}
 */
export function originalOf(book) {
  const value = registerValue(book?.original);
  return value && typeof value === 'object' && typeof value.bookId === 'string' ? value : null;
}

/**
 * What a fork's shelf row says about its original (books.fork; W11 board #2 and
 * #4 :153), as tokens the view words: `from` — the original's title for the
 * *from {original}* line; `newSaves` — how many saves the original has that the
 * fork does not, for *{original} has N new saves* (0 draws nothing, and nothing
 * once following ended); `gone` — following ended, for the *original no longer
 * shared* badge: the register's durable `goneAt`, or the live `ORIGINAL` fact
 * saying so before the register re-surfaces. `null` for a book that is not a fork.
 *
 * @param {Object} book one book's register map
 * @param {{ newSaves?: number, gone?: boolean } | undefined} counted the fork's
 *   entry in the `originals` slice
 * @returns {{ from: string, newSaves: number, gone: boolean } | null}
 */
export function forkLineFor(book, counted) {
  const original = originalOf(book);
  if (!original) return null;
  const gone = Boolean(original.goneAt) || counted?.gone === true;
  const n = counted?.newSaves;
  return {
    from: original.title || original.bookId,
    newSaves: !gone && Number.isInteger(n) && n > 0 ? n : 0,
    gone,
  };
}

/**
 * Whether a Save in `bookId` can go there, and the book's label — what every
 * save sheet host passes (books.fork Constraint 7): `canSave` is `canSaveFor`
 * over the book's shelf entry (`false` for a reader's book, which opens the
 * make-it-your-own sheet), and a book with no shelf entry is a device book the
 * user can save to. Pins workflow 4 §A book the user cannot push to.
 *
 * @param {{ books?: Object, local?: Object }} shelf the `shelf` slice
 * @param {string} bookId
 * @returns {{ canSave: boolean | null, label: string }}
 */
export function saveTargetFor(shelf, bookId) {
  const entry = orderedBooks(shelf).find((e) => e.id === bookId);
  return {
    canSave: entry ? canSaveFor(entry.kind, entry.book) : true,
    label: titleFor(entry?.book, bookId),
  };
}

/**
 * The day a fork last brought its original's saves in, as the gone card words it
 * (books.bring_in Constraint 7; W11 board #4 :169 *last brought in on 28
 * September*): day and long month in `locale`, with the year only when it is not
 * `now`'s year. `iso` is the register's `followedAt` (the fork time, or the last
 * bring-in); a missing or unparsable one gives `null`, and the card drops the
 * date clause. The app's `en` is the boards' English, which writes the day
 * before the month (*28 September*, *28 Sep*), so it is formatted as `en-GB`;
 * every other locale formats as itself. Pins workflow 11 §When the original
 * goes away.
 *
 * @param {string | undefined} iso
 * @param {string} locale a BCP 47 tag (`currentLocale()`)
 * @param {Date | number} [now]
 * @returns {string | null}
 */
export function broughtInOn(iso, locale, now = Date.now()) {
  if (typeof iso !== 'string' || !iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const options = { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) };
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', options).format(date);
  }
}

// ---- a new device (account.new_device, workflow 13) -----------------------

// The kinds a device may write for itself (home-book-format §4.2).
const DEVICE_KIND_TOKENS = new Set([
  'iphone',
  'ipad',
  'android-phone',
  'android-tablet',
  'mac',
  'windows',
  'linux',
  'chromebook',
]);

/**
 * What a book's row says while the shelf fills (workflow 13 §What comes down;
 * W13 board frame 2): the state as a word — *ready*, *cloning 45%*, *waiting* —
 * never colour alone, the meta line under the title, the badge class, and the
 * percent a progress bar draws while cloning. `null` for a book that is not
 * filling. `t` is injected, so this stays free of i18n state (like
 * `syncDisplayFor`).
 *
 * @param {{ state: string, progress?: number|null, songs?: number|null } | undefined} entry
 *   the book's entry in the `fill` slice
 * @param {{ t: Function }} deps
 * @returns {{ state: string, word: string, meta: string|null, cls: string, percent: number|null } | null}
 */
export function fillDisplayFor(entry, { t }) {
  switch (entry?.state) {
    case 'ready':
      return {
        state: 'ready',
        word: t('books.fillReady'),
        meta: typeof entry.songs === 'number' ? t('books.fillReadyMeta', { count: entry.songs }) : null,
        cls: 'ok',
        percent: null,
      };
    case 'cloning': {
      const raw = typeof entry.progress === 'number' ? entry.progress : 0;
      const percent = Math.max(0, Math.min(100, Math.round(raw)));
      return {
        state: 'cloning',
        word: t('books.fillCloning', { percent }),
        meta: t('books.fillCloningMeta'),
        cls: '',
        percent,
      };
    }
    case 'waiting':
      return { state: 'waiting', word: t('books.fillWaiting'), meta: t('books.fillWaitingMeta'), cls: '', percent: null };
    default:
      return null;
  }
}

/**
 * The words of an *only on your …* row (workflow 13 §Books that were only on the
 * other device; W13 board frame 2): *Only on your iPhone: Rascunhos* / *Put it
 * online there to have it here.* The device is named by its kind, in this
 * reader's language; a kind it cannot tell reads *another device*.
 *
 * @param {{ title: string, kind: string }} entry one item of the shelf's `elsewhere`
 * @param {{ t: Function }} deps
 * @returns {{ line: string, help: string }}
 */
export function elsewhereCopyFor(entry, { t }) {
  const kind = entry?.kind;
  const line = DEVICE_KIND_TOKENS.has(kind)
    ? t('books.onlyOn', { device: t(['newDevice', 'kind', kind]), title: entry.title })
    : t('books.onlyOnOther', { title: entry?.title ?? '' });
  return { line, help: t('books.onlyOnHelp') };
}

/**
 * How this device names itself (*This tablet has its own My songs*, W13 board
 * frame 3), from its kind token; *This device* when it cannot tell.
 *
 * @param {string} kind
 * @param {{ t: Function }} deps
 * @returns {string}
 */
export function thisDeviceFor(kind, { t }) {
  return t(['newDevice', 'thisKind', DEVICE_KIND_TOKENS.has(kind) ? kind : 'other']);
}
