# 4. Edit and save

Status: decided.

Changing a song that has been saved before, keeping the change as a version,
or throwing it away. Writing a song from nothing is workflow 3; what happens
when someone else changed it too is workflows 8 and 9.

## Editing

A song opens to be read; *edit* opens the editor on its text (workflow 3
describes the editor). Every change goes to the working copy as it is made,
and the song shows *unsaved changes* — in its own header, and as a badge in
search — until it is saved or the changes are discarded; on a phone the
header says it on a line of its own, *unsaved changes · Kept on this device*.
The header names the song by its title as the text has it now. Leaving the song,
closing the tab or turning off the phone loses nothing, and so asks nothing.

**There is one kind of unsaved change, whatever made it.** Typing in the
editor is an edit. So is anything that changes the text from elsewhere:
choosing a shape in the reading view, adding a variation, running the voicing
wizard (workflow 5). All of them write to the same working copy, and are
saved or discarded the same way.

The editor is the one workflow 3 describes, with its *Help* and the notice
when what is typed looks like another format (workflow 3 §Help with the
format, §When it looks like another format) — the same while editing a saved
song as while writing a new one. Words inside the music that the format does
not read as chords are marked in the text as they are typed, and the save
lists them and asks before saving (§Saving); a part named in brackets that
reads as a chord is the case the notice points to the help for.

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

Where the sheet sits follows the device. On a phone it is a sheet from the
bottom; on a tablet, and for a new song's first save on a computer (workflow
3), a dialog in the middle of the screen; on a computer, a panel beside the
song, so the text stays in reach while the save is looked at — what it shows
follows the text as it is edited, and a note the user typed is kept. Beside
the song on a computer is also the list of every song with unsaved changes,
on any book of the shelf, a step away from each other.

Confirming commits the one file, with the note as the commit message. Two
taps rather than one, because a save is a version the user chose to keep,
and seeing what is in it is part of choosing. It also catches the change
made by accident.

While the commit is being made the button reads *Saving…* and cannot be
pressed again, so one tap makes one version. The sheet closes as soon as the
version is kept on this device; it never waits on the network. A field the
save needs and does not have — the author's name on a first save, a new
song's name — leaves *Save* pressable: pressing it says, under the field,
what is missing, and puts the cursor there. A button that is grey with no
reason given is never how a save says no.

### Save pushes

Save commits and then pushes: at once if there is a network, at the next
sync if not (workflow 8). The push happens after the sheet has closed, as
sync does; a save that has not gone up yet shows as *saves waiting to go up*
on the book (workflow 8), not on the sheet. This settles the question left open in DIRECTION
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
the host account supplies the email, and the account's name — the one its
home book keeps, since the service stores none (DIRECTION §3.3) — is used in
place of the one given: it comes down with the home book to every device
signed in to the account, and a device that has it never asks. A sheet open
when it arrives stops asking and saves under it.

## Discarding

*Discard changes* puts the song back as last saved. It shows what would be
lost — the same summary as save — and always asks, since it is the one
destructive action here.

## A book the user cannot push to

A song in someone else's book can still be edited: the changes are in the
working copy, on this device. *Save* there explains that the book is someone
else's and offers to make it the user's own (workflow 11). Until then the
changes stay unsaved, and marked as such.
