# 2. Find and play a song

Status: open. The sketch is a starting point; the questions below decide it.

The screen people will use most. First run (workflow 1) is mostly a matter of
how to get someone here, so this one comes first.

## Sketch

The app opens on search. Typing narrows the results as you type; each says
the song's title and artist, which book and folder it is in, and carries
badges. Opening one shows it for reading, on the instrument in use, with a
variation picker where that tuning has more than one. Everything is local,
so none of this changes offline.

## Questions

1. **Where does the chord explorer live?** Explore Chords opened on "type
   `Cmaj7`, see every fingering". Candidate: one box. When the text parses as
   a chord symbol, the first result is *explore Cmaj7 on your instrument*,
   followed by the songs that use it; otherwise only songs. The alternative is
   the explorer as a tab of its own.
2. **What does search show before anything is typed?** Candidate: recently
   opened songs first, then each book as a collapsible section.
3. **Two songs of the same title in different books**, such as a teacher's
   original and a student's fork. Is book and folder enough to tell them
   apart, or do the badges carry it — *voiced for your cavaquinho*, *unsaved
   changes*?
4. **A song with no voicings for the instrument in use.** Explore Chords
   shows the chart with default fingerings it works out itself. Keep that, and
   add a visible *arrange for cavaquinho* that leads into workflow 5?
5. **Search scope.** Every book by default, narrowed by a filter. Candidate:
   the filter resets each session, because a forgotten scope hides results
   without saying so.
