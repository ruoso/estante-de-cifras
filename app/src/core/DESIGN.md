# The music core — design notes carried from Explore Chords

These are the sections of Explore Chords' `docs/DESIGN.md` that explain the
music core and renderer carried into `app/src/core`, `app/src/render`,
`app/src/data/instruments.js` and `app/src/i18n/` (DIRECTION §5, §5.1). They
are reproduced verbatim so the reasoning behind the carried modules travels
with the code; the commit history carried alongside (via `git filter-repo`)
is the other half of that record.

**What each section describes, and what landed with the foundational import:**

- **§4 The music core** (pitch, chord, instrument, notation) — carried now:
  `pitch.js`, `chord.js`, `instrument.js` (over the carried
  `data/instruments.js` catalogue), `notation/`.
- **§5 Fingering search** (generation → required-tone check → finger
  assignment → scoring → truncation) — carried now: `search.js`, `fingers.js`,
  `score.js`, `heuristics.js`, `fretstring.js`.
- **§6 Rendering** (geometry → SVG, accessibility) — carried now:
  `render/` and the `i18n/` labels it builds its `aria-label` from.
- **§2.10 The voicing wizard** — describes the voicing planner
  (`src/core/voicing-plan/`), which is **deferred to the `music` stream**
  (`music.wizard`): it takes a *parsed song* as input, so it comes over with
  cifra.md for JavaScript (the rewritten parser), not with this import.
  One deviation lands with it: the text-level batch writer
  `setVoicingsForOccurrences(text, …) -> text` described under "One shape per
  bar, reconciled afterwards" below does **not** carry over. In the app that
  reconciliation — footnote-slot allocation, the refusal to merge slots another
  tuning or variation depends on, the renumber-and-prune pass — is cifra.md for
  JavaScript's job: §8.5.4 `chooseShapes(doc, plan, tuning, variation)`
  (model→model) followed by `write` (canonical), with §8.5.5 `addVariation`
  creating the new variation. `music.wizard` is the first caller of those
  operations. The planner half (the `Planner`/`PlanRequest`/`PlanResult`
  contract, `planVoicings`, candidates and shape metrics) carries over
  unchanged. See `tasks/refinements/music/wizard.md`.
- **§2.11 Entering a shape by hand** — the shape picker and the saved-shape
  round-trip. The parser-free pieces it relies on (the search, the renderer,
  `defaultVoicing`) are carried now; the document-adapters that write a saved
  shape back into song text (`applySavedVoicings`, `resolveSongVoicings` in
  `voicings.js`) are **deferred to the `music` stream** (`music.wizard`,
  `music.fallback`) with the parser they need.

The deferred modules and their Explore Chords tests carry over, rewired to
the new parser, in those `music`-stream tasks (DIRECTION §5).

---

### 2.10 The voicing wizard

Picking a shape one chord at a time is the right way to make a decision and the
wrong way to make thirty of them. What a player wants across a whole song is not
thirty decisions but a *policy*: keep it near the nut, keep the hand still, or
play the part a particular idiom asks for.

So a button above the chart — above, because it decides the song rather than any
one chord in it — opens a wizard. It is two steps. Choose a policy, see the
shapes it would choose, then accept them. A wizard that rewrote thirty shapes on
one click would be something you undo rather than something you use, and the
preview shows the same diagram and the same "voiced as" label (§6.2) the song
will carry, so it is the thing itself rather than a description of it.

`appliesTo` keeps a planner off an instrument it makes no sense on, rather than
letting it return nothing and look broken.

#### A planner decides the song, not each chord

A planner is one function. It is handed the whole song and gives back a shape
per chord *occurrence*; it is not handed one chord at a time.

```js
/**
 * @typedef {object} Planner
 * @property {string}   id
 * @property {string[]} sources                      ids into src/data/sources.js
 * @property {(instrument) => boolean} [appliesTo]
 * @property {StyleOption[]} [options]
 * @property {(request: PlanRequest) => PlanResult} plan
 *
 * @typedef {object} PlanRequest
 * @property {ParsedSong} song
 * @property {SongReading} reading
 * @property {object} instrument
 * @property {string} dialect
 * @property {Record<string,string>} choices    answers to `options`, defaults filled
 *
 * @typedef {object} PlanResult
 * @property {Map<number,(number|'x')[]>} shapes    `at` -> frets
 * @property {number[]} missing                     `at` of chords it could not voice
 */
```

This was the second design. The first made a planner two functions — which
shapes it would consider, and what they cost given where the hand already was —
and had a shared greedy walk call them chord by chord. That works for a policy
about hands and fails for any policy about a passage. A cost is a number about
one chord in one place; a rule like "use octaves through this chromatic run
rather than repeat the same third twice" is a decision about a span of bars, and
routing it through a per-chord scalar means the planner must infer the span from
a single remembered fingering. It cannot, and the attempt distorts both halves:
the shared walk grows knowledge of what planners want, and the cost function
grows arguments it needs only sometimes.

**`plan` is the only API, and there is deliberately no second one.** The obvious
convenience — a shared `greedyWalk(request, { candidates, cost })` for the
planners that only want a chord-by-chord loop — is the two-function design
wearing a different hat: same two functions, same per-chord evaluation, moved to
a call site inside the planner instead of above it. Keeping it would leave the
shape we know to be wrong sitting there as the easy road, and it shows: written
that way, the choro planner has to smuggle its whole-song decision in as a
candidate pre-filter, so the real choice happens outside the walk while the walk
takes the credit.

So what is shared is *utilities*, never a second contract. Each planner writes
its own loop. That costs the two simple ones about fifteen lines each of
ordinary bookkeeping, which is the right price for having one way to write a
planner rather than two.

```js
// candidates.js
searched(chord, instrument, config?)             -> Fingering[]
centroCandidates(chord, instrument, { bassPc })  -> { fingering, interval }[]
//   interval: 'third' | 'sixth' | 'octave' | 'thirdBelow'   — tagged, not cascaded

// shape.js
position(frets)   movement(candidate, previous)   doubling(f)
stringChange(a, b)   highestString(f)   sounding(f)
best(candidates, (candidate) => number)          -> Candidate
```

The whole of "keep the hand still", written against that:

```js
plan({ reading, instrument }) {
  const shapes = new Map();
  const missing = [];
  const already = new Map();               // key -> frets, so a chord stays itself
  let previous = null;

  for (const entry of reading.line) {
    if (!entry.chord) continue;
    if (already.has(entry.ref.key)) {
      shapes.set(entry.at, already.get(entry.ref.key));
      continue;
    }
    const options = searched(entry.chord, instrument);
    if (options.length === 0) {
      missing.push(entry.at);
      continue;
    }
    const pick = best(options, (c) => c.score.total * 0.5 + movement(c, previous) * 1.2);
    previous = pick;
    already.set(entry.ref.key, pick.frets);
    shapes.set(entry.at, pick.frets);
  }
  return { shapes, missing };
}
```

And a planner that needs to see a passage decides what it needs to decide before
it starts choosing shapes, in its own code, where you can read it:

```js
plan({ reading, instrument, choices }) {
  // Which interval families each bar may use — read off the spans, once, for
  // the whole song, before any shape is chosen.
  const allowed = intervalPlan(reading, choices.whenNoThirdAbove);
  // … the same loop, picking from
  //   centroCandidates(entry.chord, instrument, { bassPc: entry.bassPc })
  //     .filter((c) => allowed.get(entry.at).includes(c.interval))
}
```

`planVoicings` stays the single entry point and becomes thin: analyse, dispatch,
and diff the result against what the song already had. That last part is
bookkeeping rather than policy, so it stays outside the planner.

Two things that used to be the framework's are now visibly each planner's, which
is the point. **Tie-breaking**: the shared walk picked with `reduce` and a strict
`<`, so two candidates of equal cost were settled by their position in a list —
which is how `F#°` once came out as a grip with no tritone in it, tying exactly
with the complete chord and winning by enumeration order. A planner now breaks
its own ties and says in "How it works" how it breaks them. And **stability**:
deciding per occurrence lets two bars of the same chord diverge merely because
the shape before them differed, and every divergence becomes a footnote marker
in the chart. The `already` map above is three lines and it is the planner's own
— so a chord staying itself, and a chord deliberately split in two, are both
decisions somebody wrote down rather than a flag's default.

#### `at`, and why not `index`

A chord's `at` is its position in `song.occurrences`: the Nth chord token in the
chart, in reading order, one per token written. Two bars of `F` are two
occurrences. It is not a bar number — a bar may hold several chords, and `%`
writes none — and it is deliberately not called an index, because `ChordRef`
already has an `index` and it means the footnote slot (`F[2]` is index 2, a bare
`F` is index 1). Two numbers on the same object, one meaning "which chord in the
song" and the other "which shape of that chord", must not share a name.

`at` is the planner's only numbering: the reading is ordered by it, spans are
ranges of it, and the shapes handed back are keyed by it. Source offsets stay
where they already live, in the editing layer (§2.6).

#### Reading the song before choosing

`core/song-analysis.js` turns a parsed song into a `SongReading`, once per run,
before any planner sees it.

```js
/**
 * @typedef {object} ReadingEntry
 * @property {number} at                  position in song.occurrences
 * @property {ChordRef} ref               symbol, key, start, valid
 * @property {Chord|null} chord
 * @property {number|null} bassPc         the chart's bass: slash note, else root
 *
 * @typedef {object} Span
 * @property {'walking'} kind
 * @property {number} from                inclusive `at`
 * @property {number} to                  inclusive `at`
 * @property {{direction:'up'|'down', chromatic:boolean}} detail
 *
 * @typedef {object} SongReading
 * @property {ReadingEntry[]} line
 * @property {Span[]} spans
 * @property {(at:number, kind?:string) => Span[]} spansAt
 */
```

`line` is the bass line the other instrument is playing, which is what the choro
rules are stated against. `spans` are findings over it.

It is a separate module from `song.js` because `song.js` is about the *text* —
parsing, editing, round-tripping — while this is about the music in it. They
have different reasons to change. Keeping it out of `voicing-plan.js` too means
the claim "these three bars are a walking bass" is testable with no instrument
and no planner anywhere near it, which is the only way an analysis earns being
trusted by three planners at once.

##### What is analysis, and what is not

**Anything one array index away is not analysis.** A planner holds `line`
entire, so "what does this chord resolve to" is `line[at + 1]` and needs no
machinery. Analysis earns its place only for what takes a scan — where a run
begins and ends — or for a derivation every planner would otherwise repeat.

By that test the choro planner needs exactly two things, `bassPc` and one span
kind, and everything else it wants belongs to it: which notes lie a third, a
sixth, an octave or a third below the other guitar's bass; whether the third
would repeat the note the last bar took; whether this chord is a dominant with
its seventh in the bass. Those are the centro idiom's own arithmetic, and a
planner for some other music would want none of them.

##### `walking`, not `chromatic`

The span we need is not a chromatic run. The sources do not describe one: they
describe a *"baixo cromático-diatônico"*, a line that avoids leaps — "um caminho
grave que evita grandes saltos, que procura o menor caminho e 'oferece' uma
melodia" (Campos Ramos, p.121) — and the line he analyses in *Vibrações* is
ré-mi-fá-fá#-sol-lá-sib, whole tones and semitones mixed. It is that shape, not
chromaticism as such, that the octave rule below answers to.

So a `walking` span is a maximal run whose bass moves by one or two semitones in
a consistent direction, and `detail.chromatic` says whether every step in it was
a semitone, for a planner that wants the narrower case. Naming the kind
`chromatic` would have had us implement the wrong figure and miss the one the
sources are actually about.

One kind is where the vocabulary starts. Cycles of fourths, pedals and passing
diminished chords are all real and all documented, and each should arrive with
the planner that needs it — an unused `kind` is a guess about music we have not
sourced. An earlier draft of this section also proposed a `repeatedBass` kind,
on the assumption that the choro planner would ask whether the bass had just
repeated. It does not: what it needs to know is whether the *third* repeats,
which is `bassPc` plus the idiom's own arithmetic and never leaves the planner.
A repeated bass in the chart is a pedal, which is a different thing with no rule
attached to it yet.

#### Stylistic choices the wizard asks about

Some questions have no right answer, only a preference. When the third above the
other guitar's bass repeats the note the six-string just played, a chorão might
repeat it, octave the bass line instead, or drop to a third below. All three are
documented. Which one *you* want is not something the software knows.

So a planner may declare its options:

```js
/**
 * @typedef {object} StyleOption
 * @property {string}   id           'whenNoThirdAbove'
 * @property {string[]} values       ['repeat','thirdBelow'] — the order shown
 * @property {string}   default      one of `values`
 * @property {string[]} [sources]
 */
```

and `plan` receives the answers in `choices`, defaults filled in. The dialog
renders a radio group per declared option and knows nothing about what any of
them mean — which is what stops the wizard UI growing a branch per planner.
Labels and the one-line justification for each value live in `src/i18n` beside
the planner's `name`, `text` and `how`, and each option carries its own
`sources` for the same reason a planner does: "a third below, landing on the
fifth" is somebody's documented practice, not our invention.

**The controls go on the preview step, not on a step of their own.** You choose
a policy, see thirty shapes, then turn the knob and watch them change. An option
explained by what it does to the chart in front of you needs much less prose
than one explained before you have seen anything, and re-running a plan is
instant. "How it works" then has to take its affected rule from the chosen
value, or the list will claim "a third above" while the control says otherwise.

Choices are not remembered between songs. "Octave rather than repeat" is a
decision about the arrangement in front of you, not a fact about you, and a
preference that silently followed you into the next song would be a surprise the
first time it mattered. If they should persist at all they belong keyed per
sheet, the way a chosen variation already is (§2.13) — not in global prefs.

#### One shape per bar, reconciled afterwards

A planner returns a shape per occurrence, and keys are none of its business. It
thinks about bars, which is what the reading is indexed by.

Turning that into text is a separate step, and it is mostly machinery the
one-chord picker already has. `setVoicing` (§2.6) takes one occurrence's shape
and does the whole dance: reuse a slot of that symbol which already holds this
exact shape rather than minting a duplicate footnote, mint the next free index
when the occurrence needs a shape its slot cannot carry, refuse to collapse two
slots that another tuning or variation tells apart, then garbage-collect what
nothing uses and renumber chart and blocks together so a chord back to one
voicing loses its marker.

What the wizard needs is that in batch:

```js
setVoicingsForOccurrences(text, shapes, { tuning, dialect, variation }) -> text
```

and it must not be a fold of the single-occurrence version. Two reasons. An edit
that widens a token — `F` becoming `F[2]` — shifts every later offset in the
text, so a loop over offsets collected up front goes wrong the moment the first
marker is minted. And the garbage-collect-and-renumber pass runs after every
edit, so intermediate states renumber slots that later edits were aiming at; the
end result may well be right, but nobody can reason about it.

Given every occurrence's shape at once, the allocation is also simpler than the
incremental case. The picker's careful dance exists because it changes one bar
and must disturb nothing else. A wizard assigning the whole song can group each
symbol's occurrences by shape and let the distinct shapes become slots in
first-appearance order, the first taking the bare form. The one rule that
survives untouched is the refusal to merge slots another instrument's block
depends on: collapsing those would silently destroy that arrangement.

> **In the app, this writer is cifra.md's, not reimplemented** (`music.wizard`).
> The reasoning above is why the batch exists; it does *not* come over as
> `setVoicingsForOccurrences`. cifra.md for JavaScript's §8.5.4
> `chooseShapes(doc, plan, tuning, variation)` is the one-pass reconciler
> (model→model: slot allocation, the cross-tuning/variation merge refusal, the
> renumber-and-prune that falls out of `write`), §8.5.5 `addVariation` creates
> the new variation, and the planner's `shapes` Map is mapped onto a §8.5.4
> `plan` by `voicing-plan/apply.js`. The format side is corpus-tested in
> `cifra_js.editing`; the app agrees with it by the corpus, never by shared code.

**A planner that gives one chord several shapes is doing its job.** Deciding per
occurrence means a policy can legitimately want a different grip for the `F`
inside a chromatic run than for the `F` in the last bar, and the chart will come
back carrying `F` and `F[2]`. The reconciler does not second-guess that —
collapsing near-duplicates would be policy, and policy belongs to the planner.
What it owes you is visibility: the preview shows the *reconciled* result, one
entry per resulting key with the bars it covers, so a chord split three ways is
something you see before you accept it rather than after.

#### Each planner cites its own sources

Two of the three are engineering heuristics about hands. The third claims to
reproduce a documented practice, and a claim like that has to be able to say
whose. So "How it works" is shown in the context of one planner and lists that
planner's rules and that planner's references — what backs the choro texture
says nothing about keeping a hand near the nut, and a planner with no source
says so rather than borrowing someone else's authority.

References live in `src/data/sources.js`, language-independent on purpose: an
author, a title and a year are the same in every language, and translating a
citation only invites four ways to get it wrong. Only works whose full reference
is known are listed, because a half-remembered one is worse than none.

#### The choro centro planner

The six-string's part in a choro *regional*: it plays the *centro* while a
seven-string carries the bass line. The rules, and where each comes from:

- **Enumerated, not searched.** The ordinary search discards a muted shape when
  a fuller one is no harder (§5.2). Right for a solo player, wrong here, where
  the low strings are quiet because another instrument has them.
- **Four sounding strings, or five — or three, in the other texture.** A bass
  note under the thumb and the rest under three fingers. Four is called the
  predominant pattern of the style and five the occasional departure. The third
  case is the thumb up on the fourth string with the low string dropped, which
  Campos gives for dominants: what is lost is a root or a fifth, and it costs
  nothing because the tritone still sounds. So it is offered only for a chord
  with a seventh to make that tritone with — and offered rather than preferred,
  for reasons below.
- **Contiguous strings**, thumb on the lowest, the second-lowest or the fourth,
  and the grip reaching at least the second string from the top. Contiguity is
  our rule rather than the idiom's — the transcriptions do show gapped grips,
  and Becker's Época de Ouro A minor is one, A2 under A3-C4-E4 with the D string
  silent — on the reasoning that a hole is a decision the player can still make,
  while a shape that needs one cannot be undone.
- **The grip's own bass between the low E and the D above it.** Becker's
  transcriptions were measured across forty-odd pages: nothing below E2 anywhere,
  and the weight of the line between G2 and D3. Without this the fourth-string
  grips below would let the whole texture climb out of its register.
- **Nothing above the seventh fret, open strings welcome.** The sources put this
  work in the first quarter of the neck. This is the rule that most contradicted
  our first attempt, which had been mid-neck with no open strings.
- **The lowest note a third above whatever the other instrument is playing** —
  the slash note where the chart writes one, the root otherwise, in whichever
  octave that instrument is in. This is the substance: the two guitars take
  different inversions so they do not double each other. It is a simple third
  between two bass lines in the same register, not a tenth.
- **A sixth, then an octave, then a third *below*, where a third above is not a
  chord tone.** A third above the seventh of a dominant resolving to a major
  chord lands on a note the style does not use. The literature names that case
  and gives all three remedies, in that order, so this is a documented
  exception rather than a gap.
- **Every tone kept but the fifth**, which is the note this idiom drops — not
  the root. "Rootless" in the jazz sense is the wrong frame: the six-string
  displaces its bass rather than surrendering it. Only a *perfect* fifth,
  though: the ♭5 of a diminished chord or the ♯5 of an augmented one is what
  makes the chord that chord, and the ordinary search already refuses to drop
  it (§5.2). Dropping it here gave `F#°` a grip with no tritone in it and a
  string spent doubling the third.
- **Prefer keeping the same strings sounding.** The picking hand has a pattern,
  and a chord that moves the strings under it interrupts that pattern as surely
  as a jump interrupts the fretting hand. It is also what turns a run like
  Gm–Gm6–Gm7 into one grip with one finger moving.
- **No note sounded more than twice.** Doubling once is ordinary on a guitar;
  twice over is a four-voice grip giving the chord two notes.

##### A repeated third is not a mistake

Harmonising a moving bass line in thirds makes the upper line repeat wherever a
major third narrows to a minor one. Under `F | F#°` the other guitar walks F to
F♯ and the centro sits on A both times, because A is the only chord tone a third
above either. Campos Ramos raises exactly this and defends it (p.125, on
*Vibrações*, where the seven-string walks ré-mi-fá-fá#-sol-lá-sib): the V6 plays
Dm/A then D7/A, "o que não diminui a consistência do contraponto, uma vez que o
V7 irá gerar movimento ascendente no mesmo trecho – Dm/F D7/F#". The motion is
the other instrument's to supply; inside the grip it shows up as an inner voice
walking F to F♯ under a held A.

So the default stays the third, and what follows are preferences, not
corrections.

##### The octave is a peer of the third, not a fallback

The rule above tries third, then sixth, then octave, and stops at the first that
yields anything. That ordering overstates the case. Campos Ramos names the
octave and the third together as "os frequentes intervalos de oitava e de terça"
(p.127), and over precisely this kind of walking bass says "frequentemente, o V6
realiza este tipo de situação com os baixos oitavados […] a execução em oitavas
reforça a melodia do baixo e 'timbra' melhor o V7" (p.124). Fourths, sixths and
seconds occur too, more rarely.

A third option appears where the exact third fails: the V6 may drop a third
*below* the other guitar, landing on the fifth of the chord — "em perfeita
consonância com o estilo", observed in Época de Ouro's recording of *Sofres
porque queres* (p.161). Our enumeration only ever looked upward.

All three are remedies for one situation, and the literature ranks them only by
the order it happens to list them in. That is what makes the choice between them
a preference rather than a fact, and it is what `whenNoThirdAbove` offers: a
sixth then an octave, or the third below. Taking either meant the interval
cascade had to become a set of tagged candidates rather than an early return —
relations the planner never sees cannot be preferences.

**An earlier version of this option asked a different question**, and it is worth
recording why it went. It offered the third below wherever the third *repeated*
the note the six-string had just played — which is not a case any source
discusses. Campos gives the third below for a third that does not work at all,
and Becker, who is the dedicated study of this six-string part, has nothing on
repeated notes and nothing on the six-string going below the seven-string at
all. His one voice-leading principle points the other way ("procurando não
cruzar as vozes", p.91), and where he does describe two guitars harmonising a
bass, the second is explicitly above (p.123). A planner that claims documented
practice should not ship a question the documents never ask.

##### What `C7/Bb` resolves to, and how long it took to find out

Worth recording, because the answer was nearly guessed at. The other guitar
rests on the seventh of C7 and the chord heads for F. The third above B♭2 is D♭
or D, neither in C7. The sixth is G3 and the octave B♭3, and both want the
thumb on the fourth string, which the contiguous-string rule does not allow —
so for a while this chord simply came back in `missing` with nothing voiced.
(`F7/Eb` in our tests passes only because E♭2 sits low enough for its sixth to
reach C3, which the fifth string can still play.)

The temptation was to reason it out. What settled it instead was Campos Ramos,
who poses the problem in §5.3.3 (p.131–133) and answers it twenty-eight pages
later in §5.4.3, p.161:

> "o V6 pode ainda optar em fazer a baixaria **uma terça ABAIXO** do V7,
> repousando, assim, na quinta do acorde (segunda inversão), em perfeita
> consonância com o estilo."

and names the instance, p.162, from Época de Ouro's *Sofres porque queres*:

> "o V7 repousa com o baixo na sétima (C/Bb – terceira inversão) e o V6, uma
> terça abaixo, repousa como baixo na quinta (C7/G – segunda inversão)."

So `C7/Bb` is voiced with G *below* the other guitar's B♭ — not the G a sixth
above it, which is the same pitch class and the wrong register. The wizard gives
`31201x`, G2 under a B♭2.

Three caveats belong with it. The author flags his own uncertainty about which
guitar is which on that recording. His reason for the move is about where the
whole phrase lands — "para evitar ter de terminar com o baixo uma terça acima da
m7" — while we encode only the chord it rests on. And "oitavas ou sextas" is
named in the same breath without a direction, which for a while left our reading
of the sixth as *above* an interpretation rather than a citation. Becker settles
it (p.94), describing the full three-guitar texture:

> "o 1º violão de seis faz a voz principal da baixaria, o 2º faz terça acima e
> o de sete faz **sexta abaixo** da melodia principal, ou seja oitava abaixo da
> voz do 2º violão."

The seven-string is a sixth *below*, so the six-string is a sixth above it — and
the sentence checks itself, since a sixth below the first six-string's voice is
the same note as an octave below the second's.

##### The second texture: three notes, thumb on the fourth string

Campos carries no tablature at all — he says so (p.63): he notates the bass
alone, because full fingerings "geraria uma quantidade de informações que
acabaria por dificultar a visualização". So almost nothing about grips is
directly documented there. One thing is, and for a while we had it wrong. For
the second chromatic path through a cycle of dominants — A/G, D7/F♯, G/F, C7/E —
the centro's bass is on the *fourth* string and the low string is dropped
(p.128–129):

> "Neste segundo caso, com o baixo na **quarta corda**, é comum que os chorões
> suprimam a nota do acorde gerada na corda mi, formando acordes dominantes com
> apenas **3 notas** […] pois se tratam de tônicas ou quintas do acordes (as
> notas do trítono - terça e sétima - são realizadas nesta digitação)."

Two of our rules were wrong at once: the thumb may sit on the fourth string, and
a grip may sound three notes rather than four or five. Both are now allowed, for
a chord with a seventh only — the justification the sources give is the tritone,
and a triad has none to keep, so thinning one would be our idea rather than
theirs.

This is not a correction to the ordinary texture but a second one beside it. The
four-and-five-voice grips still cover the ordinary case; the three-voice family
is reached where the centro's bass has to sit high, and it does two useful things
there. It is what the octave relation needs — an octave above the other guitar's
F2 is F3, which inside the first seven frets lives nowhere but the fourth
string. And it fills a hole we had not noticed: `Cm7` had no third at all
before, because a third above C2 is E♭2, below the guitar, and the E♭3 an octave
up is only on the fourth string. It now voices as `xx131x`.

**Becker does not corroborate it, which is why it is offered and not preferred.**
He never mentions dropping a string; his account of the right hand is the thumb
on the bass and "os dedos i, m, a realizando o restante do acorde" (pp.106–107),
and a sweep of his forty-eight transcription pages finds bass-plus-three-voices
as the constant — including with the bass on the fourth string, where he has
*Ingênuo* as F3 under A3-C4-F4. The one departure he does record goes the other
way: the thumb sounding two or three notes at once (p.109). So Campos's
three-note grip stands on Campos alone. Two sources, one of them silent, is
enough to make a shape available and not enough to make it the usual answer.

That same sweep is why the four-voice grip can now sit on the top four strings.
Campos puts the fingers on the second, third and fourth; Becker's Época de Ouro
six-string uses the top string constantly — a D minor as D3 under A3-D4-F4,
straight across. Where two sources differ and one of them is measuring
performances, the measurement wins.

One thing our model still cannot say. In Campos, that chromatic path is the
*centro's own* line — the six-string walking G, F♯, F, E while the other guitar
is elsewhere. We always place the centro relative to the chart's bass, which we
read as the seven-string's, so a passage where the six-string leads is outside
what a planner here can express. Becker puts the same limit differently and more
bluntly: he transcribes only one guitar, and of the two instruments says "vemos
a utilização de uma mesma linguagem, um mesmo estilo" (p.133), the difference
being freedom rather than register. Recorded rather than solved.

One more rule of the idiom we do not yet implement, recorded so it is not
rediscovered: the triad outranks the exact third. Where the interval would land
on a note the chord does not contain, the V6 takes the nearest one that it does
— "o V6 não responde com a terça exata (fá#) e sim com uma quarta (sol),
respeitando a questão das tríades" (p.160).

##### Diminished chords

The sources approach these from the opposite side. A diminished chord is
typically what the V6 *arrives at* when the seven-string rests on a dominant's
seventh: against D/C it plays E♭dim, "como se fosse a 'quarta' inversão de D7
(D7/Eb), funcionando como uma terça exata de D/C" (p.133). That is the same
third rule seen from the other end, and it is why a diminished written into a
chart needs no special case here.

It is also where the exception for a dominant preparing a *major* chord comes
from: "não existe um correspondente do acorde diminuto capaz de realizar as
terças exatas" there, since the exact third of C/Bb would give C/D, heard as
D9sus4 and foreign to the style (p.133). The remedy the sources give is the
octave or the sixth (p.161) — the fallback we already had, arriving now with a
page number.

The *minor*-preparation case is one we cannot currently play at all. There the
exact third does work, and what it produces is the ♭9: against C/Bb heading to
Fm the V6 takes D♭, "uma espécie de C7/Db" (p.132), which is why a diminished
chord turns up where the chart wrote a dominant. Knowing that Fm is next is
free — it is `line[at + 1]` — but D♭ is not a tone of C7, and `centroCandidates`
considers only `chordTones(chord)`, so no enumeration of ours can reach it. The
planner would have to be able to hand the candidate generator an added tone.
Recorded rather than fixed, because it wants the same decision as `C7/Bb` above.

And the ♭5 rule above has independent backing: what may safely be suppressed
from a dominant tetrad is a root or a fifth, explicitly because "as notas do
trítono — terça e sétima — são realizadas nesta digitação" (p.129). The tritone
is the part that has to sound.

#### What this replaced

An earlier attempt gave the six-string top-four-string voicings with the two
lowest strings muted, on the reasoning that the seven-string owns the bass. No
source in any language recommends muting those strings, and the one Brazilian
source that does prescribe that profile — top four strings, high register,
deferring to the instruments below — is writing about an electric guitar in MPB,
and says itself that it sounds like a cavaquinho. The six-string's slot is
*médio-grave*, with a bass note of its own.

---

### 2.11 Entering a shape by hand

The picker (§2.6) offers the shapes the search found. That is the right answer
almost always, and no answer at all when you already know what you want to play
and it is not on the list — a voicing off a chart, something a teacher showed
you, a shape the rules were never going to allow. So both ways into the picker,
the one for a single bar and the one that re-voices a chord across the song,
also offer a shape you enter yourself: click a fret to put a finger on it, and
again to take it off.

It opens either on nothing or on the shape in effect, because a shape that is
nearly right is quicker to correct than to build.

**The way in sits above the list, not under it.** A chord has as many shapes as
it has — forty-three for a C on a guitar — so buttons after that list are on
screen and unfindable, which is where these started. At the top of the dialog
they read as the alternatives on offer rather than as the footer of a form,
which is also why they range left there.

**The click targets come from the renderer**, emitted by the same code that
draws the grid (`render/chord-box.js`, the `hits` option). A separate set of
coordinates would drift from the lines on screen the moment either moved. They
carry the *logical* string, mirroring already undone, so the caller never has to
think about left-handedness.

**The window onto the neck is the caller's**, which is what the `startFret` and
`fretsShown` overrides on `diagramModel` are for. Elsewhere the window follows
the shape; here it must not, or it would slide out from under you as you enter
notes. It shows six frets — two more than any hand spans — and moves on request.
That is also how a shape at the twentieth fret is reachable at all.

**Nothing is validated away while you work.** A shape being entered is drawn
from its frets rather than from a fingering, because the search refuses to
describe a stretch no hand can hold and refusing to *draw* it would leave you
unable to see what you had just clicked. The dialog says "no hand for this" and
still lets you save it: a shape can be right and awkward, and the way to a shape
usually runs through several that are not one yet.

**It says what is wrong rather than whether something is.** Under the diagram
are the notes it holds down, string by string, with any note from outside the
chord marked — in a word and a glyph, not only a colour (§6.1).

---


## 4. The music core

### 4.1 Pitch representation

A pitch is an integer `pitchClass + 12 * octave`, matching the reference's
`pitchToValue`. Note *names* are kept separate from pitch classes so enharmonic
spelling is correct — a `Db` chord displays `Db F Ab`, not `C# F G#`. This is a
real improvement over the reference, which normalized everything to sharps.

- `PitchClass`: 0–11
- `SpelledNote`: `{ letter: 'A'..'G', accidental: -2..+2 }`
- Spelling derives from the chord root and interval structure, so `#11` on C
  spells `F#` and `b5` on C spells `Gb`.

### 4.2 Chord model

```js
Chord = {
  root:        SpelledNote,
  quality:     'major' | 'minor' | 'dim' | 'aug' | 'sus2' | 'sus4' | ...,
  extensions:  [ { degree: 7, alter: 0 }, { degree: 11, alter: +1 }, ... ],
  bass:        SpelledNote | null,   // slash chords
}
```

This is the **canonical form**: notation-dialect-free. Dialect is purely a
display and input concern (§4.4), so a shared link carries the canonical chord
and a Brazilian user's `C7M` renders automatically as `Cmaj7` for a recipient
set to American notation.

Resolved to `ChordTones`: an ordered list of
`{ pitchClass, spelled, degree, role }` where `role ∈ {root, third, fifth,
seventh, extension}`. `role` is what the omission heuristics operate on —
"the 5th may be omitted" is a statement about role, not a semitone count.

`data/chords.json` holds base formulas (major `[0,4,7]`, minor `[0,3,7]`, …) and
extension intervals, seeded from the reference's `extensionNames` table.

### 4.3 Instrument model

The catalog is a set of templates; what the user holds is **instances**.

```js
// data/instruments.json — catalog
CatalogEntry = {
  id: '6guitar',
  name: 'Guitar (6-string)',
  fretted: true,
  fretCount: 22,
  tunings: [ { name: 'Standard', strings: ['E2','A2','D3','G3','B3','E4'] }, ... ],
}

// user's own, persisted
InstrumentInstance = {
  id:         'inst_3',
  catalogId:  '6guitar',
  label:      'Guitar · Drop D',       // user-renameable
  strings:    ['D2','A2','D3','G3','B3','E4'],
  fretCount:  22,
  heuristics: HeuristicConfig,          // §2.4 — per instrument
}
```

Any comma-separated pitch list defines a valid instance, so arbitrary tunings
are first-class rather than an escape hatch.

There is deliberately **no `capo` field** (§1, §11). A capo raises every open
string by the same amount, which an arbitrary tuning already expresses exactly:
"Guitar · Capo 2" is the instance `F#2, B2, E3, A3, C#4, F#4`. Because fret 0 of
that instance *is* the capo, the fret numbers in every diagram come out
capo-relative automatically, which is the convention capo users want. A field
that nothing reads would be worse than its absence — it invites a
half-implementation.

**Re-entrant tunings matter.** The reference rejects any candidate whose
sounding pitches are not strictly ascending (`fingering.js:filterCandidate`) —
correct for guitar, but that rule makes standard ukulele (`G4 C4 E4 A4`) produce
almost nothing. This app drops the ordering rule entirely rather than
generalising it (§5.2), and derives the *bass* rule from whether the instrument
has a bass register at all.

### 4.4 Chord notation: one parser, many dialects

There are several living systems for writing chord symbols, and this project's
own reference data uses the Brazilian one (`gen-scale.js:44` emits `°` and `+`;
the extension table is `7M`, `7m`, `9M`, `4+`, `5°`, `°7`). So the app must at
minimum read and write Brazilian *cifra* and American jazz notation.

**The design is one permissive parser, not one parser per dialect.** Most
dialect differences are non-conflicting aliases: `Cmaj7`, `C∆7`, `CM7` and
`C7M` can all be accepted at once with no ambiguity whatsoever. Writing four
parsers would multiply the test surface to solve a problem that does not exist,
and players genuinely mix dialects — a Brazilian chart has `C7M` and `Cm7` side
by side.

#### The two axes

Note-name system and quality vocabulary are **independent**. Brazilian players
use ordinary letter names with `7M` qualities, so "Brazilian" is not one bundle.
v1 ships letters-only on the note axis and three vocabularies on the quality
axis:

| Dialect | Major 7 | Minor 7 | Half-dim | Dim 7 | Dim triad | Aug | sus4 |
|---|---|---|---|---|---|---|---|
| Brazilian (cifra) | `C7M` | `Cm7` | `Cm7(5-)` | `C°` | `Cdim` | `C+` | `C4` |
| American / jazz | `Cmaj7` | `Cm7` | `Cm7b5` | `Cdim7` | `Cdim` | `C+` / `Caug` | `Csus4` |
| Real Book | `C∆7` | `C−7` | `Cø7` | `C°` | `Cdim` | `C+` | `Csus4` |

#### Genuine ambiguities

Three inputs cannot be resolved by tokens alone. These consult the dialect
setting, and each is reported so the UI can offer the other reading:

| Input | Default reading | The other reading |
|---|---|---|
| `C7+` | Brazilian: **Cmaj7** — `7+` is the major 7th in the reference's own table. American: **C7♯5** | whichever the dialect did not pick |
| `C9` | Brazilian: C add9, no ♭7. American: dominant 9, includes ♭7 | likewise |
| `B°` | **B°7**, in every dialect | the bare triad, B D F |

`C7+` is the dangerous one: three identical characters, two chords differing by
a semitone in two places.

`B°` is the deceptive one. Read strictly it is a diminished *triad*, and the
reference treated it that way (`°` for the triad, `°7` for the seventh). But in
practice the symbol nearly always means the diminished seventh: nobody writes a
bare diminished triad, and the shape every guitarist knows for "B°" — `x2313x` —
has the A♭ in it. A strict reading hides the one voicing people are looking for.
So a bare `°` reads as the seventh everywhere, the word `dim` written out is the
triad, and `°7`/`dim7` are unambiguous.

Everything else — `°`, `dim`, `o`, `∆`, `maj`, `M`, `−`, `m`, `min`, `ø`,
`b5`/`5-`/`♭5` — is accepted unconditionally in every dialect.

Two further parsing rules that are not dialect-dependent but are easy to get
wrong:

- **Case is significant and must never be normalized.** `CM7` is major 7,
  `Cm7` is minor 7.
- **`/` is overloaded.** Followed by a note letter it is a slash bass (`C/E`);
  followed by a digit it is part of a compound quality (`C6/9`). Resolved by
  one-token lookahead, not by dialect.

#### Ambiguity is surfaced, not guessed

```js
ParseResult = {
  chord:       Chord | null,
  ambiguities: [ { span: [0,3], text: 'C9',
                   chosen: 'dominant9',
                   alternatives: ['add9'] } ],
  errors:      [ { span, message } ],
}
```

The dialect setting picks a default reading, and the UI shows it as a chip the
user can flip in one tap:

```
C9  →  C E G B♭ D   [dominant 9 ▾]
                     └ add9 (C E G D)
```

This is better than either silent guessing or a hard error: the user sees which
reading was taken and corrects it without retyping.

**Default: Brazilian**, matching the reference data this project grows out of
(`gen-scale.js` emits `°`/`+`, and the tuning presets include a Brazilian
7-string and a cavaquinho). It is one setting in prefs, changed once.

#### Formatting

`formatChord(chord, dialect)` is a separate, fully dialect-specific function —
this is where the per-dialect code genuinely belongs. The property test is a
round trip across the matrix: for every dialect `d` and every chord in the
corpus, `parse(format(c, d), d) ≡ c`, plus cross-dialect
`parse(format(c, d1), d2) ≡ c` for every unambiguous chord.

#### Deferred, but the shape accommodates them

- **Solfège note names** (`Dó7M`) — a note-axis alternative; the axis exists.
- **German `H`/`B`** — the one dialect that conflicts on *note names* rather than
  qualities. Needs the note axis to be dialect-aware, which it is; v1 just ships
  one option.
- **Nashville / Roman numerals** — not a dialect but a different *input mode*,
  since it requires a key context. It is the natural way to make song sheets
  transposable, so it is the most likely v2 addition (§11).

---

### 4.5 Intervals, and keeping transposition cheap for later

Transposition is deferred out of v1 (§1). This section exists so the v1 model
does not foreclose it, and to record why the deferral is a UX decision rather
than a theory one.

**The `Interval` type ships in v1 regardless** — not for transposition, but
because §4.1 commits to correct enharmonic spelling. `#11` on C must spell
`F#`, not `Gb`, and that computation is: 11th degree → 3 letter steps →
`C`→`F`; 18 semitones mod 12 = 6; `F` natural is 5 semitones above `C`, so
raise it once → `F#`. That is an interval expressed as
`{ letterSteps, semitones }` rather than as a semitone count.

```js
Interval = { letterSteps: 0..6, semitones: int }
```

It should not be "simplified" to a semitone count during v1 work. Everything
below stays cheap only because this type exists.

**What transposition would then cost.** Chord transposition touches only `root`
and `bass` — extensions are already stored as intervals from the root and
`quality` is symbolic, so both carry over untouched. Spelling the destination
needs one small addition, `Key = { tonic, mode }`, used purely to bias
accidentals toward the target key signature. Neither is a scale model.

Numeral-based entry is the only related feature that reaches for scale data,
and the two systems differ:

| System | Example | Needs |
|---|---|---|
| Nashville | `1`, `2m`, `5 7` | quality written explicitly → a degree→pitch pattern (7 numbers) |
| Roman numeral | `I`, `ii`, `V7`, `vii°` | quality *implied* by diatonic context → also chord quality per degree |

Both are satisfied by copying two arrays out of the reference's
`music-data.json` (`scales.major.chordQualities` and `.romanMapping`, plus the
natural-minor equivalents). That is not the scale *model* — no genre mapping, no
28-scale catalog, no harmonic sequences, and no notion that a scale *generates*
a chord set. Chord-first stays chord-first.

**Why it is deferred anyway.** A song sheet pins one specific fingering per slot
(§2.5). Transposing invalidates all of them simultaneously, and shifting a shape
up the neck may run it off the fretboard or strip its open strings — making it a
different thing to play, not the same thing moved. The options are re-run the
search and re-pin each slot, shift shapes where they still fit, or suggest a
**capo** and keep the shapes byte-identical. The last is what a guitarist
actually does — but capo is itself deferred (§11), it works only on fretted
instruments, and only upward. Choosing between these is a teacher-workflow
question, and it is the whole of the work.

**Forward compatibility, concretely.** Three things keep the door open, and all
three are free in v1:

1. Keep `Interval` as `{ letterSteps, semitones }` (above).
2. Sheet slots store **absolute chords** (`Cmaj7`), not degrees. A sheet-level
   `key` can be added later and degrees derived from it; the reverse would
   require a key to exist from the start. Absolute-only is the choice that
   does not need to be made now.
3. The sheet schema is versioned (§8.3), so adding `key` later is an additive
   migration, not a breaking one.

---

## 5. Fingering search

Three stages: **generate → assign fingers → score**.

### 5.1 Generation

For each fret window `[lo, lo+span]` across the neck (span from the instrument's
heuristics, default 4), depth-first over strings. For each string the options
are: open (if the open pitch class is in the chord), any fret in the window
whose pitch class is in the chord, or muted.

This is the reference's `dfsCandidatesForSpan` with three changes:

1. **Synchronous.** The reference `await`s a data lookup inside the innermost DFS
   loop, which dominates its runtime.
2. **Pruned during descent**, not only at the leaf. Once the remaining strings
   cannot supply a still-missing required tone, the branch is abandoned.
3. **Windows skipped** when they cannot contain the root at all.

### 5.2 Required-tone check

Which tones *must* sound is a function of the instrument's heuristics:

| Rule | Default | Effect |
|---|---|---|
| Root required | on | some string sounds the root pitch class |
| Root in bass | on, **where the instrument has a bass register** | lowest sounding pitch is the root, or the slash bass |
| 3rd required | on | (off for sus/power chords, which have none) |
| 5th omittable | on | perfect 5th may be dropped; altered 5ths never are |
| Rootless allowed | off, on (Jazz) | root may be dropped entirely |
| Extensions required | on | a named extension must sound, else it is not that chord |
| Doubling allowed | on | same pitch class on multiple strings |
| Duplicate pitch allowed | **on** | the exact same pitch twice (reference forbids this) |
| Inner mutes allowed | off (Strumming), on (Fingerstyle, Jazz) | muted string between two sounding ones |
| Thumb-over allowed | *not in v1* | `T` on the lowest string — see §11 |

For a slash chord the bass note is added as a required tone *and* constrained to
be the lowest sounding pitch.

**Two defaults were corrected while building this** (phase 3), both for the same
underlying reason — a rule that is true of a guitar is not true of every fretted
instrument:

- **Duplicate pitches are allowed by default.** The reference forbids them, and
  the draft of this document followed it. But a standard re-entrant ukulele
  cannot play F major (`2010`) without sounding A4 on two strings, so the rule
  rejects the most ordinary chord on the instrument. Sounding one pitch twice is
  an aesthetic preference, not a playability constraint. It remains a toggle.
- **"Root in bass" defaults on only where the instrument has a bass register**,
  defined as a lowest open string below C3. It is a real constraint on a guitar
  or a bass, and meaningless on a ukulele, whose standard F sounds C4 lowest and
  whose re-entrant tuning means the lowest-pitched string is not even the first
  one. This is precisely why heuristics belong to the instrument (§2.4), and
  `configFor(instrument, preset)` reapplies the instrument's defaults on top of
  any preset so that switching to "Jazz" cannot silently re-break a ukulele.

**A muted string has to be forced.** Whether a mute is *allowed* is the toggle
above; whether it is *justified* is a separate rule, and not a toggle. Damping a
string is something a player does because the alternative is a wrong note, never
because it saves effort: played fingerstyle, a string that could ring is a
string that should. So a shape is dropped when the same shape with one of its
muted strings sounding is also on offer and the fingers that fill it go down
easily. `3xx333` goes, because its muted D string plays an open D and gives
`3x0333`. `x3x0x0` goes, because open C is two ordinary fingers away.

**Easily** means the hand does not have to do anything it was not already doing.
Fingers are free — the whole point of the rule is that putting one down beats
damping a string — but a **reach** is not, and neither is a **barre**, because
both change what the hand is doing rather than how much of it. That line is what
keeps the open chords. `xx0232` can be filled, by fretting the A string at the
fifth to give `x50232`, but that shape spans four frets where the open D spans
two. `xx3211`, the F beginners actually play, survives the full barre for the
same reason.

Difficulty deliberately does not enter into it. Whether the fuller shape *scores*
better is a question about weights that are still guesses (§11), and answering it
that way keeps `x3x0x0`: a fragment of open C really is easier than open C. It is
also not worth offering.

The rule also **protects the bass**: a fuller shape that renames the lowest note
voices a different chord, so `x02210` survives `002210`, which is A minor against
its first inversion. Dropping the same bass by an octave renames nothing and is
not protected, which is what removes `xx7555` in favour of `x07555`.

Only shapes the search actually found count as an alternative, so a shape is
only ever dropped for one the user could otherwise have seen. It runs before
ranking and grouping, because the two need not share a position: `3xx333` sits
at the third fret while `3x0333`, having an open string, is an open-position
shape. Nothing filters a shape a user saved or wrote down (§8.2) — those are
rebuilt as written.

There is also **no cross-string pitch ordering rule at all**. The reference
required sounding pitches to ascend strictly, which is roughly right for a
guitar and catastrophic for a re-entrant tuning. Playability is decided by
whether a hand can physically make the shape (§5.3) and by the bass rule, which
are the constraints that are genuinely real.

### 5.3 Finger assignment

New work — the reference only counts fingers roughly. We assign actual ones:

1. Group fretted strings by fret.
2. Treat the lowest fretted fret as a **barre candidate**: if the index finger
   can cover the outermost strings needing it and nothing below is fretted, place
   a barre (partial barres allowed, spanning only the strings that need it).
3. Assign fingers 2,3,4 in ascending fret order, respecting that a
   higher-numbered finger must not sit on a lower fret than a lower-numbered one.
4. **Thumb-over** (`T`) is not implemented in v1 (§11). The `Hand` model has
   room for it, but nothing emits it, so no toggle is offered for it either: a
   control that does nothing is worse than an absent one.
5. Reject if a finger reaching over a string would mute one that must sound.
   (A barre finger covering a string that should ring is fine; a fingertip
   crossing is not.)

```js
Fingering = {
  frets:    ['x','3','2','0','1','0'],
  fingers:  [null, 3, 2, null, 1, null],
  barre:    null | { fret, fromString, toString, finger },
  pitches:  [null, 'C3', 'E3', 'G3', 'C4', 'E4'],
  omitted:  ['fifth'],
  position: 3,          // lowest fretted fret, 0 = open
  score:    { total, parts: {...} },
}
```

### 5.4 Scoring

A weighted sum; every weight is exposed in the expert panel:

| Cost | Default weight | Notes |
|---|---|---|
| fret span | 1.0 × (span − 1) | a 4-fret stretch is much harder than 2 |
| barre | 1.5 | full barre costs more than partial |
| finger count | 0.4 each | |
| inner muted string | 0 | see below |
| each muted string | 0.6 | a thinner chord, a musical cost rather than a difficulty |
| high position | 0.1 × position | above the 12th fret gets awkward |
| omitted 5th | 0.3 | penalizes *musical* completeness, not difficulty |
| rootless | 0.6 | |
| non-root bass (unrequested) | 0.8 | inversions when none was asked for |
| open strings | −0.5 each | a bonus — open strings make a shape easier |
| non-adjacent stretch | 0.5 | 1–4 stretches on low frets |

`total` sorts within each position group; groups are ordered by position (open
first). The badge shows a bucketed label (Easy / Medium / Hard), not the raw
number.

**An inner mute costs nothing**, because by the time a shape is scored its mutes
are forced ones (§5.2): the string is damped only where nothing it could sound
belongs to the chord. For a fingerstyle player that is free — the string is
simply not picked — so pricing it as difficulty was double-counting a shape the
search had already decided was the best available. The weight stays in the panel
at zero rather than being deleted, because a strummer, whose picking hand has to
cross the gap, has every reason to raise it.

### 5.5 Truncation

The reference cuts to the first 10 candidates found, which is effectively
random. Here: generate within the node budget, score all of it, then keep the
top N per position group (default 6). "Show more" expands a group.

**A fingering's identity is its fret pattern.** One pattern can admit several
legal finger assignments (§5.3); only the best-scoring assignment is kept.
Otherwise the grid fills with entries that look pixel-identical and differ only
in a number on a dot.

**The node budget must not fight the ranking.** A single global budget can be
exhausted before the search reaches the low positions — and since open strings
score best (§5.4), that would truncate away exactly the fingerings we most want
to show. So the budget is **per fret window**, and windows are searched from the
nut outward. Truncation then costs the high, hard voicings, which is the right
thing to lose.

---

## 6. Rendering

`diagram.js` computes geometry from a `Fingering` plus `DiagramOptions`
(`orientation`, `handed`, `labels`, `size`); `chord-box.js` and `neck.js` turn
that geometry into SVG. Left-handed mode is a coordinate transform, not a second
code path.

**Every diagram is the same size**, whether or not it carries a fret number.
Room for that number is reserved on both sides always: a diagram that grew when
its shape sat up the neck made a row of them ragged, and left the grid
off-centre under its own chord name. The number itself is set as large as the X
and O above it, since it is the one thing on the diagram that decides whether
you are playing the right shape in the wrong place.

SVGs are cached in an LRU keyed by `fingering + options`, as the reference's
`svgCache` does. SVG (not canvas) keeps print and export trivial — the export
path is the same string already on screen. Everything is themed with CSS custom
properties so light, dark and print styles run off one set of tokens.

### 6.1 Accessibility

Full screen-reader and keyboard support is a v1 requirement. SVG is what makes
this affordable: the geometry we already compute is exactly what a description
needs, so a diagram can describe itself.

- Each diagram is `role="img"` with an `aria-label` generated from the
  `Fingering` — chord name in the user's dialect, the shorthand, the position,
  the barre if any, and which string carries the root:

  > *"C major, x32010, open position, fingers 3-2-1, root on the 5th string."*

- The shorthand is **also** visible text, not only in the label.
- **No meaning carried by colour alone.** The reference draws a red `X` and a
  green `O` — the glyphs already differ, so colour is decoration there. The
  difficulty badge (§5.4) must follow the same rule: a word, not just a hue.
- WCAG AA contrast in light, dark and print. The theme tokens above are the
  single place this is enforced.
- Full keyboard operation with visible focus. The horizontally scrolling result
  rows (§2.3) are the main risk — a scroll container must be traversable by
  keyboard, not mouse and touch only.
- Results announce through a polite live region ("12 fingerings in 4
  positions"), since the grid updates without a navigation.
- `prefers-reduced-motion` honoured for any transition.

This is cheap done from the first diagram and expensive to retrofit, so it is a
constraint on phase 4 rather than a phase of its own.

### 6.2 What the shape sounds, beside what the symbol says

A chord symbol names the harmony. The shape decides which of the chord's notes
ends up lowest, and whether the root is sounded at all. Usually those agree and
there is nothing to remark on. When they do not, the difference is worth saying,
because it is often the arrangement rather than an accident.

The case that forced this: a six-string playing choro alongside a seven-string.
The seven-string carries the bass line, so the six-string deliberately takes a
different inversion, conventionally with its bass a third above the other
guitar's, so that the two do not double each other. A chart that says `Gm` is
played by one guitar as `Gm` and by the other as `Gm/Bb`, and the chart cannot
say both. Nor should it: the harmony is shared, and which inversion an
instrument takes is a property of its voicing.

So three layers stay separate, and only the middle one is per-instrument:

| Layer | Where it lives | Example |
| --- | --- | --- |
| The harmony | the chart, shared by every instrument | `Gm7` |
| The voicing | the per-tuning `# Voicings:` block | `x1303x` |
| The relationship | derived from the shape, shown and never stored | `Gm7/Bb` |

`voicedAs` in `core/chord.js` derives the third layer from the frets, the tuning
and the parsed symbol. Nothing is written into the song text, which matters for
two reasons: an annotation would go stale the moment a shape was edited, and it
would have to be repeated for every tuning.

Two rules make the label quiet enough to leave on:

- **Only when it differs from the symbol.** The comparison is against the
  symbol's own bass — the slash note where there is one, the root otherwise —
  and not against the root. A `C/E` asked for E underneath, so a shape that
  gives it has nothing to remark on. Comparing against the root would label
  every slash chord with the bass it was told to play.
- **The bass is spelled from the chord's own tones**, never from a pitch-class
  table. The seventh of D♭7 is C♭, not B. A table of flats gets four of the 27
  chords in one choro wrong. A note that is not in the chord at all — possible
  in a voicing written by hand — has no functional spelling to borrow and falls
  back to the chord's own accidental.

It renders in two forms, because the two places it appears want different
things. The song legend shows each chord once, so it carries the whole symbol,
the chart's name to the left and the sounded one to the right. The result list
shows many shapes of a single chord, so repeating the name would say nothing and
the card carries the bass alone. Both are italic and muted: derived, not typed.

The chart's own slash bass is dropped before the sounded one is appended. A
chart that says `D7/F#` with a shape sounding A reads as `D7/A`, because
`D7/F#/A` is not a chord.

#### Naming the chart by what the shapes sound

The chart names the harmony, and that is what a chart is for, so it keeps its
own names by default. But a player reading a sheet wants the chord under their
fingers, and with a whole song voiced into inversions the two drift apart. So
the reading page carries a checkbox: name the chords in the chart by what the
shapes sound, and `Gm | Bb/F` reads `Gm/Bb | Bb/D`.

It reaches paper for free, because the printed sheet is the same renderer. That
is the argument for the reading page being a preview rather than a second
opinion, cashed in: a display choice made there needs no second implementation
to print.

A chord whose shape sounds what its symbol says is left alone, so the option
marks the chords it has something to say about rather than rewriting all of
them.

The legend follows the chart rather than disagreeing with it. With the option
off it shows the chart's name with the sounded one beside it, so the two can be
compared. With it on, the sounded name *is* the name and the second one
disappears: repeating it in the margin would say the same thing twice, and a
legend labelled differently from the chart it belongs to is worse than either.

One consequence worth knowing: a longer name takes more width, and under a line
of words a chord sits above the syllable it falls on. Turning this on can crowd
a sung line. It is off by default and opt-in for that reason.

---

