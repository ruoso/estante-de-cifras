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
  confirmed. A pending address — the link sent, not yet opened — keeps it,
  since a link not opened is no way back in.
- **Add one** opens the account screen at its Recovery email region, focus on
  the region (its field, in the *none* state). The banner is on the account
  screen too, where *Add one* moves to the region below.
- **Where it sits.** Below the header chrome, never inside it: on a phone
  between the header row (*Estante*, the instrument chip, the account
  affordance) and the destination; on a tablet and a computer across the head
  of the main pane, beside the rail, not in it. It does not scroll with the
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
  session stops working at its next request.
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

## Later

- **Pairing a device from one already signed in**: *add a device* shows a
  short code or QR code, the new device takes it, and the old one approves —
  as WhatsApp Web does. It covers the third case without email; the
  browser's own QR flow already covers most of the second.
- **Saying that a book has unsaved changes on another device.**
- **Removing the recovery email** without putting another in its place.
  Changing it covers a wrong or outdated address, and deleting the account
  (workflow 17) removes it; going back to a passkey-only account on purpose
  is a small decision of its own, bounded by §The last way in.
