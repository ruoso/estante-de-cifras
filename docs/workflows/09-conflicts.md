# 9. Conflicts

Status: decided.

What the cifra-aware merge (DIRECTION §2.2) cannot settle alone, and how the
user settles it. It is reached from sync (workflow 8) and from merging an
upload (workflow 7).

The merge is built so that this is rare: two people voicing different
instruments, or editing different sections, never meet here. So this is an
advanced path, and kept simple.

## What can conflict

- **The chart**: both changed the same lines — bar 5 is `G7` on one side and
  `D♭7` on the other, or both reworded the same verse.
- **A voicing**: both chose a shape for the same key, in the same tuning and
  variation, and chose differently.
- **A property**: both changed the same one — the title, the artist, the
  notation — differently.
- **A song deleted on one side and edited on the other.**
- **A file that is not a song**, changed on both sides where the lines
  overlap. The cifra-aware merge does not apply; git's line merge does.

## Meeting one

Whoever syncs second meets the conflict. That is the right person: they have
the change that collided in front of them. Nobody else is told, beyond the
resolved merge appearing in the history (workflow 6).

The book shows *needs you* (workflow 8), and each song in conflict carries a
*conflict* badge in search. Pressing the book opens its songs, with
*2 songs need you.* and **Settle** above them (workflow 7 §A book's page).

**Until it is settled, the song shows the user's own version**, with the
conflicted places marked, so that someone who opens it to play mid-lesson
gets a song, not a puzzle.

**The rest of the book carries on.** A git merge is book-wide: until every
song in it is settled it cannot be committed, and nothing can be pushed. But
everything that merged cleanly is already in the working copy, so the other
songs show the incoming changes at once, and reading and editing go on
everywhere. **Saving in that book** asks the user to settle the conflicts
first, since a save made in the middle of a merge would be folded into it.
Conflicts are few and quick, so that is a short wait rather than a blocked
book.

## Settling one

Opening a song in conflict shows its conflicts one at a time, each as the two
versions side by side in musical terms — two bars rendered, two diagrams —
named for who wrote each: *yours* and *Ana's*. For each:

- **keep mine**;
- **take theirs**;
- **edit**: the song's text opens in the editor (workflow 3) with git's
  conflict markers where the two sides differ — `<<<<<<<`, `=======`,
  `>>>>>>>` — and the user edits them away. They are what anyone who has met
  git expects, and editing covers every case the other two do not, keeping
  both included. The marker lines name the two sides as the screen does —
  `<<<<<<< yours`, `>>>>>>> Ana's` — not the format's `ours` and `theirs`:
  a marker line is one whatever follows it (cifra.md §11.12.3), and the
  text is never saved holding one. The editor numbers its lines and colours
  the marker lines. *Save* refuses while a marker line remains, and points
  at it: *Go to line 10* puts the cursor on it.
- **keep both** — offered on a *voicing* conflict: the other person's shape
  goes into a new variation named for them (*Ana's*), so neither arrangement
  is lost (workflow 5); yours stays in use. Choosing it again for another
  chord adds to the same variation.

**Deleted on one side, edited on the other** is offered as *keep the song,
with the edits* or *delete it*, keeping first, since a deletion is the easier
one to make again.

**A file that is not a song** is settled in the file view (workflow 14), with
*keep mine*, *take theirs*, or editing its text with the markers in it.

**Keep both, for a song** splits a song rather than settling it conflict by
conflict: yours stays as it is, and the other person's version is written
beside it as `<name>-ana.cifra.md`, for when two people have really made two
songs. Both are canonical.

When every conflict in the book is settled, the merge is committed, listed in
history as *merged, with your resolution* (workflow 6), and pushed.

## Leaving one

A conflict can wait indefinitely. The book stays *needs you* and receives
nothing new from sync meanwhile; the user's other books are unaffected.

*Abandon the merge* puts the book back as it was before the sync, with the
incoming changes still waiting, to be merged at the next sync.
