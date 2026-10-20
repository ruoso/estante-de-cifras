# e2e/web/explore — persona exploration

Agents playing a person (a guitar teacher, a student, a bandmate) drive the
app in a real browser and report what confused them, with screenshots. It
finds what scripted tests cannot: the suite checks the paths we designed,
while an explorer tries the paths a newcomer guesses. Nothing here runs in
the gate.

The pilot on 2026-10-19 (two Haiku agents as guitar teachers, one on a fresh
device and one signed in) found real bugs that a review and the whole suite
had missed — Share failing on a book only on this device, a chord glued to the
last lyric, a setlist picker offering songs already in the setlist — and
independently confirmed several already planned.

## Pieces

- `seeds.spec.js` — starting states, each reached through the real UI with
  the suite's journeys and then paused (`page.pause()`). Add one per state a
  persona needs.
- `../explore.config.js` — runs the seeds: the suite's projects and origin,
  `testDir: ./explore`, full traces. `playwright.config.js` (the gate's) never
  sees them.
- `../../../scripts/explore` — the stack and the seeds: `up`, `seed`, `stop`,
  `down`, `env`.
- `explorer-prompt.md` — the prompt to give an exploring agent, with the
  persona, goals and seed to fill in.

The browser is driven with `playwright-cli`, which ships with
`@playwright/test` (`npx playwright cli`): an accessibility-tree `snapshot`
with element refs, `click`/`fill`/`type`, `screenshot`, `resize`, and
`attach` to a test paused under `--debug=cli`. Every action prints the
equivalent Playwright code, so a confirmed finding's steps translate into a
test.

## Running a session

```sh
scripts/explore up                 # build and start the stack (explore-estante)

# For each persona, in a directory of its own:
OUT=/tmp/explore/teacher-first-time
# hand an agent explorer-prompt.md with {SEED}, {VIEWPORT}, {OUT}, the persona
# and the goals filled in; it runs `scripts/explore seed …` itself, attaches,
# explores, and stops its seed.

scripts/explore down               # when finished
```

To drive a seed yourself instead: `S=$(scripts/explore seed "hosted book"
phone $OUT)`, then from `e2e/web` `npx playwright cli attach $S`,
`npx playwright cli -s=$S resume`, and explore; `npx playwright cli show
--annotate` lets you mark up the live page for an agent.

Several sessions can share one stack; each seed has its own browser, and each
seed makes its own account where it signs in.

## Stack and safety

- The compose project is `explore-estante` on fixed ports (18080 for the app,
  18025 for the mail catcher, 15433 for Postgres); override with
  `EXPLORE_PROJECT`, `EXPLORE_HTTP_PORT`, `EXPLORE_MAIL_PORT`,
  `EXPLORE_PG_PORT`. It must not be named `estante-*`: the orchestrator tears
  those down before every gate.
- The stack is built from the checkout `scripts/explore` lives in. Run it from
  a separate worktree (`git worktree add ../estante-explore main`) when the
  orchestrator is working in the main checkout, so its uncommitted changes
  are not what gets explored.
- Secrets are fixed throwaway values; the stack is local only.

## From finding to work

An explorer's report is a lead, not a verdict. Verify each finding against
its screenshots, the code and the workflows (`docs/workflows/`) before it
becomes anything: some are as designed, some are artifacts of the seed (saves
made by a seed carry the journeys' author name, Marina Souza). A confirmed bug
becomes a WBS leaf citing the persona exploration and its date, with the
steps to reproduce; its test lands with the fix, not before — a failing spec
in `tests/` would turn the gate red.
