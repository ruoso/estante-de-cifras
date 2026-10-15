# 4. Edit and save

Status: decided.

Changing a song that has been saved before, keeping the change as a version,
or throwing it away. Writing a song from nothing is workflow 3; what happens
when someone else changed it too is workflows 8 and 9.

## Editing

A song opens to be read; *edit* opens the editor on its text (workflow 3
describes the editor). Every change goes to the working copy as it is made,
and the song shows *unsaved changes* — in its own header, and as a badge in
search — until it is saved or the changes are discarded. Leaving the song,
closing the tab or turning off the phone loses nothing, and so asks nothing.

**There is one kind of unsaved change, whatever made it.** Typing in the
editor is an edit. So is anything that changes the text from elsewhere:
choosing a shape in the reading view, adding a variation, running the voicing
wizard (workflow 5). All of them write to the same working copy, and are
saved or discarded the same way.

## Saving

*Save* opens a short sheet with two things on it:

- **what changed**, in musical terms — *Verse bar 5: G7 → D♭7; added
  voicings for G4 C4 E4 A4* — from the semantic diff;
- **a note**, prefilled from that summary, which the user may edit.

When there is no musical summary — a file that is not a song, such as
`README.md`, or a save with nothing musical in it — the note is prefilled
with the file it saves instead: *Update README.md*. A note the user clears
commits with that same line; a save is never left without a message. A save
that cannot be made says so on the sheet — *Not saved* — and keeps the
changes in the working copy, so the user can save again.

Confirming commits the one file, with the note as the commit message. Two
taps rather than one, because a save is a version the user chose to keep,
and seeing what is in it is part of choosing. It also catches the change
made by accident.

### Save pushes

Save commits and then pushes: at once if there is a network, at the next
sync if not (workflow 8). This settles the question left open in DIRECTION
§6. The user has two states to think about, unsaved and saved, and *saved*
means *shared with whoever shares the book*.

A teacher who wants drafts their students do not see keeps them in a book
of their own. A separate *publish* step is not built unless that proves not
to be enough.

### Normalising

cifra.md §8 has a writer keep the voicings part canonical and leave the chart
exactly as written. Edits made through the app's own actions already do. What
was typed by hand is normalised at save: the voicings put in canonical order,
the chart untouched.

A voicing line the parser could not read is one normalising would drop
(§8.3). Rather than lose it, **such a line stops the save**, with a message
pointing at it. The user fixes it or deletes it, and saves again.

The same holds for anything else after the rule that normalising would drop
(§7.2, §7.4, §8.2): a heading with no tuning, and the lines under it — most
often a section typed below a `---` out of Markdown habit — or text before
the first voicings block. The save stops at that line; the message says it
comes after the rule, that a section of the song belongs above the rule (move
the rule below it), and that a voicings heading needs a tuning.

### Several songs at once

Each song saves on its own, from its own page. Where many songs changed
together — the voicing wizard run across a setlist, a find-and-replace — *save
all* is in the book's section on the search screen and in the file view. It
opens the same sheet, listing every song and what changed in each, and makes
one commit.

### Who made the change

A commit has an author. The first save asks once for a name, *as it will
appear in a song's history*, and keeps it in the home book. After sign-in,
the host account supplies the email, and its name is offered in place of the
one given.

## Discarding

*Discard changes* puts the song back as last saved. It shows what would be
lost — the same summary as save — and always asks, since it is the one
destructive action here.

## A book the user cannot push to

A song in someone else's book can still be edited: the changes are in the
working copy, on this device. *Save* there explains that the book is someone
else's and offers to make it the user's own (workflow 11). Until then the
changes stay unsaved, and marked as such.
