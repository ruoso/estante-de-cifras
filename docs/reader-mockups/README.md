# Reader mockups

The reMarkable reader's screens ([`../remarkable-reader.md`](../remarkable-reader.md),
[workflow 19](../workflows/19-remarkable-reader.md)), drawn at the reMarkable 2's own
size. They are viewed on a design canvas:
<https://claude.ai/artifact/8SoCHCPaPF6Eapkcitw2d2> (private to its owner until shared).
This directory is the source of that canvas, kept here so it can be read and diffed
beside the decisions it draws. The files rely on the canvas's runtime and do not render
on their own.

**Different rules from [`../mockups/`](../mockups/).** Those boards draw the web app on a
phone, a tablet and a computer, in the app's themes, from `../mockups/theme.css`. These
draw an e-ink screen, and follow workflow 19's refresh budget instead:

- **One screen per board, at 1404 × 1872** — the rM2's panel, portrait, no device frame.
- **One bit**: black on white, no greys, no tints, strokes of 2 px or more; emphasis by
  weight, size and inversion. No `theme.css`: every colour is `#000` or `#fff`.
- **Fixed regions**: a 140 px bar, the page, a 100 px foot, on every screen.
- **Paged, never scrolled**, and nothing that moves.
- Faces as the reader carries them: Atkinson Hyperlegible for the interface, Figtree for
  the chart.

| Board | Shows |
|---|---|
| `Main` | Not paired |
| `Pair-code` | Pairing: the code, still until approved or expired |
| `Settings` | The account, sync, shapes hidden, version, Sign out |
| `Shelf` | The shelf, Sync and its one line |
| `Book` | A book: setlists first, songs, the two letter rows |
| `Setlist` | A setlist: keys, notes, a missing song |
| `Song-lyrics` | A song with words, page 1, large shapes |
| `Song-key` | The key grid in place of the strip |
| `Play` | Playing a setlist: a song's last page, Next |
| `Song` | A choro (Noites Cariocas): bars four to a row, 16 compact shapes |
| `Play-choro` | A choro's last page in a setlist, Next with the setlist's note |
| `Song-paged` | 24 shapes on a page: the strip paged, 1–16 of 24 |
| `Song-hidden` | Shapes hidden: the whole of Três Estrelinhas on one page |
| `Song-shape-tap` | A diagram tapped: hide this voicing in every song? |
| `Song-known` | The shapes the player knows hidden: one row, more music |

The choros are from a book of the owner's (their chord charts, no lyrics); the songs
with words use invented lyrics, as the app's boards do.
