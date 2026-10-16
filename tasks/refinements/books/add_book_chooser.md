# books.add_book_chooser — Add a book as a four-way chooser

## TaskJuggler entry

[`tasks/65-books.tji`](../../65-books.tji), `task add_book_chooser` (L156-160):

> The W07 board opens Add a book as a chooser of four ways in (new, by link,
> mine on Estante, upload); the app shows four inline forms. The upload
> preview is a side pane whose mode switch wraps. Under Mine on Estante the
> board offers No passkey here? Email me a link, which needs a recovery email
> to exist (account.recovery_email). Source: UI pairwise audit 2026-10-14 (e2e
> mockup() screenshots vs rendered boards, audit/out). Tests: behavior (each
> way in from the chooser; axe); e2e-web (each way on the three viewports,
> mockup W07#1-4).

Milestone: `milestones.m5_complete` (`tasks/99-milestones.tji` L44), with the
other UI-audit polish leaves.

## Effort estimate

1d. The work is:

- the Add-a-book sheet rebuilt as a chooser with two in-sheet steps;
- a `initialStep` prop on `SignIn` and a sign-in seam for the Mine row;
- the upload preview lifted from the Books panel to a full-screen surface in
  `AppShell`, and its mode switch kept on one row;
- the behavior and e2e-web tests that follow.

## Repository

The work lands in **estante-de-cifras**, not under `cifra.md/`:

- `app/src/books/BooksScreen.jsx` (`AddBookSheet` L440-625, `MineList`
  L363-438, the `upload` early return L882-902), `app/src/books/books.css`;
- `app/src/books/upload-preview.css` (the mode switch, L24-54);
- `app/src/account/SignIn.jsx` (an `initialStep` prop);
- `app/src/shell/AppShell.jsx` (the upload surface and the Mine sign-in seam);
- `app/src/i18n/locales/{en,pt-BR,es-419,it}.js` (the chooser's copy);
- tests: `app/src/books/BooksScreen.behavior.test.jsx`,
  `app/src/books/MineOnEstante.behavior.test.jsx`,
  `app/src/books/UploadPreview.behavior.test.jsx`,
  `app/src/account/SignIn.behavior.test.jsx`,
  `app/src/shell/AppShell.routing.behavior.test.jsx`;
  `e2e/web/tests/books.spec.js`, `e2e/web/tests/add-by-link.spec.js`,
  `e2e/web/tests/upload.spec.js`, `e2e/web/tests/online.spec.js`, and the
  journeys in `e2e/web/lib/journeys.js`, `journeys-files.js`,
  `journeys-account.js`, plus the other specs that open the sheet
  (`leave-book.spec.js`, `portal.spec.js`).

**Design delta (rides in this task's commit):** `docs/workflows/07-add-a-book.md`
L32-38, a paragraph after the four ways in. It says that the sheet is a
chooser, that New book and By link open their field in the sheet with a way
back, that Upload goes straight to the zip and a full-screen preview, and what
the Mine row offers signed out. The board draws only the chooser (W07 #2), so
the workflow now says where each row leads.

## Inherited dependencies

- `books.add_by_link`: **settled** (`complete 100`). It delivered the sheet's
  By link and Mine on Estante sections, `ADD_BY_LINK`, `LIST_MINE`,
  `ADD_MINE`, `booksNotOnShelf`, and the `mine` slice
  (`tasks/refinements/books/add_by_link.md`, Decisions 2-5).
- `books.upload_ui`: **settled**. It delivered `UploadPreview.jsx`, the
  sheet's Upload row and the fixtures `e2e/web/fixtures/upload/{book,merge}.zip`
  (`tasks/refinements/books/upload_ui.md`, Decisions 1-6).
- Also settled, though not in `depends`:
  - `account.recovery_email` (`complete 100`): an account can hold a confirmed
    recovery email, so the emailed link reaches it. `setRecoveryEmail` and
    `openEmailedLink` are in `e2e/web/lib/journeys-account.js`.
  - `account.sign_in`: `SignIn.jsx` with its method, email and check-email
    steps, and `POST /api/auth/email/request`.
  - `account.new_device`: after a sign-in, the account's books come down onto
    the shelf on their own.

## What this task is

The audit put the e2e `mockup()` captures of the Add-a-book sheet and the
upload preview next to the W07 board and found three gaps.

**1. A chooser, not four forms.** W07 phone #2
(`docs/mockups/W07-add-a-book.dc.html` L58-103) draws the sheet as a `.list`
of four `.row`s, each with a 22px accent icon, a name and a meta line:

| Row | Icon | Meta (board) |
| --- | --- | --- |
| New book (L79-82) | plus | "A name, and an empty book. No account needed." |
| By link (L83-86) | link | "Paste a link to a book on Estante." |
| Mine on Estante (L87-95) | books | "Your books that are not on this shelf yet. Sign in to see them." |
| Upload (L96-99) | upload | "A zip of a book, with or without its history." |

The app (`BooksScreen.jsx` L494-617) shows the New book form, the By link
form, the Mine list and the Upload button one under the other, all at once.

This task makes the sheet a chooser:

- **New book** and **By link** are rows (RAC `Button`s). Pressing one swaps the
  sheet's body to that way's step: a heading, a Back button that returns to
  the four, and the existing form (Book name and New book; Book link and
  Open). The behavior of each form does not change.
- **Upload** is a row that is the `FileTrigger`'s button. Choosing a zip
  closes the sheet and opens the preview, as today.
- **Mine on Estante** is not a button (board L87: a `div.row` in a column),
  because it holds controls of its own:
  - signed out: the meta line, then a `.btn` "Sign in with a passkey" (key
    icon, L92) and the accent `t-small` link "No passkey here? Email me a link"
    (L93);
  - signed in: the existing `MineList` states (the list with Add and Leave,
    "All your books are already on this shelf.", the error line) under the row's
    name, in place.

**2. Where Mine's sign-in leads.** Today the Mine button opens `SignIn` in
**create** intent (`AppShell.jsx` L1197, L1223, the seam shared with the
empty shelf's first-run Sign in). Someone with books on Estante already has
an account, so that intent registers a second one. This task gives the Mine
row its own seam:

- "Sign in with a passkey" opens `SignIn` with intent `signIn`, at the method
  step;
- "No passkey here? Email me a link" opens `SignIn` with intent `signIn`, at
  the **email** step (heading "Email me a link", the "Your email" field
  focused).

`SignIn` gains an `initialStep` prop (`'method'` by default, or `'email'`).
The rest of the email flow is the existing one: "Send the link", "Check your
email", the `/sign-in/<token>` redeem and the passkey offer. It reaches only
an account with a recovery email (workflow 13 L25-30).

**3. The upload preview takes the screen, on one row.**

- *Placement.* `upload_ui` Decision 1 put the preview over the whole screen
  "on every viewport", and W07 tablet #3 (L110-173) draws it with its own app
  bar and no rail. But the preview is an early return inside `BooksScreen`
  (L882-902), which the shell mounts in `.pane.main` beside the side pane and
  rail on tablet and computer (`AppShell.jsx` L1177-1199), and above the tab
  bar on a phone. That is the "side pane" the audit saw. This task lifts the
  `upload` state to `AppShell`, which renders `UploadPreview` as a full-screen
  surface like `SignIn` and the people screen. `BooksScreen` keeps an
  `onUpload` prop, and `onNeedsYou` opens the book through the shell's
  `openBook`.
- *The mode switch.* `.upload-what` (`upload-preview.css` L27-31) sets
  `flex-wrap: wrap` on two long segments ("Import as a new book" / "Merge into
  an existing book"). Where they do not fit, the second segment drops under
  the first, and the control no longer reads as one switch. The board draws
  one row (L119-122). The switch becomes a flex row as wide as its section,
  `flex-wrap: nowrap`, each segment `flex: 1 1 0` with centred text that may
  wrap **inside** its segment. The divider stays between the two segments.

## Why it needs to be done

The 2026-10-14 pairwise audit compared the W07 captures with the board, and
found the four inline forms, the preview inside the side pane, and the wrapped
switch. A sheet of four open forms is long on a phone and puts every field in
the tab order at once. A chooser asks one question first.

The Mine row's sign-in opening in **create** intent is a real defect beyond the
looks: someone signing in "to see their books" would make a new account
instead. The emailed-link offer is the only way in from the chooser for a
device without a passkey (workflow 7 §Signing in; workflow 13 L25-30).

This is one of the M5 polish leaves in `tasks/99-milestones.tji` L44. No later
task depends on it.

## Inputs / context

- **Board W07, `docs/mockups/W07-add-a-book.dc.html`:**
  - phone #1, the Books list, L28-56: the "Add a book" primary button in the
    header row (L30-33);
  - phone #2, the chooser sheet, L58-103: `.scrim > .sheet[role=dialog]`, the
    heading `h2.t-h2` "Add a book" with an icon Close (L74-77), and the four
    rows at L79-99;
  - tablet #3, the upload preview, L110-173: the app bar with the X "Cancel the
    upload" (L113) and title "Upload banda-do-bairro.zip" (L114); "What to do
    with it" (L118) and the one-row `.seg[role=radiogroup]` (L119-122);
  - computer #4, a book's detail and Delete, L179-244 (unchanged by this task;
    its capture is `online.spec.js` L53).
- **Frame numbering:** `e2e/web/lib/mockup-frames.json` L195-216. #1 and #2
  are phone, #3 tablet, #4 computer. The board key is `'W07-add-a-book'`.
  `mockup(page, board, index, { note })` is at `e2e/web/lib/mockup.js:45`.
- **Workflow 7**, `docs/workflows/07-add-a-book.md`: the four ways in
  (L23-30), the chooser paragraph this task adds (L32-38), §Signing in
  (passkey, emailed link as the fallback), §Upload (L80ff).
- **Workflow 13** `docs/workflows/13-new-device.md` L25-30: the emailed link
  goes to the account's recovery email, so it reaches only an account that set
  one.
- **The sheet today**, `app/src/books/BooksScreen.jsx`:
  - `AddBookSheet` L448-625: the `DialogTrigger` and its `onOpenChange` sending
    `LIST_MINE` (L454-457); the head L474-493; New book L494-517; By link
    L519-566 (`tokenFromLink`); Mine L568-585; Upload L587-617 (`FileTrigger`,
    `onUpload({ bytes: new Uint8Array(buf), fileName })` at L609);
  - `MineList` L363-438 (`signed_out`, `error`, `ready`, `idle`);
  - the `upload` state L677, `onUpload={setUpload}` L816, the early return
    L882-902.
- **Copy**, `app/src/i18n/locales/en.js` L28-97 (`books.*`, including
  `mineSignedOut` L48 and `mineSignIn` L49), and the `signIn.*` block around
  L732-760 (`emailLink`, `note`).
- **`app/src/account/SignIn.jsx`:** props at L93-106; `step` starts at
  `'method'` or `'redeeming'` (L107); the method step L247-272 and the email
  step L273-303; `sendEmailLink` L184-204.
- **`app/src/shell/AppShell.jsx`:** `destinationPanels` L174-214 (BooksScreen
  at L201-214, `onSignIn` and `onByLink`); the `signIn` early return L722-753
  (`setSignIn({ intent })`); the wide split L1177-1199 and the narrow screen
  L1201-1220, both passing `() => setSignIn({ intent: 'create' })` (L1197,
  L1223).
- **The switch's CSS**, `app/src/books/upload-preview.css` L24-54
  (`.upload-what`, `.upload-what-opt`); the base `.seg` in
  `app/src/theme/theme.css` L313-316, styled for `button` children only.
- **Existing tests:**
  - `BooksScreen.behavior.test.jsx` L174 (the sheet opens by keyboard and
    pointer) and L194 (New book → `CREATE_BOOK`);
  - `MineOnEstante.behavior.test.jsx` L50-160 (LIST_MINE on open; signed out;
    signed in with Add and Leave; owner name);
  - `UploadPreview.behavior.test.jsx` L110 (round trip), L309 (the picker is
    axe-clean), L322 (the preview is axe-clean);
  - `SignIn.behavior.test.jsx` L170 (emails a link), L298 (keyboard path);
  - `AppShell.routing.behavior.test.jsx` L496 (a refused invitation's "Add a
    book by its link" lands on Books);
  - e2e: `books.spec.js` L18 (New book, W07#2 at L33);
    `add-by-link.spec.js` L95 (W07#1 at L147), L267 (By link, W07#2 at L284),
    L320 and L339 (Mine on a second device); `upload.spec.js` L30 (W07#3 at
    L42) and L52; `online.spec.js` L19 (W07#1 L27, W07#4 L53);
    `account-sign-in.spec.js` L59 (emailed link).
- **Journeys:** `makeLocalBook` (`e2e/web/lib/journeys.js` L137-145) and
  `uploadZip` (`e2e/web/lib/journeys-files.js` L16-24) open the sheet and
  fill its inline forms; `openEmailedLink`, `setRecoveryEmail`,
  `signInExistingWithPasskey`, `sharePasskeys` in `journeys-account.js`
  L40-150. `recovery-email.spec.js` L54-80 has a local
  `accountWithConfirmed` (sign in, set, confirm on a fresh device).
- **Predecessor decisions kept:** no router (screens are AppShell state and
  early returns, `share_people` Decision 6); the 401-is-the-gate invited flow
  (`add_by_link` Decision 2); the upload choice and target logic
  (`upload_ui` Decisions 3-5).

## Constraints / requirements

- **The chooser, as drawn.**
  - The sheet opens on the four rows, in the board's order, each with its
    icon, name and meta line. The meta copy is the board's (table above).
  - The heading stays "Add a book" and the Close button stays.
  - `LIST_MINE` is still sent when the sheet opens, so the Mine row is ready
    when it is seen.
- **The two steps.**
  - New book: the heading "New book", the Book name field (focused on
    arrival), and the actions Back and New book. Submitting sends
    `CREATE_BOOK` and closes the sheet, as today.
  - By link: the heading "By link", the meta "Paste a link to a book on
    Estante.", the Book link field (focused), "That is not a book link." on a
    bad link, and the actions Back and Open. Open starts the invited flow with
    the token, as today.
  - **Back** returns to the chooser and puts focus on the row it came from.
    Closing the sheet from a step and reopening it starts on the chooser, with
    the fields cleared.
  - The sheet keeps its accessible name, "Add a book", in every step; the
    step's heading is the second level inside it.
- **Upload.** The Upload row opens the file picker directly (RAC
  `FileTrigger`, `.zip`). A chosen zip closes the sheet and opens the preview.
  Cancelling the picker leaves the chooser open.
- **Mine on Estante.**
  - Signed out: "Sign in with a passkey" and "No passkey here? Email me a
    link". The second is a RAC `Button` styled as the board's accent link
    (it starts an action in the app; it is not an address), and both open
    `SignIn` in `signIn` intent, at `method` and at `email`.
  - Signed in: the `MineList` states, unchanged in behavior.
  - The empty shelf's first-run Sign in keeps **create** intent (account.first_run);
    only the Mine row's seam changes.
- **The upload surface.**
  - `UploadPreview` is rendered by `AppShell` as a full-screen surface on
    every viewport: no rail, side pane, header chrome or tab bar beside or
    under it (W07 #3).
  - Its Cancel and a finished import return to the Books destination, as
    today. A merge that needs the user opens the book's conflict surface
    through `openBook` (`upload_ui` Decision 2).
  - Nothing in the preview's messages to the Worker changes.
- **The mode switch** is one row at every width. Each segment takes half; a
  long label wraps inside its segment. The divider stays. Tokens only;
  `theme.css` is not edited.
- **Accessibility.** RAC for every interactive part: the rows are RAC
  `Button`s named by their name with the meta line as the description
  (`aria-describedby`); the rows sit in a plain container, not `role="list"`,
  because a list of buttons fails axe's `aria-required-children`. Keyboard:
  Tab through the rows, Enter or Space opens a step, Back returns, Escape
  closes the sheet. The sheet is portalled inside the `.est` theme root, as
  today. axe clean at WCAG 2.1 AA on the chooser, each step, Mine signed out
  and signed in, and the preview.
- **Copy** in all four locales: the new keys are the four meta lines (two
  exist: New book's help and Upload's meta), "Sign in with a passkey", "No
  passkey here? Email me a link", and "Back". `books.mineSignIn` "Sign in"
  goes.
- **Offline first.** The chooser and both local ways (New book, Upload) work
  offline, as today. By link and Mine keep their existing offline answers.

## Acceptance criteria

### Behavior delivered

1. **The sheet is a chooser.** "Add a book" opens a sheet holding four rows,
   New book, By link, Mine on Estante and Upload, each with the board's meta
   line, and no field visible (W07 #2).
2. **New book and By link are steps.** Each opens its field in the sheet, with
   Back to the chooser. They create a book and start the invited flow as
   before (workflow 7 L23-38).
3. **Upload picks a zip from the row**, and the preview opens over the whole
   screen on phone, tablet and computer, with no rail or tab bar (W07 #3).
4. **The mode switch stays one row** at every viewport (W07 #3 L119-122).
5. **Mine on Estante, signed out**, offers "Sign in with a passkey", which
   opens the sign-in surface for an existing account, and "No passkey here?
   Email me a link", which opens it at the email step. Signed in, it lists the
   account's off-shelf books in place (W07 #2 L87-95; workflow 13 L25-30).

### Tests, by level

The note names **behavior** and **e2e-web**. Nothing in this task is a pure
module, so no unit level is added. No level is dropped.

- **behavior — `app/src/books/BooksScreen.behavior.test.jsx`**, the sheet
  cases:
  - *the chooser*: the L174 case opens the sheet and asserts the four rows by
    name, each described by its meta line, no textbox in the sheet, and axe
    clean.
  - *New book step*: the L194 case goes chooser → New book → the Book name
    field focused → submit → `CREATE_BOOK`; a second case presses Back and
    asserts the chooser is back with focus on the New book row, then Escape
    and reopen starts on the chooser with an empty field. axe on the step.
  - *By link step*: By link → a pasted `https://…/i/<token>` → Open calls
    `onByLink(token)`; a bad link shows "That is not a book link." as an
    alert; axe on the step.
  - *Upload row*: the Upload row is the file trigger; a chosen zip calls
    `onUpload` with a `Uint8Array` and the file name, and the sheet closes.
  - *keyboard*: Tab to a row, Enter opens its step, Back by keyboard returns.

  *Pins:* W07 #2 L58-103; workflow 7 L23-38.
- **behavior — `app/src/books/MineOnEstante.behavior.test.jsx`**:
  - the L57 *signed out* case asserts "Sign in with a passkey" and "No passkey
    here? Email me a link" inside the Mine row, and that each calls the sign-in
    seam with `'method'` and `'email'`;
  - the L70 *signed in* case still lists and adds in place, under the row's
    name;
  - axe on both.

  *Pins:* W07 #2 L87-95.
- **behavior — `app/src/account/SignIn.behavior.test.jsx`**: a case *opens at
  the email step*: `initialStep="email"` shows the "Email me a link" heading
  and the "Your email" field, and sending reaches "Check your email" through
  the fake `authClient`; axe. *Pins:* workflow 13 L25-30.
- **behavior — `app/src/shell/AppShell.routing.behavior.test.jsx`**:
  - *Mine's sign-in is for an existing account*: from the Books destination,
    the sheet's "Sign in with a passkey" mounts `SignIn` with intent
    `signIn` ("Sign in" heading), and "No passkey here? Email me a link"
    mounts it at the email step; the empty shelf's Sign in still opens the
    create intent.
  - *the upload preview is a full-screen surface*: in wide mode, choosing a zip
    from the sheet renders the preview with no rail tablist (`shell.nav`) in
    the document, and Cancel returns to Books with the rail back.

  *Pins:* workflow 7 L32-38; W07 #3; `upload_ui` Decision 1.
- **behavior — `app/src/books/UploadPreview.behavior.test.jsx`**: the L309
  *picker is axe-clean* case is rewritten for the chooser; a case asserts the
  radio group carries `upload-what` and both radios are its direct children
  (jsdom has no layout; the one row is pinned at e2e). *Pins:* W07 #3
  L119-122.
- **e2e-web**, on phone, tablet and computer through the config's three
  projects, real UI only, `checkA11y()` on every state named:
  - **`e2e/web/tests/books.spec.js`** *"a new book is made and renamed on the
    shelf"* (L18): after "Add a book", asserts the four rows and no Book name
    field; `mockup(page, 'W07-add-a-book', 2, { note: 'chooser' })` on the
    chooser; New book → the step → Back → the chooser → New book → name →
    New book; axe on the chooser and the step.
  - **`e2e/web/tests/add-by-link.spec.js`**:
    - *"Add a book -> By link takes a pasted invitation URL"* (L267) goes
      through the By link row and step; its W07#2 capture moves to the step
      (`{ note: 'by link' }`).
    - *"a second device signs in … Mine on Estante does not offer it twice"*
      (L320): the second device signs in **from the chooser**: Books → Add a
      book → Mine's "Sign in with a passkey" → the "Sign in" surface → Use a
      passkey; then the account's book comes onto the shelf, and the reopened
      sheet's Mine row reads "All your books are already on this shelf." axe on
      the signed-out chooser.
    - a new case *"No passkey here? Email me a link, from Mine on Estante,
      signs in an account by its recovery email (workflows 7, 13)"*: an
      account with a confirmed recovery email (the `accountWithConfirmed`
      helper moved from `recovery-email.spec.js` L71 to
      `journeys-account.js`, both specs using it); a fresh device with no
      passkey opens Books → Add a book → "No passkey here? Email me a link" →
      the "Email me a link" step with "Your email" → Send the link → the
      mail's `/sign-in/<token>` link → the passkey offer declined → the
      account's *My songs* is on the shelf, On Estante. axe on the email step.
  - **`e2e/web/tests/upload.spec.js`** both cases (L30, L52), through
    `uploadZip` on the Upload row: no `tablist` named by `shell.nav` is visible
    while the preview is open; the two radios of "What to do with the upload"
    have the same top (±1px) and the same height; `mockup(page,
    'W07-add-a-book', 3, { note: 'full screen, one row' })`; axe on the
    preview.
  - **`e2e/web/tests/online.spec.js`** L19 keeps W07#1 (L27) and W07#4 (L53),
    passing through the chooser where it adds a book.

  *Pins:* W07 #1-4; workflow 7 L23-38; workflow 13 L25-30.

**The journeys follow the chooser.** `makeLocalBook` and `uploadZip` go
through the New book and Upload rows, and the inline openers in
`add-by-link.spec.js`, `leave-book.spec.js` and `portal.spec.js` go through
the rows they need. A journey `signInFromMine(page, how)` in
`journeys-account.js` opens Mine's sign-in, `'passkey'` or `'email'`.

**Drivability.** Every case is driven by what exists:

- a fresh device and the example book (`startApp`, `gotoTab`);
- an account with a passkey (`signedInDevice`), a second device sharing it
  (`sharePasskeys`, `account.new_device`), and its book online
  (`putBookOnline`, `books.online`);
- a confirmed recovery email (`setRecoveryEmail`, the mail catcher,
  `account.recovery_email`), and the emailed sign-in link
  (`/api/auth/email/request`, `account.sign_in`);
- the upload fixtures `e2e/web/fixtures/upload/{book,merge}.zip`.

No test is deferred, and there is no deferred WBS leaf.

## Decisions

1. **New book and By link are steps inside the sheet.**
   - *Rationale:* the board draws only the chooser, and both ways are one
     field. A step keeps the sheet, its focus trap and its Close, and gives a
     Back. No router is needed (`share_people` Decision 6).
   - *Rejected:* a separate dialog for each, which stacks two modals on a
     phone; and a full screen, which is heavier than one field needs.
2. **Upload's row is the file trigger.**
   - *Rationale:* the only thing an Upload step would hold is a "Choose a zip"
     button. The preview is the real next screen.
   - *Rejected:* an Upload step with the button, one more press for nothing.
3. **Mine stays inline, in the row.**
   - *Rationale:* the board's Mine row is a `div` holding its own controls
     (L87-95), and `MineList` already has every state. Workflow 7 calls it
     "the user's books that are not on this shelf yet": seeing them on the
     chooser is the point.
   - *Rejected:* a Mine step, which the board does not draw and which hides
     the list behind a press.
4. **Mine's sign-in uses `signIn` intent, with an `initialStep`.**
   - *Rationale:* a person with books on Estante has an account; the create
     intent would register a second one. `initialStep` is the smallest seam
     that lets the email offer land on the email step, reusing `SignIn`'s
     request, check-email and redeem flow.
   - *Rejected:* starting the passkey ceremony from the sheet's button. The
     ceremony, its errors and the passkey offer live in `SignIn`, and the
     sheet closes as the surface opens.
   - *Rejected:* an email field inside the Mine row. It would duplicate
     `SignIn`'s email step and its "Check your email" state.
   - Only an account with a confirmed recovery email gets a mail; the request
     answers 202 either way and the surface says "If that address has an
     account…" (workflow 13 L25-30). Nothing new is promised.
5. **The upload preview moves to `AppShell`.**
   - *Rationale:* `upload_ui` Decision 1 already decided "the whole screen on
     every viewport"; rendered inside `BooksScreen`, it can only cover the
     Books panel. Every other full-screen surface (sign-in, people, chord
     explorer) is AppShell state with an early return.
   - *Rejected:* hiding the rail with CSS while the preview is open, which
     leaves the tabs in the accessibility tree.
6. **The mode switch shares the row, wrapping inside a segment.**
   - *Rationale:* the board's switch is one row. On a phone the two labels
     cannot fit on one line each, so the segments split the width and a label
     takes two lines inside its segment; the control still reads as one.
   - *Rejected:* stacking the segments on a phone (the board never stacks a
     `.seg`); and shortening the labels, which are the workflow's words
     (workflow 7 §Upload: "Import as a new book", "Merge into an existing
     book").
7. **The one row is pinned at e2e, by measured boxes.** jsdom has no layout;
   behavior tests pin the class and the structure. The `mockup()` captures are
   for the human audit, not assertions (`setlist_play_chrome` Decision 5).

## Open questions

(none — all decided)

## Status

_pending implementation_

## Status

**Done** — 2026-10-16.

- The Add-a-book sheet is a chooser of four rows (New book, By link, Mine on Estante, Upload); New book and By link open as steps with Back: `app/src/books/BooksScreen.jsx`, `app/src/books/books.css`.
- Mine on Estante signed out offers "Sign in with a passkey" and "No passkey here? Email me a link", both opening `SignIn` in `signIn` intent (method and email steps): `app/src/account/SignIn.jsx` (`initialStep`), `app/src/shell/AppShell.jsx`.
- The upload preview is lifted to a full-screen `AppShell` surface; its mode switch stays on one row: `app/src/shell/AppShell.jsx`, `app/src/books/upload-preview.css`.
- Copy in all four locales (`books.back`, `mineSignInPasskey`, `mineEmailLink`; `mineSignIn` and `uploadChoose` removed): `app/src/i18n/locales/{en,pt-BR,es-419,it}.js`.
- Workflow design paragraph kept: `docs/workflows/07-add-a-book.md`.
- Behavior tests: `app/src/books/{BooksScreen,MineOnEstante,UploadPreview}.behavior.test.jsx`, `app/src/account/SignIn.behavior.test.jsx`, `app/src/shell/AppShell.routing.behavior.test.jsx`.
- e2e-web: `e2e/web/tests/{books,add-by-link,upload,portal,recovery-email}.spec.js`; journeys in `e2e/web/lib/{journeys,journeys-files,journeys-account}.js` (`accountWithConfirmed` moved, new `signInFromMine`).
- Deviations: the email-link e2e case brings down a book put online for the test ("Cifras do sábado"), not *My songs*; the keyboard behavior case checks tab order and uses Enter (real Tab presses are e2e only, `user-event` not installed).
