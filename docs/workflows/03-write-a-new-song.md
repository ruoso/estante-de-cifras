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
- **A preview** of the song as it will be read sits beside the text when the
  editor itself is **at least 640px wide** — a text of at least 280px beside
  the 340px preview, and the gap between. Narrower, whatever the device, it is
  *Text | Preview*, one at a time, with *Help* beside it: a phone held
  upright, as before, and now a phone turned sideways or a narrow window on a
  computer too. The editor's own width decides, not the screen's layout,
  since the side rail can leave a wide screen a narrow editor.
- **Help** explains the few marks the format asks for, in plain words with
  examples that go straight into the song (§Help with the format), and the
  editor points to it when what was typed looks like another format (§When it
  looks like another format).

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

A cifra that writes its chords inside the words, `[G]Walk the [C]road`, is
fenced like any other; it is then the case below.

### Help with the format

*Help*, with a question-mark icon and its word, sits in the editor's own bar:
on a phone beside *Text | Preview*, on a tablet and a computer beside *Add
section*. It is the same in the editor of a new song and of a saved one
(workflow 4), and only there: the file view's raw editor (workflow 14) is for
those who know the format.

It opens **Writing a song**: on a phone a sheet from the bottom, tall enough to
read; on a tablet and a computer a panel hanging from *Help*, over the
preview, so the text stays in sight. One scrolling page of short topics, each
a heading, a sentence or two and an example — never the specification, and
nothing it does not need. It is bundled with the app, so it opens offline.

*A song here is plain text. A few marks tell the app what is music.*

1. **The title and details** — *The first line is the title, after #. Under
   it, details as a list: who it is by, the key.*

   ```
   # Moonlit Road
   - artist: The Porch Band
   - key: G
   ```

2. **Parts and the music fence** — *Each part of the song starts with ## and
   its name. Its music goes between two lines of three backticks, so the app
   reads it as chords and words. ~~~ works too, on a keyboard where the
   backtick is hard to type.*

   ````
   ## Verse
   ```
   G                C
   Walk the moonlit road
   ```
   ````

3. **Chords over words** — *Put the chords on their own line, right above the
   words, each over the syllable where it changes. No blank line between
   them. Chords inside the words, like [G]Walk, are not read.*

   ````
   ## Chorus
   ```
   C          G
   Sing it slow
   D             G
   All the way home
   ```
   ````

4. **Bars** — *A | separates bars. % plays the bar before again.*

   ````
   ## Intro
   ```
   G | % | C | D
   ```
   ````

5. **Repeats** — *|: and :| around bars play them twice; x3 after them plays
   them three times. 1. and 2. start the ending of each time through.*

   ````
   ## Bridge
   ```
   |: Em | C :| x3
   |: G | C |1. D | G :|2. D | D |
   ```
   ````

6. **Part names inside the music** — *[Chorus] on a line of its own, inside
   the music, starts a part too — that is how cifra sites write it. Between
   the brackets goes a name, not a chord.*

   ````
   ```
   [Chorus]
   G | C | D | G
   ```
   ````

7. **Notes** — *Lines outside the backticks are notes: shown as written,
   never read as chords. Inside the music, a line that starts with // is a
   note in its place.*

   ````
   ## Verse 2
   Softer the second time.
   ```
   // guitar alone
   G | C | D | G
   ```
   ````

8. **How to play a chord** — *Below a line of ---, a heading with the
   instrument's strings, then each chord with its frets from the lowest
   string; x for a string not played. Arranging for an instrument writes these
   for you (workflow 5).*

   ```
   ---

   ## Voicings: E2 A2 D3 G3 B3 E4
   - G: 320003
   - C: x32010
   ```

Each example is shown as it is typed, in the editor's monospaced face. The
parts' examples (2–7) carry **Insert**: it puts the example where *Add
section* puts a new part, closes the help, and leaves the cursor at the end of
what was inserted, which one undo takes back. The title (1) and the voicings
(8) carry **Copy** instead, which says *Copied*: a song already has a title,
and a voicing belongs in the song's own voicings part, whose place and tuning
the writer knows and the help does not. Every example reads in the preview
exactly as the topic says, with no word the format does not know.

The help closes with its close button, Escape, a tap outside, or Insert;
focus goes back to what opened it — *Help*, or the notice's *Show me how*
(below) — or to the text after Insert. Opened from *Show me how*, it opens at
that topic, its heading the first thing read. If the device refuses the copy,
the button says *Could not copy — select the example instead*, and the
example stays selectable as text.

In another language the sentences, the parts' names and the words sung are
translated; the marks are not — `#`, `##`, the backticks, `|`, `%`, `|:`,
`:|`, `x3`, `1.`, `[ ]`, `//`, `---`, the chord symbols, the tuning, and
`Voicings`, which is the format's name for the default voicings and would be a
variation of its own if translated (cifra.md §7.3). The chord symbols are ones
every notation writes alike.

### When it looks like another format

A writer who knows another way of writing chords types it, and the format
reads it as something else without complaint: `[Am]Walk the road` inside the
music is a part named *Am* (cifra.md §1.7.2), and chords typed outside the
backticks are notes (§1.9). The editor says so, in a notice above the text
with **Show me how**, which opens the help at the topic that answers it:

- **Chords in brackets** — a part name in brackets that reads as a chord
  (`[Am]`, `[G7]`), or, in notes, a chord in brackets followed at once by a
  letter (`[G]Walk`): *Line 4 looks like chords in brackets. Here a chord goes
  on its own line, above its words.* Opens at *Chords over words*.
- **Chords outside the music** — the song has no music fence and a line of it
  would read as chords, which is what the reader reports for a chart never
  fenced (§1.9): *Line 4 looks like chords, but it is outside the music, so it
  is kept as a note. Music goes between two lines of three backticks.* Opens
  at *Parts and the music fence*. This notice also offers **Put it in the
  music**, which fences the line's paragraph in one undoable step (workflow 4
  §Editing).

One notice at a time, chords in brackets first, naming the first line it
holds for. A line counts once the cursor has left it, or at once for pasted
text, so the notice does not appear halfway through typing `[A`. It goes when
the text no longer holds the case; its dismiss button sends it away for the
rest of this editing of the song. It never stops a save, and the editor does
not rewrite the text unasked (*Put it in the music* is the writer's press,
never automatic): the writer decides what was meant — a part named *A*
in brackets is legitimate, and the notice only says it looks like a chord.
It comes at the moment the editor marks the words it does not read as chords
and the save lists them before saving (workflow 4 §Saving); the notice is what
points from that moment to the help.

## The first save

*Save* names the file, commits it with the message *Add Garota de Ipanema*,
and from then on the song is an ordinary one: editing it is workflow 4. Like
every save, it commits and then pushes — at once if there is a network, at the
next sync if not (workflow 4, §Save pushes).

Before it does, the save says where the song goes: the book, and the file
name it will take — with its `-2` if the name is taken — shown, not editable,
with *Named once, from the title. Changing the title later edits its heading,
not the file.* The book is changed from the line above the editor, not here.
