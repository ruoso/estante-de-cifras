# 18. Help and the tour

Status: decided.

How someone finds out what a screen is for, and how someone new learns the
app without being made to.

## Help on every page

Every page has **Help**, a question-mark button in its app bar (on the
shell, beside the account button in the header; in the phone's editor, in its
bottom bar, where the title keeps the app bar's room). It opens a panel about
*that* page: its name, a sentence or two on what it is for, and a short list
of what can be done there, in the words the page itself uses. Nothing in it
is a link that leaves the page; it is read and closed.

Below the page's own help, **Other pages** lists every page's help by name,
so the panel is also the app's whole manual: choosing one shows it in the same
panel, and *Back to* returns to the page's own. The pages it covers:

| Help for        | Where                                                    |
| --------------- | -------------------------------------------------------- |
| Search          | the Search tab (workflow 2)                              |
| Books           | the Books tab, the shelf (workflows 1, 7)                |
| A book          | a book's own page: songs, setlists, files, people        |
| Setlists        | the Setlists tab (workflow 12)                           |
| A setlist       | a setlist, and playing it through (workflow 12)          |
| Reading a song  | the reading view (workflow 2)                            |
| Editing a song  | the editor (workflows 3, 4)                              |
| Arranging       | arranging for an instrument (workflow 5)                 |
| The wizard      | choosing every shape at once (workflow 5)                |
| History         | a song's history (workflow 6)                            |
| Conflicts       | when two changes meet (workflow 9)                       |
| Files           | a book's files (workflow 14)                             |
| Sharing         | the people of a book and invitations (workflow 10)       |
| Chord explorer  | every shape of one chord (workflow 16)                   |
| Instruments     | your instruments, shapes and voicing rules (workflow 15) |
| Account         | the account and preferences (workflow 13)                |
| Adding a book   | a book from a link or from files (workflow 7)            |

The panel also offers **Take the tour**, at the foot, so the tour is never
gone once declined.

The copy ships with the app, in its four languages, so help opens offline.
It is a dialog: Escape and the close button put focus back on Help.

## The tour

The first time the app is opened on a device — cold, not through an
invitation, which wants *that book, now, not a tour* (workflow 1) — the shell
offers a tour, as an inline notice under the header, never a modal: *New to
Estante? A short tour shows how it works.* with **Take the tour** and **No,
thanks**. Either answer is remembered (the `tourOffered` register, the home
book), so it is offered once per person, not per launch; and the account's
home book carries it to a new device.

The tour is a short run of cards in a dialog, each a heading, two or three
sentences and, where a picture says it faster, the app's own drawing — a
chart line, a chord diagram:

1. **Welcome** — a book is a songbook: songs, setlists, shared or yours.
2. **Find a song** — Search looks through every book on the shelf.
3. **Read and play** — the chart, transpose, full screen.
4. **Your instrument** — the chip says which; every shape follows it.
5. **Arrange** — tap a chord to choose how you play it.
6. **Write and edit** — the editor, saves and history.
7. **Setlists** — songs in order, in the key you play them.
8. **Works without a network** — it syncs when there is one; sign in to
   share.
9. **Help is always here** — the question mark on every page.

*Back*, *Next* and, on the last card, *Done*; *Skip tour* leaves it at any
card. It changes nothing on the shelf.
