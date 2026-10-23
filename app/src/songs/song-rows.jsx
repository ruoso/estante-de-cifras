// song-rows.jsx — the rows a list of songs is made of, shared by the search
// screen (songs.search) and a book's page (books.book_page): one song, one
// setlist, the badges a song carries, and the glyphs they draw. Every badge
// carries a word, never colour alone (mockups README L26); every row is a RAC
// Button with a keyboard path and an accessible name.

import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { canSaveFor } from '../books/book-display.js';
import { songTitle, folderOf } from './search-query.js';

// The NUL join key for a location (bookId + path) — the same separator the
// index uses; it cannot occur in a book id or a path.
export const keyOf = (bookId, path) => `${bookId}\u0000${path}`;

// The magnifier drawn in the box (W02 lines 35-37); decorative, named by the
// field's label.
export function SearchIcon() {
  return (
    <svg
      className="icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

// Whether a new song may be started into a book from its section (workflow 3
// §Which book L28): a shared book only when the user can push to it
// (`canSaveFor`: owner or editor), a local book (in `shelf.local`, including *My
// songs*) always. A book with no shelf entry is treated as local/on-device.
export function canWriteTo(shelf, bookId) {
  const shared = shelf?.books?.[bookId];
  if (shared) return canSaveFor('shared', shared) === true;
  return true;
}

// The plus on a "create / new song" affordance (W03 Create row, "new song in
// this book"); decorative, named by its row name or the button's aria-label.
export function CreateIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="search-create-icon"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// The badges a result carries, each labelled with a word (mockups README L26,
// acceptance 4). Order mirrors the mockup: voiced, then unsaved/conflict. Only
// the flags that apply render; `voicedFor`/`conflict` are the seam their owning
// tasks fill (Decision 7), so they simply stay absent until then.
export function Badges({ item, instrument }) {
  const badges = [];
  if (item.voicedFor) {
    badges.push(
      <span key="voiced" className="badge voiced">
        {t('search.voicedFor', { instrument })}
      </span>,
    );
  }
  if (item.unsaved) {
    badges.push(
      <span key="unsaved" className="badge unsaved dot">
        {t('search.unsaved')}
      </span>,
    );
  }
  if (item.conflict) {
    badges.push(
      <span key="conflict" className="badge conflict dot">
        {t('search.conflict')}
      </span>,
    );
  }
  if (!badges.length) return null;
  return <span className="badges">{badges}</span>;
}

// Where a row's song or setlist lives: its book, and its folder when it is not at
// the root (workflow 2 L46-49). On a book's own page the book goes without
// saying (`bookLabel` null), so only a folder is named (books.book_page).
function whereOf(path, bookLabel) {
  const folder = folderOf(path);
  if (!bookLabel) return folder ? `${folder}/` : '';
  return folder ? t('search.where', { book: bookLabel, folder }) : bookLabel;
}

// One song row — a result, a recent, or a song inside a book section. Activating
// it (click or keyboard, via RAC Button) opens the song (workflow 2: "Opening a
// result shows the song to be read"); the reading view is `songs.reading`, so
// here it is the `onOpen` seam. Shows the title (or the file name for a titleless
// song), where it lives (book, and folder when not at the root), and badges.
// A null `bookLabel` leaves the book out (a book's page).
export function SongRow({ item, bookLabel, instrument, onOpen, onAddToSetlist }) {
  const where = whereOf(item.path, bookLabel);
  // The row says the title and artist, and where it lives: book, and folder
  // only when not at the root (workflow 2 L46-49). The artist leads the meta
  // line, then the location.
  const meta = [item.artist, where].filter(Boolean).join(' · ');
  const title = songTitle(item.title, t('newSong.untitled'));
  // Add-to-setlist is on every song (workflow 12 §Building one): a trailing icon
  // button beside the open action. A button cannot nest inside a RAC Button, so
  // the row is a flex container with the open Button and this one as siblings
  // (the BookSection header precedent).
  return (
    <div className="row search-row">
      <Button
        className="search-row-open"
        onPress={() => onOpen({ bookId: item.bookId, path: item.path })}
      >
        <span className="grow">
          <span className="name">{title}</span>
          <span className="meta">{meta}</span>
        </span>
        <Badges item={item} instrument={instrument} />
      </Button>
      {onAddToSetlist ? (
        <Button
          className="btn icon search-add-setlist"
          aria-label={t('search.addToSetlist', { title })}
          onPress={() =>
            onAddToSetlist({ bookId: item.bookId, path: item.path, title: item.title || null })
          }
        >
          <AddToSetlistIcon />
        </Button>
      ) : null}
    </div>
  );
}

// One setlist row in the typed-query results (books.setlist_search, workflow 12
// §The file L34: "Setlists are found by the same search as songs, marked as
// setlists. Opening one lists its songs."). A setlist is MARKED by the word
// "Setlist" (mockups README L26 — status by a word, never colour alone), shows
// its title and where it lives (book, and folder when not at the root — never
// the file name, DIRECTION §4 L470), and is NOT offered Add-to-setlist (that is
// for songs). The badge sits inside the open Button, so the button's accessible
// name carries the title AND that it is a setlist (acceptance 2). Activating it
// routes to the existing setlist view through `onOpenSetlist` (Decision 5).
export function SetlistRow({ item, bookLabel, onOpen }) {
  const where = whereOf(item.path, bookLabel);
  const title = songTitle(item.title, t('newSong.untitled'));
  return (
    <div className="row search-row">
      <Button
        className="search-row-open"
        onPress={() => onOpen({ bookId: item.bookId, path: item.path })}
      >
        <span className="grow">
          <span className="name">{title}</span>
          <span className="meta">{where}</span>
        </span>
        <span className="badges">
          <span className="badge setlist">{t('search.setlist')}</span>
        </span>
      </Button>
    </div>
  );
}

// The Add-to-setlist glyph on a song row — a list with a plus.
export function AddToSetlistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h10M4 12h10M4 18h7M17 15v6M14 18h6" />
    </svg>
  );
}
