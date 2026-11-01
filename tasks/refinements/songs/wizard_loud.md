# songs.wizard_loud — The wizard never fails silently

## TaskJuggler entry

[`tasks/60-songs.tji`](../../60-songs.tji), task `songs.wizard_loud` ("The
wizard never fails silently"), under `task songs`. It `depends !wizard_review`
and sits in `milestones.m5_complete`.

## Source

The human, 2026-11-01: running *Choro, beside a seven-string* on *Apanhei-te
Cavaquinho* in their book showed no chord changed in the plan, and *Write the
plan* saved no voicing. After the latest `main` was deployed and the app
reloaded, it worked. The cause was not found: the same song, uploaded from the
book's zip into a fresh device, plans 21 chords and writes them, on a six- and
a seven-string (both tunings) under every voicing-rules preset; the planner
and the writer handle the song and every variation name. What the report did
show is that the wizard had no way to say anything was wrong.

## Decisions

1. **Plan on this open's text only.** The wizard ignores the `source` entry
   present when it mounts and waits for its own `OPEN_SOURCE` reply, as the
   editor does: the slice can hold a text from an earlier open (the editor's,
   before edits it has since written; or none at all), and a plan on it is a
   plan for a song that is not there — no chords, or the wrong ones, and a
   write that changes nothing. Until the reply lands the policy step says
   *Reading the song…* and *See the plan* waits.
2. **A plan that cannot be made says so.** A throw from the planner (or from
   reading the instrument) shows *The wizard could not make a plan for this
   song, so nothing was changed. What went wrong: {reason}* as an alert, is
   logged with its stack (`console.error('Voicing wizard:', error)`, once per
   failure), and leaves only *Back* — no where-to-put-it, no *Write the plan*.
3. **No chord to plan says so** — *The wizard found no chord in this song to
   choose a shape for, so there is nothing to write.* — with only *Back*.
4. **A shape with no diagram is still the plan's.** When `fingeringFromFrets`
   cannot finger a planned shape under the instrument's rules (E7/D's x20454
   under *beginner*), it is counted with the rest, named in words — *Also in
   the plan, with no diagram to show them: E7/D (x20454).* — and written.
   Before, it was dropped from the preview and the count but written anyway.
5. **A write that fails says so and stays.** When the writer refuses the
   result (a song still holding a conflict marker, cifra.md §8.1), or a new
   variation cannot be made for any reason but a taken name, the action bar
   shows *The plan could not be written into the song, so nothing was
   changed. What went wrong: {reason}*, the error is logged, and the wizard
   stays on the plan.

## Design delta (rides in this task's commit)

- `docs/workflows/05-arrange-for-an-instrument.md` §The wizard — the wizard
  never goes quiet, and what it says in each case.

## Tests

- behavior: `SongWizard.behavior.test.jsx` §never silent — a stale text in the
  slice at mount is not planned on, *Reading the song…* and a held *See the
  plan* until the fresh reply; a planner that throws (a switchable mock of
  `planVoicings`), said with its reason, logged, nothing to write; a song
  with no chords; E7/D after B7/D# under *beginner* counted (*4 of 4*), named
  and written; a conflicted song the writer refuses, said, the wizard staying
  open with no WRITE; axe.
