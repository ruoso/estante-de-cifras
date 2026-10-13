# 17. Leaving

Status: decided.

Taking one's data out of Estante and deleting the account — and what becomes
of the books other people are members of. It is the last question workflow 13
asks the other way (*what on this device is the account's*), asked once more and
for good: not *sign out of this device* but *end the account everywhere*. It
composes pieces already decided — the per-book download (workflow 7), losing
access (workflows 8, 10, 11) and the account screen (workflow 13) — and settles
the one thing none of them does: a book whose owner leaves.

Two things can be done here, and they are kept apart. **Taking your data out**
is a local, repeatable, offline-capable step: the device already holds every
book as a git clone, and hands each back as the repository it is. **Deleting the
account** is terminal, confirmed by typing the account's name, and is the one
action in the app that waits for a connection. Downloading does not delete, and
deleting does not download; the user may do either, both, or only the first and
walk away.

## Where leaving lives

A **Leaving Estante** region at the foot of the account screen (workflow 13
§The account screen), below Passkeys, reached from the header's account
affordance. It is shown **only when signed in** — there is no account to leave
otherwise, and Preferences above it stand with or without a session. The region
holds exactly two affordances, in order: **Take your data out** and **Delete my
account**. The order is deliberate: the data-out step comes first because it is
the safe one, and the one a leaver should do before the terminal one.

## Taking your data out

**Take your data out** lists every book the account can reach — the books the
user **owns**, the books they are a **member** of, and the **home book** — each
with a **Download**, and a single **Download everything** above them. Each
download is workflow 7's per-book download exactly: the repository as it stands
on this device, the `.git` directory with the whole history and the working
tree, unsaved changes included, written as a zip by the zip writer the app
already carries. *Download everything* is the same operation run over the list,
one zip per book; there is no server-side archive and no new endpoint (a
combined archive is a *Later* nicety, below).

This is a **local operation**. The client holds every book as a clone, so the
download reads from the device, not the service — it works **offline**, and it
works whether or not the account is about to be deleted. A book the user only
reads downloads the same way: it is on the shelf, so its clone is here. Taking
your data out changes nothing on the server and ends no membership; it is a
copy, made as often as wanted.

## Deleting the account

**Delete my account** opens a terminal dialog, guarded like a book delete by a
**type-the-name confirm**: the danger action stays disabled until the user types
the account's own name (its email address). The dialog states **in words** what
deleting will do, and shows the blast radius before the confirm is reachable:

- the account, its **sessions** and its **passkeys** are removed — every device
  signed out, every passkey invalidated;
- the books the user **owns are deleted for everyone** (see below);
- **access to books others own ends** — those memberships are dropped;
- the account's books and the home book are **removed from this device**;
- **this cannot be undone** — said plainly, in words, not colour.

The danger action is labelled with a word — **Delete my account** — never
colour alone. A **Take your data out first** link sits in the dialog, so the
safe step is one tap away from the terminal one.

### The warnings, counted

Before the confirm, the dialog shows two kinds of warning, each a word and a
count, never colour alone:

- **Who loses access.** For each **owned** book shared with others, how many
  people will lose it — *"Banda do Bairro · shared with 12 people — they will
  lose access"* — the count from the book's member list (`listMembers`). A book
  owned by the user that **nobody else shares** carries no such line: it is just
  deleted, and there is no one to lose it.
- **Work only on this device.** For each book, the **unsaved changes** and
  **saves not yet pushed** that live only here — reusing the sign-out survey
  (workflow 13 §Signing out, `SURVEY_SIGN_OUT`): *"My songs · 1 save not yet
  pushed"*, *"Banda do Bairro · unsaved changes in 2 songs"*. These will be lost
  with the device copy, so the **download is offered** right there, before the
  terminal step — the same offer sign-out makes for a device-only book.

## What happens to books others are members of

This is the decision no earlier workflow carries, and it is settled against
workflow 10's ownership model (one owner per book; the owner's only teardown
primitives are *delete the book* and *remove a member*; handing ownership is
deferred, workflow 10 §Later).

- **A book the leaver owns is deleted for everyone.** On each member's shelf it
  becomes *no longer shared with you* (workflow 8 §Losing access): readable as
  it is on their device, **never synced again**. Their **local copy stays and
  cannot be recalled**; **unpushed saves are kept**; and the book offers them a
  **fork** (workflow 11) or the **download** (workflow 7). A fork someone already
  made is **untouched** — it has the whole history up to the last time it
  followed the original, and following simply ends (workflow 11 §When the
  original goes away). This is identical to workflow 10 §Removing someone, now
  triggered by the owner's departure rather than a removal.
- **A book the leaver is only a member of is untouched.** The owner keeps it, the
  other members keep it; only the **leaver's own membership ends** — the registry
  drops one member. Nothing on anyone else's shelf changes.

Why delete rather than hand on: transferring ownership to a successor is
workflow 10's explicitly-deferred *handing ownership*, and choosing a successor
automatically is a product judgment nobody has made; orphaning a book
contradicts *every book has one owner* (DIRECTION §3.3); and blocking the leave
while the user owns shared books would trap them in an account they want to
leave. Deleting for everyone is the policy the ownership model already supports,
loses nothing a member took care to fork or download, and is shown to the owner
as a counted blast radius before they confirm. Handing ownership stays a named
*Later* that would soften it.

## The cascade, and the one endpoint

Deleting the account is a single `DELETE /api/account` call — a **new server
capability** this workflow introduces (DIRECTION §3.6 §The API, beside sign-out
and device/passkey removal). The app and the service share no code; the app
makes the one call across the HTTP contract, and the server runs the cascade:

1. the account's **sessions** and **passkeys** are removed;
2. its **memberships** in books others own are dropped, and any **invitations**
   it made are withdrawn;
3. the books it **owns** are **soft-deleted** and their bare repositories removed
   — reusing `deleteBook`'s mechanism (DIRECTION §3.6 §Books, owner only), so a
   member's next request to such a book is refused and the book turns *no longer
   shared with you* (DIRECTION §3.3 §Git over HTTP refuses a deleted book before
   git starts);
4. the account row itself is removed.

Then, on the device, the **Worker** — which owns git, the working copy and the
index (DIRECTION §3.7) — removes the account's books and the home book, and the
session ends. The deletion waits for the connection; the data-out step did not.
The service logs request metadata only, never song text or book contents
(DIRECTION §3.3).

## Offline

- **Taking your data out works offline.** The downloads read the device's own
  clones; nothing waits on the network (DIRECTION §3.7).
- **Deleting the account needs a connection.** An account, its sessions and its
  passkeys live only on the server; there is no way to destroy them offline, and
  it is a terminal, cross-user action (it cuts off everyone sharing the owned
  books) that should not fire unattended from a device that has since gone away.
  Offline, the data-out step still runs and the **Delete my account** action says
  it **needs a connection** and does nothing until there is one. This is the same
  bounded exception as signing in needing the network — nothing in a *song* waits
  on a connection; an account-lifecycle action reaching the server does.

## Edge cases

- **An owned book nobody else shares.** Deleted with the rest; no *they will lose
  access* line, because there is no one to lose it.
- **A book the leaver only reads.** The membership ends; the owner and the other
  members keep the book unchanged. If the leaver wants to keep its songs, the
  data-out download hands back the clone they hold.
- **Unsaved or unpushed work.** Counted and warned per book (above), with the
  download offered, before the terminal action — never silently discarded.
- **The home book.** Exported with the rest if the user downloads everything
  (it holds the preferences, the shelf list and the starred shapes), and removed
  from the device on deletion like any other book.
- **Offline at the delete step.** Covered above: data-out works, delete waits.
- **The last device.** Nothing special — the cascade is the server's; a signed-in
  session anywhere can run it, and all sessions end when it completes.

## Later

- **Handing ownership instead of deleting.** Letting a departing owner pass a
  shared book — a band book, a class book — to a successor so it outlives them,
  rather than deleting it for everyone. This is workflow 10 §Later's deferred
  *handing ownership*; the chosen delete-for-everyone policy is the first-pass
  answer in its absence, and this would soften it.
- **A single combined archive** instead of per-book zips — one file holding
  every book — as a convenience over the same local downloads, not a new server
  endpoint.
- **Leaving one shared book** without deleting the account — a member dropping a
  single membership. There is no self-remove endpoint today (removing a book from
  the shelf keeps the membership, so *Mine on Estante* re-offers it); giving the
  member a *leave this book* verb is a separate small design decision.
- **A grace period or undo window** before the account is truly gone — a hold
  during which the deletion can be recalled. The chosen flow is immediate and
  terminal, guarded only by the type-the-name confirm.
