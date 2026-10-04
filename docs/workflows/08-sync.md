# 8. Sync

Status: decided.

Keeping the shelf in step with Estante: bringing in what others saved,
sending what the user saved. The mechanism is in DIRECTION §3.1 — fetch,
merge, push, retried when a push races another — and the change check in
§3.3. This is what the user sees of it. Conflicts, the case sync cannot settle
alone, are workflow 9.

## When it runs

Sync runs by itself, and is mostly invisible. It runs:

- when the app opens;
- when it comes back to the foreground;
- when the network comes back;
- after every save (workflow 4);
- every five minutes while the app is open.

Each run begins with one request asking the service which books on the shelf
have changed (DIRECTION §3.3), and fetches only those. Nothing runs while the
app is closed: Safari has no background sync, and a songbook does not need
one.

## What the shelf says

Each book has one state, shown only when it is not *in step*:

- *syncing*;
- *2 saves waiting to go up* — offline, or the service unreachable;
- *offline*, with when the book was last in step;
- *needs you* — a conflict (workflow 9);
- *no longer shared with you* (workflow 10).

The header shows one quiet mark when any book is not in step, and nothing
otherwise. *Sync now* is on the book-management screen, and pulling down on
search does the same.

## Merging

When others' saves and the user's touch different things, or merge cleanly by
the cifra-aware rules (DIRECTION §2.2), sync makes the merge commit and pushes
it **without asking**. Nothing new was authored, and asking would make every
sync a chore. History does not list the merge (workflow 6).

What does not merge cleanly is workflow 9.

## A song open while it changes

- **Being read**, it updates in place, keeping the place on the page, with a
  notice — *updated by Ana: see what changed* — that opens its history.
- **Being read full screen**, it waits, and updates when the user leaves it.
  The middle of a performance is the worst moment for a song to move.
- **Being edited**, with unsaved changes, the incoming version is merged under
  them (DIRECTION §3.1); the editor shows the result, and says what came in.

## A push that loses a race

Someone else pushed between this device's fetch and its push. Sync fetches,
merges and pushes again, up to three times, silently. Past that, the book
shows *syncing*, and tries again at the next sync.

## Losing access

A request refused because the user is no longer a member, or the read link
was reset, turns the book into *no longer shared with you*: readable as it
is, never synced again. Saves not yet pushed are kept, and the book offers a
fork or the download (workflow 10).

## The home book

It syncs the same way, but nobody should ever meet a conflict in their
preferences. Its files are JSON, and they merge key by key; where two devices
changed the same key, the later change wins, by the time each was made. The
home book never reaches workflow 9.

## A phone's data

A first clone over a phone's data gets nothing special. Books are text, and
small; workflow 7 already warns before a large one.
