# Estante de Cifras

A shelf of songbooks you play from.

Each book is a git repository of songs written in
[cifra.md](https://github.com/ruoso/cifra.md), cloned into the browser and
kept in step with every device and every person it is shared with. Find a
song across all your books, read it on your own instrument, arrange it, save
versions of it, and sync when there is a network — it works without one.

Successor to [Explore Chords](https://github.com/ruoso/explore-chords), whose
music engine it carries over.

## Status

Design. Nothing is built yet. [docs/DIRECTION.md](docs/DIRECTION.md) records
the decisions taken so far and the ones still open, and
[docs/workflows/](docs/workflows/) works through what a user does, one
workflow at a time.

## Plan

The work is broken down in [TaskJuggler](https://taskjuggler.org/) format:
[project.tjp](project.tjp) and one file per work stream in [tasks/](tasks/),
with milestones in [tasks/99-milestones.tji](tasks/99-milestones.tji). It is
not a schedule — one placeholder resource, efforts as rough sizes — but tj3
keeps its structure and dependencies valid.

```sh
scripts/unblocked.py            # per milestone, the tasks that can start now
scripts/unblocked.py m2_local   # just one milestone
mkdir -p report && tj3 project.tjp   # the Gantt report in report/
```

Mark a task done by adding `complete 100` to it.

