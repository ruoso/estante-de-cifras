# 13. A new device

Status: decided.

Signing in on a phone, tablet or computer, and finding one's shelf there:
the books, the instruments, the preferences. Also the reverse — signing out —
since it is the same question asked the other way: what on this device is the
account's.

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
  set one; an account is made with a passkey alone and has none until its
  owner adds it.

## The recovery email

An account starts with a passkey and **no email**: the first run asks for
nothing (workflow 1), and the address is never in a book's history (commits
carry the no-reply address, DIRECTION §3.3). The recovery email is the one
address the service holds for an account, and it is used for one thing — to
mail the sign-in link. It is never shown to anyone but the account's owner,
never written to the home book or a book, and never logged.

- **Setting it.** On the account screen (below), a signed-in person types an
  address and asks for a **verification link**. Nothing changes yet: the
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
  alone.
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
- **Asking for a recovery email unprompted** — after a first sign-in, or
  when a passkey is added — rather than leaving it to the account screen.
