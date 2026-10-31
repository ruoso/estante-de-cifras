// The help's pages and the tour's cards (workflow 18). Pure: which topics and
// cards there are, in order. Their copy is i18n's — `help.pages.<id>`
// ({ title, summary, points[] }) and `help.tour.<id>` ({ title, body }) — so it
// ships with the app and opens offline in every language.

/** Every page's help, in the order *Other pages* lists them. */
export const HELP_PAGES = Object.freeze([
  'search',
  'books',
  'book',
  'setlists',
  'setlist',
  'song',
  'editor',
  'arrange',
  'wizard',
  'history',
  'conflicts',
  'files',
  'sharing',
  'explorer',
  'instruments',
  'account',
  'addBook',
]);

/**
 * The tour's cards, in order. `picture` names the app's own drawing a card
 * shows, where one says it faster than words: a chart line or a chord diagram.
 */
export const TOUR_STEPS = Object.freeze([
  { id: 'welcome' },
  { id: 'search' },
  { id: 'read', picture: 'chart' },
  { id: 'instrument', picture: 'diagram' },
  { id: 'arrange', picture: 'tap' },
  { id: 'edit' },
  { id: 'setlists' },
  { id: 'offline' },
  { id: 'help' },
]);

/** Whether a page has help, so a stray id never opens an empty panel. */
export function isHelpPage(id) {
  return HELP_PAGES.includes(id);
}
