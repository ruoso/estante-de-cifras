# 6. History

Status: decided.

What changed in a song, when, by whom, and going back. The book's history as
git sees it — every file, plain line diffs — is the file view's (workflow
14). This is the same log seen through one song and the format.

Every book is a full clone (DIRECTION §3), so all of it works offline.

## The list

From the reading view, *history* lists the song's versions, newest first.
Each entry gives:

- the **note** it was saved with (workflow 4);
- **who** saved it: the author's name as the commit gives it, or *you* for
  the user's own saves — recognised by the email the host account supplies,
  or by the name given before sign-in;
- **when**;
- the **summary** of what changed, in musical terms.

**Unsaved changes are the first entry**, when there are any: *unsaved, on
this device*. The history then reads as one line, from the first save to
what is on screen now.

**Merges are not entries.** A sync that joins two people's changes makes a
merge commit (DIRECTION §3.1), but the changes it joins are already listed as
the saves they came from, so listing the merge too is noise. The exception
is a merge whose resolution changed the song — a conflict the user settled
(workflow 9) — which is listed as *merged, with your resolution*, because
that is a change nobody saved in the ordinary way.

**Renames are followed.** A song renamed or moved, in the file view or by
someone using git on a computer, keeps its history: the list starts where
the song did, not where its current name did.

## A version

Opening an entry shows the song as it was then, to be read, beside what
changed from the version before it.

**The diff** is the musical summary by default: *Verse bar 5: G7 → D♭7;
voicings for G4 C4 E4 A4: Cm changed*. *Show the text* gives the line diff of
the file, for whoever wants to see exactly what was written.

Each version is compared with the one before it, which is what *what
changed* means. One other comparison is offered, **compare with now**,
against the working copy. Comparing any two versions chosen freely is not
built at first.

## Restoring

*Restore this version* writes it into the working copy, to be saved as a new
version (workflow 4). History is never rewritten.

When the working copy already holds unsaved changes, restoring would replace
them, so it asks first and shows what would be lost, as discard does.

A whole version is restored, not part of one; the save sheet then shows
exactly what that changes from the current one.

## Deleted songs

Deleting happens only in the file view (DIRECTION §4), and a deleted song is
not in search, so it has no history to open from a song. It is recovered
from the file view instead, which shows deleted files in a book's history and
can bring one back into the working copy (workflow 14).

## Later

**Restoring part of a version.** *Bring back the ukulele voicings from last
week* is a real need: one block, not the whole song. The semantic diff
already knows the song in blocks, so this is a matter of offering it.
