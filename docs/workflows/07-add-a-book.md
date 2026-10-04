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
- its **sync state** (workflow 8).

*Add a book* offers four ways in:

- **New book**: a name, and an empty local repository. No account needed.
- **By link**: a link to a book on Estante, pasted or arriving as an
  invitation (workflow 1).
- **Mine on Estante**: once signed in, the user's books that are not on this
  shelf yet.
- **Upload**: a zip (below).

Cloning shows its progress and can be cancelled.

## Signing in

With a **passkey**, and an emailed link as the fallback for a device without
one. No passwords, and no other identity providers in the first pass.

## Links to books

A link to a book is a link into the app, `…/b/<book>`: the thing a teacher
sends a student. It names the book, not its git URL, which is the service's
business. What the link lets its holder do is workflow 10's.

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
  and offers the download first.
- **Delete the book**, only for its owner, deletes it from Estante for
  everyone, and asks for the book's name to be typed.

## Where the data lives

The service, its volume and Postgres run in one region, which decides where
every book and account is stored: **the US**.
