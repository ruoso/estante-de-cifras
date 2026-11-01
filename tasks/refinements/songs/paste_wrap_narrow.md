# songs.paste_wrap_narrow — Fence a paste only when it is a cifra from elsewhere

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), task `songs.paste_wrap_narrow`
("Fence a paste only when it is a cifra from elsewhere"), under `task songs`.
It `depends !editor, !editor_errors_in_words, !arrange_in_editor` and sits in
`milestones.m5_complete`. The note, verbatim:

> Every paste that landed outside a fence was wrapped in a music fence (and,
> on an untitled song, had its first line lifted into the title): text copied
> in the same editor (a section moved, a verse repeated, a chord line),
> cifra.md that already carries its fences and sections, and a note of plain
> words alike. Wrap only a cifra from elsewhere: pasted text with a line of
> chords (the reader's readsAsChords, in the song's notation, a site's
> [Intro]-style labels aside) and no fence or # heading of its own. What this
> editor copied or cut pastes as CodeMirror pastes it (line-wise copies
> included); everything else goes in as it was copied, and a chord line left
> outside the music is still caught by the chords-outside notice and its Put
> it in the music. Source: review with the human 2026-11-01 (wrapping fired on
> copy and paste within the editor). Tests: unit (fencePaste: words, fenced or
> sectioned cifra.md, a bracket-labelled chord line, the song's notation);
> behavior (SongEditor: a section and a chord line copied in the editor paste
> back unwrapped with no notice, words pasted as they are, a cifra from
> elsewhere still fenced); e2e-web (the real clipboard: a chord line copied in
> the editor pastes as it is, a cifra written to the clipboard from outside is
> fenced with its Undo, on the three viewports; axe).

## Decisions

1. **The editor's own copy is a plain paste.** A `copy`/`cut` observer
   (`EditorView.domEventObservers`, which CodeMirror runs before its own copy
   handler, while the selection is still the one copied) records the text
   CodeMirror is about to put on the clipboard — the selected ranges, or with
   nothing selected the cursor's whole lines (its line-wise copy), joined by
   the document's line break (`copiedText`, `app/src/editor/SongEditor.jsx`).
   A paste whose text is that clip (line breaks normalised) returns `false`
   from the editor's paste handler, so CodeMirror's own paste runs: line-wise
   pastes land above the line as CodeMirror does them, multiple cursors work,
   and nothing is fenced or titled. The record is per editor instance and
   overwritten by the next copy; text copied elsewhere since then no longer
   matches, so it is judged on its own.
2. **A cifra from elsewhere is told by what it holds** (`readsAsForeignCifra`,
   `app/src/editor/fence-paste.js`): at least one line reads as chords by the
   reader's own `readsAsChords`, in the song's notation (`songDialect`), once a
   site's `[Intro]`-style bracket labels are set aside; and no line opens a
   fence or is a `#` heading — those are cifra.md's own structure, so the text
   is already cifra.md and goes in as it is.
3. **Everything else goes in as it was copied**: words with no chords (a
   note, lyrics alone) and fenced or sectioned cifra.md. Lifting the first line
   into the title happens only with a fence, as before.
4. **The notice is the safety net.** A line of chords that ends up outside the
   music (pasted back from the editor, or typed) is still named by *chords
   outside the music* (songs.editor_errors_in_words), whose *Put it in the
   music* fences its paragraph; chords inside the words (`[G]Walk`) pasted as
   notes are named by *chords in brackets*.

## Design delta (rides in this task's commit)

- `docs/workflows/03-write-a-new-song.md` §Pasting a cifra — what counts as a
  cifra from elsewhere, what goes in as it is, and the notice as the way to
  fence the rest.

## Tests

- unit: `fence-paste.test.js` — words pasted as they are; fenced and sectioned
  cifra.md as they are; `[Intro] Am G` read as chords, `[Intro]` alone not; a
  brazilian chord line in the song's notation.
- behavior: `SongEditor.behavior.test.jsx` — a section and a chord line copied
  in the editor paste back unwrapped with no notice; words pasted as they are;
  a cifra from elsewhere still fenced (the existing wrap-and-title test
  unchanged).
- e2e-web: `editor.spec.js` — on the real clipboard, a chord line copied in the
  editor pastes back with no fence and no notice; a cifra written to the
  clipboard from outside (`navigator.clipboard.writeText`) is fenced, with its
  Undo; axe.
