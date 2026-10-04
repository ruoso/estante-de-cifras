# 11. Fork

Status: decided.

Making someone else's book one's own, and still receiving its updates: the
teacher–student loop (DIRECTION §2). The student arranges the teacher's songs
for their instrument in their own copy, and the teacher's corrections keep
arriving.

## Ways in

- **Saving in a book the user cannot save to** (workflow 4): *make this book
  your own*.
- **Losing access** with saves not yet pushed (workflows 8, 10).
- **Deliberately**, from the book-management screen.

## What a fork is

The user's own copy of the book, with all its history, which remembers the
book it came from as its **original**. It is an ordinary book: the user saves
to it, shares it, downloads it.

**It replaces the original on the user's shelf.** Their working copy, unsaved
edits included, carries straight over and now saves to the fork; the original
is followed from inside it rather than kept beside it. Two entries would put
every song in search twice, for no gain.

**It is named as the original was**, unchanged in the repository, and the
shelf shows *from Ana's Choros* beneath it. The user can rename it on their
shelf, as any book (workflow 7).

**Where it lives.** On Estante, private: the service copies the repository
on its volume (DIRECTION §3.3). Everyone who can open a book has an account
(workflow 10), so a fork is always on Estante, with its own limit of fifty
people.

**A fork of a fork** is allowed. Its original is the book it was forked from,
not the first one; nothing follows more than one step.

## Following the original

Sync keeps the fork itself in step without asking (workflow 8). Bringing in
the original's changes is **never automatic**: merging someone else's book
into one's own is a decision.

The shelf says when the original has new saves — *Ana's Choros has 3 new
saves*. *Bring them in* shows the same preview an upload does (workflow 7),
song by song; confirming merges, commits and pushes. Conflicts go to workflow
9.

**When the original goes away** — the user removed from it, the book
deleted — the fork is untouched. It has the whole history up to
the last time it followed the original, and its shelf entry says *the
original is no longer shared with you*. Following ends; nothing else does.

## The original's owner

Is told nothing in the first pass, and sees nothing of forks. They are copies
the owner already allowed by sharing the book.

## Later

- **Offering changes back.** A student's fix to a chord in the teacher's
  book reaching the teacher — a pull request, in git's terms. The service
  knows both books and their common history, so it is possible; it is also a
  workflow of its own, for both sides.
- **Showing the owner their book's forks.**
