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
  recovered when every device holding a passkey is lost.

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
  device)* on the shelf.

## The account screen

- **Signed-in devices**, each with when it was last used, and **sign out**
  for any of them. A lost phone is signed out from the laptop, and its
  session stops working at its next request.
- **Passkeys**, listed, and removable.

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
