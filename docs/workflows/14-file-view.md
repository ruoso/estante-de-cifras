# 14. The file view

Status: decided.

The book as git sees it (DIRECTION §4): files and folders, their status, the
book's whole history, plain line diffs. Everything else in the app sees songs;
this sees files, for the user who wants to understand how the two relate, or
to do what only files allow — rename, move, delete.

It is also where a user meets the rules for what a book may hold, so those
are decided here: a book is shared, synced and stored on Estante, and
anything it may hold, the service hosts. **A book holds only what a songbook
needs, in one form, and the service checks every push for it.** The concern
is the service becoming file storage nobody meant to offer.

## What a book may hold

This is a **songbook's** rule. The home book is a settings repository with its
own allowed kinds (DIRECTION §3.2), written down in
[`home-book-format.md`](../home-book-format.md) and checked as settings rather
than songs; what follows governs songbooks, which is every book the file view
shows.

A songbook holds these, and nothing else:

- `*.cifra.md` songs and `*.setlist.md` setlists, in any folder;
- `README.md` at the root, which titles the book (DIRECTION §2.1);
- `.gitattributes` at the root, exactly as the app writes it (below).

Only regular files: no symlinks, no submodules, nothing executable. Each file
is UTF-8 text of at most **256 KB** — a long song with its words and four
instruments' voicings is under 20 KB.

No `LICENSE`, or any other file saying on what terms a book is shared. That
is for its owner to tell whoever they share it with; the app takes no part
in it.

### Limits

- **256 KB** per file;
- **50 MB** per book, with its history;
- **100 books and 200 MB** per account, forks included, with creating books
  rate-limited.

What passes every check is text, and a song's notes are free text, so the
limits are what keep text from becoming the storage instead: bounded by
size, since it cannot be by content without hurting real songs.

## Canonical form

**The app canonicalizes every song and setlist when saving, and the service
refuses any commit holding one that is not canonical.** A file is canonical
when writing it back from what was read changes nothing. The same library —
the cifra.md JS library — decides it in the app and on the service, so the
two cannot disagree about what canonical is.

**The canonical form must have no ambiguity.** Every document has exactly
one canonical form, canonicalizing is idempotent, and nothing in it is left
to the writer's choice. cifra.md §8 does not yet say all of it: it leaves
replacing tabs in an existing line "if it chooses to", and says nothing of a
byte-order mark, line endings, a final newline or Unicode normalisation.
Every such gap is closed in the specification before the check ships, and
the setlist format gets a canonical form of its own, defined the same way.
The text rules at least are fixed here: UTF-8 with no BOM, LF, exactly one
final newline, NFC, no tabs.

For the user this is little. The chart keeps its spacing and spelling
(cifra.md §8.2), so canonicalizing on save reorders voicings, as workflow 4
already does, and tidies whitespace. A voicing line the parser cannot read
already stops the save (workflow 4).

- **`README.md`** is not a song, but is held to the text rules.
- **`.gitattributes`** must be exactly what the app writes.
- **Merges** made by sync produce canonical files by construction, and are
  checked like any other commit.

**When the canonical form changes** — a new version of the specification or
the library — existing history is not touched: only new commits are checked.
An app that updates rewrites its saves not yet pushed into the new form
before pushing, which is safe because nobody else has them yet. The service
accepts the previous form as well as the current one for a while, so a device
that has been offline across the change still syncs.

## What the service checks

The app keeps to the rules, but it is not what guarantees them. Checking the
files in the latest commit is not enough: a push can carry objects no commit
refers to, other refs, tags, or history rewritten to hide what it held. So
the `pre-receive` hook, run by git itself on objects still held in
quarantine (DIRECTION §3.3), checks all of it. A push that fails any check is
refused whole, naming what failed, and its objects never reach the
repository.

- **One ref.** Only `refs/heads/main` may be updated: no other branch, no
  tags, no notes, no deleting it.
- **Fast-forward only.** History is never rewritten (workflow 6), and a
  rewrite is also a way to swap what a book holds.
- **No stowaways.** Every object the push brought must be reachable from the
  new commits: the objects in quarantine are listed and compared with
  `rev-list --objects` from the new head, excluding what the repository
  already had. One object more, and the push is refused.
- **Every blob reachable from a new commit** is checked, not only those in
  its last one: its path against what a book may hold, its mode, its size,
  its encoding, and — for songs and setlists — that it is canonical.
- **Every tree**: regular files and folders only, names of reasonable
  length.
- **Every commit**: a message and author of reasonable size, so that commit
  messages are not the storage instead.
- **Git's own guards** as well: `receive.fsckObjects` for malformed objects,
  and `receive.maxInputSize` to cap a single push.
- **The limits** above, for the book and for its owner's account.

A local book never pushed is held to all of this when it is put online.

### An upload that holds other things

The preview (workflow 7) lists the files that will be left out, and those
that will be canonicalized. Imported as a new book, its history is rewritten
accordingly — a new book, so new commit hashes cost nothing. Merged into an
existing book, the incoming commits are rewritten the same way on top of the
history the two share, which is unaffected.

## The view

**Where it is reached**: *files* on each book in the book-management screen,
and *show the file* on a song's reading view, which opens the tree at that
file. Not hidden behind a setting: advanced users find it, and others never
need to.

**On a phone** it works, but it is laid out for a wide screen first: the tree
and the file side by side, collapsing to one at a time on a phone.

### Statuses

Git's are more than a user needs. A file shows *unsaved changes*, *new*
(never saved), *deleted* (deleted but not yet saved), *conflict* (workflow
9), or nothing when it is in step.

### What can be done to a file

- **Create** a song (as workflow 3 has it), a setlist, a folder, or the
  README if there is none — what a book may hold, and nothing else. A folder
  exists once a file is in it, since git has no empty folders.
- **Rename** and **move**, which update the links to a song in the book's
  setlists (workflow 12). A name keeps its kind: a song cannot be renamed out
  of `.cifra.md`.
- **Delete**, asked once.
- **Edit** its text in the raw editor.

Each is a change to the working copy, saved like any other (workflow 4).
Deleted files are listed as *deleted* until the save.

### Saving several files

The changed files are listed with a check beside each, all checked. *Save*
opens the save sheet for those, as *save all* does (workflow 4), and makes
one commit. Choosing which changes go in a save is the one piece of git's
staging the file view keeps.

### The book's history

Every commit, newest first, merges included and marked as merges. This is
git's view, and hiding them here would leave the user unable to match it to
what `git log` says. Each shows its message, author, date, a short hash, and
the files it touched.

Opening one shows the line diff of each file, and offers, per file, *restore
this version*, which writes it into the working copy. A deleted file is
restored the same way (workflow 6).

Short hashes are all of git's machinery that shows: a book has one branch
and one remote, and naming them adds nothing.

## What a new book starts with

A `README.md` holding its title as a level-1 heading (DIRECTION §2.1), and a
`.gitattributes` that names the cifra merge driver for `*.cifra.md`
(DIRECTION §2.2), so that a download merges songs the same way on a computer.
