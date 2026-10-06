// FirstRun.jsx — the search front door's first-run empty state (account.first_run,
// workflow 1 §Cold / §My songs; mockup W01). A cold device — an empty shelf and
// no recents — lands on search and sees, instead of a blank screen: what a book
// is, the four ways to fill the shelf (write a song; add a book by its link;
// sign in; open the example book — in workflow-1 order), and My songs listed
// from the start so writing a song never has to ask where it goes.
//
// Presentational only (refinement Decision 1): it receives the four callbacks
// and reads nothing from the store itself — SearchScreen owns the branch and the
// slices. Every way-in is a React Aria Button, keyboard- and screen-reader-
// operable; its state is carried by a word ("No songs yet"), never colour alone
// (DIRECTION §3.7; mockups README L26). The decorative glyphs are aria-hidden and
// named by their row's text.

import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { MY_SONGS } from './first-run.js';

// The pencil on the "write a song" row (W01 L44); decorative.
function WriteIcon() {
  return (
    <svg
      className="way-icon"
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
    >
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </svg>
  );
}

// The link on the "add a book by its link" row (W01 L45); decorative.
function LinkIcon() {
  return (
    <svg
      className="way-icon"
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
    >
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  );
}

// The person on the "sign in" row (W01 L46); decorative.
function SignInIcon() {
  return (
    <svg
      className="way-icon"
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
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

// The books on the "open the example book" row (W01 L47); decorative.
function BooksIcon() {
  return (
    <svg
      className="way-icon"
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
    >
      <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-.8 3 15.6-3.5.8z" />
    </svg>
  );
}

// One way-in: a RAC Button styled as a `.row`, named by its title text, with a
// supporting meta line (workflow 1 §Cold). Activating it (click or keyboard)
// calls its seam.
function Way({ icon, name, meta, onPress }) {
  return (
    <Button className="row" onPress={onPress}>
      {icon}
      <span className="grow">
        <span className="name">{name}</span>
        <span className="meta">{meta}</span>
      </span>
    </Button>
  );
}

export default function FirstRun({
  onWriteSong = () => {},
  onAddBook = () => {},
  onSignIn = () => {},
  onOpenExampleBook = () => {},
}) {
  return (
    <div className="first-run">
      <section className="search-section" aria-labelledby="first-run-heading">
        <div className="first-run-intro">
          <h2 className="t-h2" id="first-run-heading">
            {t('firstRun.heading')}
          </h2>
          <p className="t-body first-run-body">{t('firstRun.body')}</p>
        </div>
        <div className="list first-run-ways">
          <Way
            icon={<WriteIcon />}
            name={t('firstRun.writeSong')}
            meta={t('firstRun.writeSongMeta')}
            onPress={() => onWriteSong()}
          />
          <Way
            icon={<LinkIcon />}
            name={t('firstRun.addByLink')}
            meta={t('firstRun.addByLinkMeta')}
            onPress={onAddBook}
          />
          <Way
            icon={<SignInIcon />}
            name={t('firstRun.signIn')}
            meta={t('firstRun.signInMeta')}
            onPress={onSignIn}
          />
          <Way
            icon={<BooksIcon />}
            name={t('firstRun.openExample')}
            meta={t('firstRun.openExampleMeta')}
            onPress={onOpenExampleBook}
          />
        </div>
      </section>

      <section className="search-section" aria-labelledby="first-run-books">
        <div className="section-label">
          <h2 className="t-h3" id="first-run-books">
            {t('search.books')}
          </h2>
        </div>
        {/* My songs is listed from the start, but not created until the first
            song is written into it (workflow 1 §My songs); so it is a plain
            listed entry here, not an interactive control and not a stored shelf
            entry (Decision 4). Its state is a word, "No songs yet". */}
        <div className="list">
          <div className="row">
            <span className="grow">
              <span className="name">{t(MY_SONGS.labelKey)}</span>
              <span className="meta">{t(MY_SONGS.metaKey)}</span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
