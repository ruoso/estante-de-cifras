# 13. A new device

Status: decided.

Signing in on a phone, tablet or computer, and finding one's shelf there:
the books, the instruments, the preferences. Also the reverse — signing out —
since it is the same question asked the other way: what on this device is the
account's.

## Signing in, or making an account

There is **one sign-in surface**, and every way in opens it the same way: the
first run's *Sign in or make an account* row (workflow 1 §Cold), the account
screen's not-signed-in card, *Mine on Estante* and the add-book sheet
(workflow 7), and the invited screen (workflow 1 §Invited), which draws the
same two sections under its own heading. Its heading is *Sign in or make an
account*, and it has two sections, in this order:

- **Already have an account?** — **Use a passkey** (the browser's own prompt,
  §Signing in on another device) and **Email me a link** (the emailed link,
  below), with the note that the link is the way in where no passkey can be
  reached.
- **New here?** — **Make an account**, which makes a passkey on this device
  and with it a new account, and the line *Makes a new account with a passkey.
  Already have one? Sign in above. This would be a second, separate account.*
  Making an account never joins one the person already has: the service makes
  a new account for every signed-out passkey made, so the section says so,
  and sends whoever has one to the section above.

No entry chooses a door for the person, and none opens the surface on a step
past the two sections — the account card is one *Sign in or make an account*
button (*Bring your books to this device, or start keeping them on Estante*),
not a passkey / email pair of its own. The one exception is a press that
already names a step: *Mine on Estante*'s *No passkey here? Email me a link*
(workflow 7) opens straight on the email step.

On a device with no passkey for Estante, *Use a passkey* gets nothing back: the
browser answers just as if the person had cancelled its prompt, and the app
cannot tell the two apart. So a cancelled *Use a passkey* is not met with an
error. It leaves one calm line above the two sections, saying what to do if
there is no passkey here: *No passkey for Estante on this device? If you
already have an account, Email me a link signs you in. If not, Make an account
under New here? starts one.* The line blames nobody and goes away with the
next press. A cancelled *Make an account* gets no line, because that person
already chose the door.

Making an account is followed at once by **Add a recovery email** (§The
recovery email). Signing in is not: an account that already exists has the
account screen and the banner for that.

## Signing in on another device

How it goes depends on whether the device can reach a passkey the user
already has.

- **The same ecosystem** — an iPhone's passkey on an iPad or a Mac, an
  Android phone's on another Android device or in Chrome. The passkey is
  already there, synced by iCloud Keychain or Google Password Manager. *Sign
  in* offers it, the user confirms with their face or finger, and that is
  all.
- **Another ecosystem** — a passkey on an iPhone, and a Windows laptop. The
  browser's own passkey prompt offers *use a phone or tablet* and shows a QR
  code; the phone scans it, confirms, and proves it is nearby over Bluetooth.
  Nothing in the app beyond standard WebAuthn. Once in, the app offers to make
  a passkey on the laptop, so the next time is the first case.
- **Neither** — a borrowed computer, no Bluetooth, a browser where this is
  patchy (desktop Linux): the **emailed link**. It is also how an account is
  recovered when every device holding a passkey is lost. The link goes to the
  account's **recovery email** (below), so it reaches only an account that has
  set one; an account is asked for one the moment it is made (§The recovery
  email), and has none if its owner leaves that for later.

## The recovery email

An account is made with a passkey alone, and is **asked for its recovery
email at once** (§Asked when the account is made, below): a new account's only
way back in is otherwise the one passkey just made. It may be left for later,
so an account can still have **no email**. The first run itself still asks
for nothing (workflow 1): the question comes only after someone chose to make
an account. The address is never in a book's history (commits carry the
no-reply address, DIRECTION §3.3). The recovery email is the one
address the service holds for an account, and it is used for one thing — to
mail the sign-in link. It is never shown to anyone but the account's owner,
never written to the home book or a book, and never logged.

- **Setting it.** On the account screen (below), or in the step right
  after making an account (§Asked when the account is made), a signed-in
  person types an address and asks for a **verification link**. Nothing changes yet: the
  address is written to the account only when the link is opened. The region
  then says *waiting for you to confirm* and names the address it was sent
  to, with **send again** and **use a different address**. The link works
  once and expires as the sign-in link does (fifteen minutes); asking again
  replaces the earlier link.
- **Confirming it.** The link opens the app at its own page on whatever
  device it is opened on, signed in or not. Opening it confirms the address
  and says so — *Your recovery email is confirmed* — and nothing else: it
  **does not sign in**. It is not a sign-in link, and the device that opens
  it may not be the person's. An expired or used link says *this link has
  expired or was already used — send a new one from the account screen*.
- **Changing it.** The same steps from a confirmed address: the current one
  **stays in effect until the new one is confirmed**, so a mistyped new
  address never leaves the account without a way back. When the new one is
  confirmed, the old address gets a short notice that the recovery email was
  changed — no link, nothing to do — so a change the owner did not make does
  not go unseen.
- **Who holds an address.** An address belongs to one account at most. The
  request is always answered *check your inbox* and never says whether an
  address is taken; the one who opens the link has shown the mailbox is
  theirs, so it is there, and only there, that an address already held by
  another account is refused: *this address is the recovery email of another
  Estante account — sign in with it instead*.
- **It needs a connection**, like signing in: the address lives only on the
  service. Offline, the region says so and its actions wait; nothing in a
  song does.

### Asked when the account is made

Right after *Make an account* succeeds, the sign-in surface shows one more
step, **Add a recovery email**: the region's *none* warning (*If you lose every
device with a passkey, there is no way back in*), the *Recovery email* field
with its hint, and two buttons — **Send link** and **Not now**. It is the same
set-and-verify as the account screen's region, not a second one: **Send link**
mails the verification link, and the step then shows the region's *waiting
for you to confirm* words naming the address, with **Done**. **Done** and
**Not now** both go on to where the person was headed — the shelf, or the book
an invitation opens (workflow 1 §Invited) — which by then is already coming
down: the home book attaches and an invitation is accepted behind the step,
so nothing waits on it. Offline it cannot be reached at all, since making an
account needs a connection too. **Not now** leaves the address to the account
screen, and to the banner.

### The banner

While a signed-in account has **no confirmed recovery email**, a banner sits
in the shell on every screen:

> **No recovery email yet.** If you lose your passkeys, you lose this account
> and your books on Estante. — **Add one**

- **Not dismissible**, and not on a timer: it goes only when the address is
  confirmed. So it is kept to one compact row — the warning, *No recovery
  email yet.*, with *Add one* beside it, in the small size — and never grows
  into a block above every song. The title is a disclosure: pressed, the row
  grows the sentence that says why (*If you lose your passkeys…*), and pressed
  again it folds back (the persona exploration of 2026-11-01). A pending address — the link sent, not yet opened — keeps it,
  since a link not opened is no way back in.
- **Add one** opens the account screen at its Recovery email region, focus on
  the region (its field, in the *none* state). The banner is on the account
  screen too, where *Add one* moves to the region below.
- **Where it sits.** Below the header chrome, never inside it: on a phone
  between the header row (*Estante*, the instrument chip, the account
  affordance) and the destination; on a tablet and a computer under the one
  bar across the top, not in it. It does not scroll with the
  screen, and it takes its own room rather than covering anything. The notice
  that a new version of the app is ready (DIRECTION §3.7) stays as it is — a
  passing, dismissible notice floating over the top of the screen — and is
  never merged into the banner: one goes when dismissed, the other only when
  the account has a way back.
- **Reading full screen** (a song, a setlist's *Play*, workflows 8 and 12) it
  goes with the rest of the chrome and is back when the person leaves full
  screen: the middle of a performance is the worst moment for anything to
  appear (DIRECTION §3.7).
- **Screens without the header chrome.** A screen that takes the whole window
  in place of the destinations — a song being read, the editor, a book's
  history, its people — has no header row to sit below; there the banner sits
  at the top of the window, above the screen's own bar, taking its room the
  same way. The account screen draws it across the head of its main pane, as
  the destinations do. The only screens without it are the sign-in surface
  (whose *Add a recovery email* step asks the same thing), the page a
  verification link opens (it may be opened on a device that is not the
  person's), and reading full screen.
- **How it reads.** It is a notice in the warning tone the region's *No
  recovery email* badge uses, in each theme's own tokens — in Palco, the
  dark stage's warning tint with light text — and it says its state in words,
  never colour alone. To a screen reader it is a labelled region, *No recovery
  email yet*, read once in reading order after the header and before the
  screen, *Add one* a button in it; it is not a live region, so moving between
  screens does not announce it again.
- **What the device knows.** It shows when the service has answered that the
  account has no confirmed recovery email. Offline with no answer yet it is
  not shown, rather than claim what the device does not know — and adding one
  needs a connection anyway (§The recovery email).

### The last way in

An account must keep one way back. While it has **no confirmed recovery
email**, its **last passkey cannot be removed**: the Remove on it is replaced
by *your only way to sign in — add a recovery email or another passkey
first*. With a confirmed recovery email, every passkey is removable, since
the emailed link still signs in.

## What comes down

The **home book** first, so the instrument in use, the notation, the
language and the theme are right before anything else appears. Then **the
shelf** fills: every book the account had is listed at once, and each clones
in the background, its songs searchable as they arrive (workflow 2). Books
come in the shelf list's order. Recents are kept per device, so there is no
"most recently played" to go by, and a shelf is a handful of small books.

### The shelf is in the home book

For a new device to restore the shelf, it has to be written down where the
account keeps it. The home book holds the list of books on the shelf: each
one's link, and the user's label for it. Access itself is the account's,
held by the service, so nothing secret is written down.

### Every book the account has

What a device brings down is **every book the account has on Estante** —
owned, shared with it, its forks — not only what the home book happens to
list. At start, at sign-in and when it syncs, a signed-in device asks the
service for the account's books and puts back on the shelf any the home book
does not list: one never written there, or one an older version took off the
account's shelf when it was removed from a single device or when a device
signed out. The home book carries the repair to the account's other devices.
Two books are not put back: one **removed from this device** (workflow 7
§Removing a book), which only *Mine on Estante* brings back here, and a
fork's **original**, which the fork replaced on the shelf (workflow 11).
Offline, the shelf is what the home book lists, and the rest waits for the
network.

### Books that were only on the other device

A local book never put online has nothing on Estante to clone. The home book
lists it by title too, so the new device can say *only on your iPhone: My
songs — put it online there to have it here*, rather than letting it look
lost.

That line is a warning, not a book: nothing of it opens here, and it has a
**Dismiss**. Dismissing puts it away **on this device**, for good — across
restarts, kept with the device's own things like recents, not in the home
book. The home book's marker is the other device's to keep, and the next new
device should still be told. If the book is put online after all, it comes
in like any shared book; if it is removed there, the line goes on its own.

The device is named by its kind — *your iPhone*, *your iPad*, *your Android
phone*, *your Mac*, *your Windows computer* — which each device writes down
for itself in the home book when it signs in, worked out from the browser;
never a name the user typed, and never the device id. A device whose kind
cannot be told is *another device*.

### Unsaved changes

They stay on the device they were made on: the working copy belongs to a
device. Nothing travels, and nothing pretends to.

## A device used before signing in

It has its own home book, and perhaps a local *My songs* with songs in it.

- The local **home book** merges into the account's key by key, as two
  devices' home books do (workflow 8).
- The two ***My songs*** are offered as a choice: **merge** this device's
  songs into the account's — the upload preview, unrelated histories and all
  (workflow 7) — or **keep both**, the local one labelled *My songs (this
  device)* on the shelf. *Later* leaves both as they are and asks again the
  next time the app starts.

The account's *My songs* is the one a device put online: the home book
records which hosted book that is when it happens. The choice is offered only
when there is one and this device's own *My songs* has songs in it. When the
account's *My songs* was never put online it is only on another device, with
nothing here to merge into: no choice is offered, this device keeps its own,
and the other is listed as *only on your iPhone: My songs* like any local
book. Merging takes this device's songs as they stand, unsaved changes
included, and on *Merge and save* this device's *My songs* leaves the shelf —
its songs are now in the account's.

## The account screen

- **Preferences** — **theme**, **density** and **language** (workflow 1) and
  how **chord diagrams** are drawn (workflow 16), drawn in
  [the mockups](../mockups/Theme-picker.dc.html). Present and writable whether
  or not the user is signed in, since preferences live in the local home book
  from the first minute; the signed-in sections below are additive. Theme
  offers Automatic (the default, following the device's light or dark mode),
  Estante, Caderno and Palco; density Compact, Comfortable (the default) and
  Roomy; chord diagrams by hand (Right-handed, the default, or Left-handed) and
  neck (Vertical, the default, or Horizontal) — in that order, theme, density,
  chord diagrams, language; each chosen one marked by a word, never colour
  alone. Last comes **your name**, the name one's saves carry (workflow 4
  §Who made the change): a row showing it — or *Not set yet* before the first
  save asks — with *Shown on the changes you save from now on. Changes already
  saved keep the name they were made with.*, and **change**, which opens a
  small dialog prefilled with the name; a blank name is refused in words,
  *Your name can’t be empty.*
- **Signed-in devices**, each with when it was last used, and **sign out**
  for any of them. A lost phone is signed out from the laptop, and its
  session stops working at its next request. A paired reMarkable is one of
  them, *your reMarkable*, marked *Reads only* (§Pairing a reMarkable). At the
  section's foot, **Pair a device** — *Read your books on a reMarkable. It
  shows a code; enter it here.* — opens the pairing page.
- **Passkeys**, listed, and removable — all but the last way in (§The last
  way in).
- **Recovery email** (§The recovery email), below Passkeys, since it is what
  backs them up. Its three states, each said in words: **none** — *no
  recovery email: if you lose every device with a passkey, there is no way
  back in*, an address field and **send a verification link**; **waiting for
  you to confirm**, naming the address the link went to, with **send again**
  and **use a different address**; and **confirmed**, showing the address,
  marked *Confirmed*, with **change**. The address is shown here, to its
  owner, and nowhere else in the app. Shown only when signed in.

Who is signed in sits with **sign out of this device**: the account's name
and *Signed in on this device*, and the button beside it, rather than on this
device's row of the devices list. On a phone and a tablet the screen is one
column in the order above. On a computer it is drawn in
[Theme-picker](../mockups/Theme-picker.dc.html) and
[W13](../mockups/W13-new-device.dc.html): a rail at the left holds the
screen's title, who is signed in and *sign out of this device* (or, not signed
in, the way to sign in); beside it, Preferences in two columns — theme beside
density, chord diagrams beside language, your name below them across both —
and below them, full width, the
devices, passkeys, recovery email and Leaving Estante. The reading order stays
the order above.

## Signing out

Signing out asks whether to **remove this account's books from this device**
— the default, for a borrowed or shared device — or **keep them**, as local
books no longer synced. Either way, saves not yet pushed and unsaved changes
are counted and warned about first, and a book that is only on this device is
never removed without the download being offered.

Signing out leaves the account's shelf as it is. Signing back in on this
device brings every book back (§Every book the account has), and a book kept
as a local book is the account's again — synced, with what was changed while
signed out. The books removed from this device are forgotten with the
account: the next person to sign in here gets all of theirs.

## Pairing a reMarkable

A reMarkable has no browser, so it cannot use a passkey or open an emailed
link. It is **paired** instead, the way a television is
([remarkable-reader.md §5.1](../remarkable-reader.md)): the reader shows a
short code and an address (workflow 19 §Pairing), and the person, signed in on
a phone, a tablet or a computer, enters the code there. This section is the web
side; the reader's pages are workflow 19's.

### Where it lives

- **An address**, the one the reader shows: **estantedecifras.app/pair**. It
  opens the app at its **Pair a device** page, on whatever device it is typed
  on. The bare domain forwards there with the path kept (DIRECTION §3.3), so
  the short address is the one to type. It holds no token: anyone may open
  the page, and only a signed-in account can approve a code from it.
- **The account screen**: **Pair a device** at the foot of Signed-in devices
  (§The account screen) opens the same page.

The page is a deeper screen: its bar is **Back** — to the account screen, or to
the shelf when the address opened it — the title *Pair a device*, then the
chip, Help and the account. The banner (§The banner) sits above it as on any
signed-in screen.

### Not signed in

The page shows *Sign in to the account whose books the reMarkable should read.*
above the one sign-in surface (§Signing in, or making an account), drawn under
the page's heading as the invited screen draws it, both doors and all. Signed in
there, the page goes on to the code, on this page. An emailed sign-in link
opens the shelf like any other (it may be opened in another tab or on another
device); the person types the address again. A code lives ten minutes, and the
reader's *Get a new code* is always there if it ran out.

### The page

One page, one field, one button. Nothing is checked before the press: the code
is approved or refused when **Pair your reMarkable** is pressed.

> **Pair a device**
> Enter the code your reMarkable shows.
>
> Code — *Six letters and numbers, like KQ7-4TM*
> [ KQ7-4TM ]
>
> **What your reMarkable will be able to do.** Read every book on your shelf,
> with your instruments and preferences. It can never change one: it saves
> nothing and sends nothing back. It stays paired until you sign it out, here
> or on the reMarkable.
>
> Only enter a code shown on your own reMarkable, in front of you: whoever's
> device shows it will read your books.
>
> [ Pair your reMarkable ]

- **The field** takes the code as it is typed: upper or lower case, with or
  without the dash or spaces. The code's letters leave out those that are
  read as one another (0 and O, 1, I and L), so nothing on the screen can be
  misread. Fewer or more than six letters and numbers is said under the field
  on the press — *A code is six letters and numbers, like KQ7-4TM.* — and
  nothing is sent.
- **The warning line** is there because a code is a key: someone who sends a
  person a code of their own, asking them to enter it, would read that
  person's books. It is not a dialog and asks nothing; it is said where the
  code is entered.
- **Paired.** The page is replaced by *Your reMarkable is paired. Its shelf
  appears on it in a moment.* with **Done**, which opens the account screen at
  Signed-in devices, where it is now listed. The reader, polling, receives its
  session and opens its shelf (workflow 19 §Pairing).
- **Offline**, the button is disabled and the page says *You're offline.
  Pairing needs a connection.* The field keeps what was typed.

### A code that does not pair

Each refusal is said in words under the field, which keeps what was typed and
takes the focus, so the person can correct it and press again:

- **Unknown** — no reMarkable is showing it: *No reMarkable is showing that
  code. Check it against its screen and try again.*
- **Expired** — older than ten minutes: *That code has expired. Press Get a new
  code on your reMarkable, and enter the new one.*
- **Used** — already approved, by this account or another: *That code was
  already used. If your reMarkable is not paired, press Get a new code on it.*
- **Too many tries** — the service's rate limit: *Too many tries. Wait a few
  minutes and try again.*

### Among the signed-in devices

A paired reader is a signed-in device of the account (§The account screen),
listed by its kind — **your reMarkable** — never a browser's description, with
when it was last used, *Reads only* beside it as a word, and **Sign out**. Two
paired reMarkables are two rows, told apart by when each was last used. It is
never *This device*: the page approving it is a browser's. It writes nothing to
the home book, so it never appears as *only on your …* (§Books that were only on
the other device).

**Sign out** asks first, as for any device: *Sign your reMarkable out?* — *It
stops reading your books the next time it syncs, and they are removed from it.
Nothing in your account changes.* — **Sign out** and **Cancel**. Its session
stops working at its next request; at its next sync the reader removes the
books and returns to *Not paired*, saying *This reMarkable was signed out from
your account.* (workflow 19 §Pairing). Deleting the account (workflow 17) signs
it out with every other session.

### The copy, in the four locales

| | en | pt-BR | es-419 | it |
|---|---|---|---|---|
| The account screen's button | Pair a device | Parear um aparelho | Vincular un dispositivo | Associa un dispositivo |
| Its line | Read your books on a reMarkable. It shows a code; enter it here. | Leia seus livros num reMarkable. Ele mostra um código; digite-o aqui. | Lee tus libros en un reMarkable. Te muestra un código; escríbelo aquí. | Leggi i tuoi libri su un reMarkable. Mostra un codice: inseriscilo qui. |
| The page's title | Pair a device | Parear um aparelho | Vincular un dispositivo | Associa un dispositivo |
| Not signed in | Sign in to the account whose books the reMarkable should read. | Entre na conta cujos livros o reMarkable vai ler. | Inicia sesión en la cuenta cuyos libros leerá el reMarkable. | Accedi all’account di cui il reMarkable leggerà i libri. |
| Intro | Enter the code your reMarkable shows. | Digite o código que o seu reMarkable mostra. | Escribe el código que muestra tu reMarkable. | Inserisci il codice che mostra il tuo reMarkable. |
| Field label | Code | Código | Código | Codice |
| Field hint | Six letters and numbers, like KQ7-4TM | Seis letras e números, como KQ7-4TM | Seis letras y números, como KQ7-4TM | Sei lettere e numeri, come KQ7-4TM |
| What it can do (heading) | What your reMarkable will be able to do. | O que o seu reMarkable vai poder fazer. | Lo que podrá hacer tu reMarkable. | Cosa potrà fare il tuo reMarkable. |
| What it can do | Read every book on your shelf, with your instruments and preferences. It can never change one: it saves nothing and sends nothing back. It stays paired until you sign it out, here or on the reMarkable. | Ler todos os livros da sua estante, com seus instrumentos e preferências. Ele nunca muda nenhum: não salva nada e não envia nada de volta. Fica pareado até você encerrar a sessão dele, aqui ou no reMarkable. | Leer todos los libros de tu estantería, con tus instrumentos y preferencias. Nunca podrá cambiar ninguno: no guarda nada ni envía nada de vuelta. Seguirá vinculado hasta que cierres su sesión, aquí o en el reMarkable. | Leggere ogni libro del tuo scaffale, con i tuoi strumenti e le tue preferenze. Non potrà mai modificarne uno: non salva niente e non rimanda indietro niente. Resta associato finché non lo fai uscire, qui o sul reMarkable. |
| The warning | Only enter a code shown on your own reMarkable, in front of you: whoever's device shows it will read your books. | Só digite um código que aparece no seu próprio reMarkable, na sua frente: quem tiver o aparelho que o mostra vai ler os seus livros. | Escribe solo un código que aparezca en tu propio reMarkable, frente a ti: quien tenga el dispositivo que lo muestra leerá tus libros. | Inserisci solo un codice mostrato dal tuo reMarkable, davanti a te: chi ha il dispositivo che lo mostra leggerà i tuoi libri. |
| The button | Pair your reMarkable | Parear seu reMarkable | Vincular tu reMarkable | Associa il tuo reMarkable |
| Paired | Your reMarkable is paired. Its shelf appears on it in a moment. | Seu reMarkable está pareado. A estante aparece nele em instantes. | Tu reMarkable está vinculado. Su estantería aparecerá en él en un momento. | Il tuo reMarkable è associato. Il suo scaffale apparirà tra poco. |
| Done | Done | Pronto | Listo | Fatto |
| Offline | You're offline. Pairing needs a connection. | Você está sem conexão. Parear precisa de conexão. | Estás sin conexión. Vincular necesita conexión. | Sei offline. Per associare serve una connessione. |
| Malformed | A code is six letters and numbers, like KQ7-4TM. | Um código tem seis letras e números, como KQ7-4TM. | Un código tiene seis letras y números, como KQ7-4TM. | Un codice ha sei lettere e numeri, come KQ7-4TM. |
| Unknown | No reMarkable is showing that code. Check it against its screen and try again. | Nenhum reMarkable está mostrando esse código. Confira na tela dele e tente de novo. | Ningún reMarkable está mostrando ese código. Compáralo con su pantalla e inténtalo de nuevo. | Nessun reMarkable mostra questo codice. Controllalo sul suo schermo e riprova. |
| Expired | That code has expired. Press Get a new code on your reMarkable, and enter the new one. | Esse código expirou. Toque em *Get a new code* no seu reMarkable e digite o novo. | Ese código venció. Toca *Get a new code* en tu reMarkable y escribe el nuevo. | Questo codice è scaduto. Premi *Get a new code* sul tuo reMarkable e inserisci quello nuovo. |
| Used | That code was already used. If your reMarkable is not paired, press Get a new code on it. | Esse código já foi usado. Se o seu reMarkable não estiver pareado, toque em *Get a new code* nele. | Ese código ya se usó. Si tu reMarkable no está vinculado, toca *Get a new code* en él. | Questo codice è già stato usato. Se il tuo reMarkable non è associato, premi *Get a new code* su di esso. |
| Too many tries | Too many tries. Wait a few minutes and try again. | Tentativas demais. Espere alguns minutos e tente de novo. | Demasiados intentos. Espera unos minutos e inténtalo de nuevo. | Troppi tentativi. Aspetta qualche minuto e riprova. |
| The device's name | your reMarkable | seu reMarkable | tu reMarkable | il tuo reMarkable |
| Its mark | Reads only | Só leitura | Solo lectura | Solo lettura |
| Sign out (title) | Sign your reMarkable out? | Encerrar a sessão do seu reMarkable? | ¿Cerrar la sesión de tu reMarkable? | Far uscire il tuo reMarkable? |
| Sign out (body) | It stops reading your books the next time it syncs, and they are removed from it. Nothing in your account changes. | Ele para de ler seus livros na próxima sincronização, e eles são removidos dele. Nada muda na sua conta. | Deja de leer tus libros la próxima vez que se sincronice, y se eliminan de él. Nada cambia en tu cuenta. | Smette di leggere i tuoi libri alla prossima sincronizzazione, e vengono rimossi. Nel tuo account non cambia niente. |

The reader carries one locale, English (remarkable-reader.md §4), so its
*Get a new code* is named in English in every locale's expired and used lines —
the words the person sees on the reMarkable. The rest of the page is in the
app's language.

## Later

- **Pairing a device from one already signed in**: *add a device* shows a
  short code or QR code, the new device takes it, and the old one approves —
  as WhatsApp Web does. It covers the third case without email; the
  browser's own QR flow already covers most of the second. A reMarkable is
  already paired this way the other way round (§Pairing a reMarkable); a
  browser device is not.
- **Saying that a book has unsaved changes on another device.**
- **Removing the recovery email** without putting another in its place.
  Changing it covers a wrong or outdated address, and deleting the account
  (workflow 17) removes it; going back to a passkey-only account on purpose
  is a small decision of its own, bounded by §The last way in.
