# 3. Write a new song

Status: decided.

From nothing to a song saved in a book. Arranging it for an instrument is
workflow 5; editing it afterwards is workflow 4.

## Ways in

- **From search**, when nothing matched: *create "Garota de Ipanema"*, with
  the query as its title.
- **From the empty shelf**: *write a song* (workflow 1).
- **From a book's section** on the search screen: *new song in this book*.
- **From the file view**, in the folder being looked at (workflow 14).
- **By pasting**: much of what people write is copied from somewhere else, a
  cifra site or a message, so pasting a whole song is a way in of its own,
  not an afterthought (below).

## The song before its first save

A new song is a new file in the working copy of its book. It is safe from the
first keystroke, and it appears in search with an *unsaved* badge like any
other unsaved work.

### Which book

The book it was started from, if any; otherwise *My songs*. A book the user
cannot push to is never the default, and is not offered.

The book is shown above the editor and can be changed until the first save.
Until then the file is only in the working copy, so moving it costs nothing.
A song started from the file view goes in the folder being looked at; any
other new song goes at the root of its book.

### Its file name

The title may not be known when writing starts, so the file is **named at the
first save**, from the title as it is then, and never renamed by the app
afterwards (DIRECTION §4). Until then it has a placeholder name,
`untitled.cifra.md` (`untitled-2.cifra.md` and so on), which only the file
view shows.

The name is the title folded to ASCII: accents dropped, lower case, runs of
anything else turned into one hyphen. *Coração Vagabundo* becomes
`coracao-vagabundo.cifra.md`. ASCII because accented file names are where
tools disagree: macOS and git have long differed over how an accented letter
is stored, and Explore Chords' backups found the same with zip. A name taken
in the same folder gains `-2`, `-3`.

### Abandoning it

*Discard* deletes the file — after asking, if it holds more than a title. A
new song left unsaved stays in the working copy, findable by its badge, for
as long as it is left there.

## The editor

cifra.md asks more of a writer than Explore Chords' format did: fences around
the music, `##` for sections, `#` for the title, a list for the properties.
The text stays the editor, because the text being the whole state is the
format's point. A structured editor is not built. The editor helps where the
syntax costs effort instead:

- **A new song starts from a template**: the title, the properties it will
  want, and one empty section with its fence.

  ````
  # Garota de Ipanema
  - artist:
  - notation: brazilian

  ## Intro
  ```
  ```
  ````

- **Add section** writes a heading and a fence, and puts the cursor inside.
- **A preview** of the song as it will be read sits beside the text on a wide
  screen, and a tap away on a phone.

### The notation property

cifra.md reads a song with no `notation` property as Brazilian. A new song
therefore always writes `notation:` from the user's preference, so that it
reads the same to someone whose preference differs.

### Pasting a cifra

Text pasted from a cifra site is chords over words with `[Intro]`-style
headings, and no fences. Outside a fence it would be read as notes — kept,
but not as music. So **when pasted text lands outside any fence, the editor
puts it inside one**, and says so in a message that offers to undo.

When the song has no title yet, the first line of what was pasted becomes the
title, under the same message.

## The first save

*Save* names the file, commits it with the message *Add Garota de Ipanema*,
and from then on the song is an ordinary one: editing it is workflow 4. Like
every save, it commits and then pushes — at once if there is a network, at the
next sync if not (workflow 4, §Save pushes).

Before it does, the save says where the song goes: the book, and the file
name it will take — with its `-2` if the name is taken — shown, not editable,
with *Named once, from the title. Changing the title later edits its heading,
not the file.* The book is changed from the line above the editor, not here.
