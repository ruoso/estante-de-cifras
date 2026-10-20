# 7. Add a book

Status: decided.

Putting a book on the shelf — a new one, one on Estante already, or one
brought in as a zip — and taking one off, or out. In the first pass Estante
is the only host (DIRECTION §3.3).

Sharing a book with someone is workflow 10; a whole shelf on a new device is
workflow 13.

## The book-management screen

It lists the books on the shelf, each with:

- its **title**: the README's level-1 heading, or the repository name
  (DIRECTION §2.1), unless the user has renamed it on their shelf — a label
  kept in the home book that changes nothing in the repository;
- **where it lives**: *on this device*, or *on Estante*;
- whether the user **can save** to it;
- **how many songs** it holds (*14 songs*), or *still loading* while the
  device has not finished reading it, as its section in search says
  (workflow 2);
- its **sync state** (workflow 8), and the words of anything waiting on the
  user: *needs you*, or a fork's *Choros da Ana has 3 new saves.*
  (workflow 11).

**Pressing a book opens its songs**: search scoped to that book, at its
address `…/b/<book>` (below, *Links to books*), the same place a link to it
opens. That is the row's one action. Everything else about the book —
renaming it on the shelf, where it lives, putting it online, sharing,
downloading, its files, making it one's own, leaving, removing, deleting — is
on the book's **detail**, reached from the book's songs (*A book's songs*,
below). A book that *needs you* opens on its songs too.

On a tablet and a computer the screen is the same one list, in a column; it
has no detail pane beside it, since pressing a book leaves for its songs.

*Add a book* offers four ways in:

- **New book**: a name, and an empty local repository. No account needed.
- **By link**: a link to a book on Estante, pasted or arriving as an
  invitation (workflow 1).
- **Mine on Estante**: once signed in, the user's books that are not on this
  shelf yet.
- **Upload**: a zip (below).

The sheet is a chooser: each way in is one row, named and explained in a
line. New book and By link open their own field in the same sheet, with a
way back to the four. Upload goes straight to picking a zip, and its preview
takes the whole screen. Mine on Estante lists its books in place once signed
in. Signed out, the row offers *Sign in with a passkey* to an existing
account, and *No passkey here? Email me a link*, which reaches an account
only through its recovery email (workflow 13).

Cloning shows its progress and can be cancelled.

## A book's songs

A book open is search scoped to it (workflow 2 §Scope): the scope in the
box, and above the results a bar naming the book —

- its **title**, and the row's meta line: where it lives, whether one can
  save, how many songs;
- its **sync state** in words, when it is not in step (workflow 8);
- **Manage**, a button whose accessible name is *Manage {book}*: it opens
  the book's detail.

The bar shows whenever the scope is one book or a folder in it — from the
book's address, a row on this screen, or the *Search only in {book}* filter
on a book's section in search — and stays while typing. Clearing the scope
(the chip's ✕) is the whole shelf again, and the bar goes; going back
returns to where the book was opened from.

Two things that wait on the user sit in the bar as a notice, with their one
action:

- **A book that needs you** (workflow 9): *2 songs need you.* with
  **Settle**, which opens the book's conflicts one song at a time; the songs
  in conflict carry their *conflict* badge in the list below. The book opens
  on its songs rather than straight into the conflicts: a conflict can wait
  (workflow 9 §Leaving one), and the person may have come to play.
- **A fork whose original has new saves** (workflow 11): *Choros da Ana has
  3 new saves.* with **Bring them in**.

**The detail** opens over the book's songs: on a phone it takes the screen,
with *Back to {book}*; on a tablet and a computer it takes the main pane,
beside the book's songs in the side pane, as a song does. It is not an
address of its own: reloading lands on the book's songs. Its title carries
**Rename**, the label on this shelf only. Below come the book's state and
its acts, as they are drawn: put online, the notices of lost access, *can't
save here* and taken down, **Download**, then **Files** — *Every file in the
book, as it is stored.* — opening the file view (workflow 14), then fork,
remove, leave, share and delete. Removing or leaving the book from its
detail returns to Books, since its songs are no longer here.

## Signing in

With a **passkey**, and an emailed link as the fallback for a device without
one. No passwords, and no other identity providers in the first pass.

## Links to books

A link to a book is a link into the app, `…/b/<book>`: the thing a teacher
sends a student. It names the book, not its git URL, which is the service's
business. What the link lets its holder do is workflow 10's.

The same address is where the app is while the book is open: `…/b/<book>`
is search scoped to that book — its songs — and `…/b/<book>/<path>` is a
song or a setlist in it. Reloading, bookmarking or going back lands there
again. An address for something not on this device opens a plain screen
instead, never an empty song:

- **A book not on this device** says the link does not open a book, as a
  dead invitation does (workflow 1, *A link that no longer works*), and
  names nothing about the book — the app cannot tell a book that is not
  yours from one of yours not yet added here. It suggests asking whoever
  sent it for an invitation, or adding it from Books if it is yours on
  Estante (*mine on Estante*).
- **A song or setlist no longer in a book that is here** — renamed, moved
  or deleted — says so, naming the book, and offers to open the book's
  songs.

## Putting a book online

*Put online*, on a local book, creates the book on Estante, adds it as the
remote, and pushes. **It goes online private**: only its owner can open it.
Sharing (workflow 10) is how it is opened up: people invited as readers or
editors, at most fifty. Private is where a book starts, not where it must
stay; it is never shared by default, since a book with words in it is
copyrighted text.

## Downloading a book

*Download*, on any book, saves the repository **as it is on the device**:
the `.git` directory with the whole history, and the working tree, unsaved
changes included. Unzipped, `git status` shows the unsaved changes as
modified files, which is exactly what they are. The remote is removed, since
its URL is the service's and useless outside the app.

The zip is written by the zip writer Explore Chords already has.

## Uploading a book

A zip is uploaded, and the app reads it as a remote to pull from. It ends one
of two ways:

- **Import as a new book**: its history becomes the book's, and it can be
  put online like any local book.
- **Merge into an existing book**, one the user can save to: the zip's
  history is merged with the book's by the same cifra-aware merge sync uses
  (DIRECTION §2.2), and what collides goes to conflict resolution (workflow
  9).

This is how a download edited on a computer comes home, and how a book kept
elsewhere moves to Estante.

Because git objects are named by their content, pulling from the zip is
copying its objects into the book's store and pointing a temporary ref at its
head. Nothing in the zip is run: hooks, its config and its remotes are
ignored, and only paths inside the repository are read.

**A preview comes first.** The upload shows what it would do, song by song —
*added*; *changed*, with the musical summary; *conflict* — and nothing is
written until it is confirmed. For a merge, the preview is the save sheet
(workflow 4): confirming makes the merge commit, and pushes it.

**Edits never committed.** The likely uploader is not a git user: they
unzipped the download, edited a song in a text editor and zipped the folder
again. Changes in the zip's working tree are read as one more commit on top
of its head — *changes from the upload*, by the user uploading — and shown in
the preview like any other.

**A zip with no history**, just a folder of `*.cifra.md` files, becomes a new
book with one first commit. Into an existing book there is no common ancestor
to merge from, so it is not a merge, and the preview says so: each file that
matches one in the book is offered as *replace with the uploaded version*,
with its diff, chosen song by song; files with no match are added.

**A zip with a history unrelated to the book's** — a book kept somewhere else
entirely — may be merged, as git allows, but the preview says the two share
no history, and every song present in both is shown as a conflict to choose
between.

**Which branch**: the zip's checked-out branch only, named in the preview.

**A merge left half done.** A zip from a computer may hold git's conflict
markers (cifra.md §11.12.3), and a text holding them is never canonical, so
it can never be saved or pushed (workflow 14). Two places they can be:

- **In the zip's working tree**: someone stopped in the middle of a merge.
  The preview shows that file as *unresolved merge: fix it before
  importing*, pointing at its first marker line, and leaves it out; the rest
  of the upload goes ahead. A merge into an existing book never merges a
  marked file either (cifra.md §11.4): that song stays as the book has it.
- **In the zip's history**: markers were committed. Rewriting that history
  into canonical form is impossible, since a marked text has no canonical
  form. The preview names the commit and the file, and offers two ways on:
  fix it on the computer and upload again, or **import the latest version
  without its history**, if the latest version is itself clean — as a book
  with one first commit, like a zip with no history.

**Unsaved changes in the book merged into** are handled as sync handles them
(DIRECTION §3.1): the merge lands in the saved book, and the unsaved changes
are carried on top of it, still unsaved.

## Removing a book, and deleting one

Two different acts:

- **Remove from my shelf** deletes the local clone only. With unsaved
  changes or saves not yet pushed, it says what would be lost and asks. For a
  book that is only on this device, it says the book will be gone for good,
  and offers the download first. Removing keeps a member's membership, so
  *Mine on Estante* offers the book again; ending it is *Leave this book*
  (workflow 10 §Leaving a book).
- **Delete the book**, only for its owner, deletes it from Estante for
  everyone, and asks for the book's name to be typed.

## Where the data lives

The service, its volume and Postgres run in one region, which decides where
every book and account is stored: **the US**.
