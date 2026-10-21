# Writing a workflow board for the Estante de Cifras mockups

You are writing one or more artboard files for a design canvas. Each board shows one
workflow of the Estante de Cifras app on **two phones, one tablet and one computer**.
The design decisions behind each workflow are in
`/home/ruoso/devel/estante-de-cifras/docs/workflows/NN-*.md` (read yours in full) and
`/home/ruoso/devel/estante-de-cifras/docs/DIRECTION.md` (skim §2–4). The mockups must show
what those documents decided — real states, real copy, no invention beyond them.

## Files

- Folder: `/tmp/claude-1000/-home-ruoso-devel-explore-chords/81066f2c-a589-49b9-9390-d9ece7b5d72a/scratchpad/estante-mockups/project/`
- **Read first, completely:** `W02-find-and-play.dc.html` (the worked example — copy its structure exactly), `theme.css` (every class you may use), `ChordBox.dc.html` (the chord diagram component's props).
- Write ONLY your own board files, with the exact file names you were given. Do not edit `theme.css`, `canvas.json`, `Main.dc.html`, `ChordBox.dc.html`, `W02-*`, or anyone else's board. If you need a style theme.css lacks, use inline `style="…"` with the CSS variables (`var(--accent)` etc.), never hard-coded colours.
- Write each file directly with the Write tool. Do not publish, do not render, screenshot, open a browser or install anything. Do not verify by running it. Just write carefully.

## The format (rules that fail silently if broken)

- Copy W02's `<head>` (the `support.js` line EXACTLY, then the `theme.css` link) and its whole `<helmet>` (the Google Fonts link and `body{margin:0}`) verbatim. Change only `<title>`.
- Root: `<div class="est theme-{{theme}} density-{{density}} board" style="width: 3208px; height: 1500px">`, then `board-head` (board-num "Workflow N", h1 board-title, p board-sub with one or two sentences), then `<div class="devices">` with three `dev-col`s: phones (a `dev-pair` of two `dev phone`), `dev tablet`, `dev desktop`, each with a `dev-label` line (`<b>Phone</b> · what this shows`).
- Same `<script type="text/x-dc" data-dc-script data-props='…'>` as W02: the `theme` and `density` enum tweaks exactly, `$preview` 3208×1500, `class Component extends DCLogic` with `renderVals()` returning `theme`, `density` and your data. Classic JS only.
- `{{hole}}` is a dotted lookup only — never an expression. Compute everything in `renderVals()`.
- Close every element, quote every attribute. `class` with holes is fine: `class="ln {{ln.cls}}"`.
- `<sc-for list="{{items}}" as="it" hint-placeholder-count="3">` and `<sc-if value="{{flag}}" hint-placeholder-val="{{ true }}">` — always with the hint attributes.
- **The rendered chart is NOT monospaced** — never align chords with spaces in a rendered chart. It is drawn in a proportional face as **segments**: each chord stacked over the words it is attached to. Use the `L` helpers and the chart markup in the section *Charts* below, exactly. Only the raw **source editor** (`.editor`, showing the `.cifra.md` text) is monospaced; its lines come from data as `{cls, text}` rendered `<div class="ln {{ln.cls}}">{{ln.text}}</div>`, as before.
- Chord diagrams: `<dc-import name="ChordBox" chord="Cm" frets="x35543" kind="song|yours|default" size="s|m|l" inherit="yes" hint-size="64px,80px"></dc-import>` (s ≈ 64×80, m ≈ 90×110, add 14px height when kind is yours/default). Never a prop called `name` other than the component name. Frets: 6 chars for guitar (`x32010`), dashes when a fret ≥ 10 (`8-10-10-8-8-8`); cavaquinho/ukulele 4 strings (`0234`).
- Real `<button>` and `<a href="#">` for everything clickable; `aria-label` on icon-only buttons. Icons are inline stroke SVG (below), never emoji, never icon fonts. `<input>`s with `<label>` where a field is drawn as a field, or the `.input` look on a `<div>` for static text fields is fine.
- No fake status bars, no lorem ipsum, no invented statistics. Lyrics: never real song lyrics. Use the invented Portuguese lyrics of *Tarde Clara* (in W02) or invent short new ones. Real song titles (Carinhoso, Asa Branca, A Banda…) are fine as titles only.
- People and books to reuse for consistency: **Ana** (a teacher; her book *Choros da Ana*), the band book **Banda do Bairro**, the user's own **My songs**, the user's instrument guitar (E2 A2 D3 G3 B3 E4); cavaquinho is D4 G4 B4 D5; ukulele G4 C4 E4 A4. Song authors: invent (e.g. Pedro Araújo).
- Keep content inside the frames: phones are 390×844 with a 10px rim, so ~370px of content width; tablet 820×1180; computer 1280×800. Prefer fewer, well-composed elements to cramming. `.scroll` areas clip (`overflow: hidden`) — design as if scrolled to the top.

## Visual vocabulary (all in theme.css)

App chrome: `.appbar` (+ `.title`), `.screen`, `.scroll`, `.split` with `.pane.side` + `.pane.main` (computer, tablet landscape-ish splits), `.tabbar` + `.tab` (`.on`) — the phone tab bar is **Search · Books · Setlists** (W02).
Controls: `.btn` (`.primary`, `.quiet`, `.danger`, `.icon`, `.block`), `.input`, `.field` + `label`, `.search` (`.focus`, `.scope` chip inside for a scope filter), `.seg` (segmented, `button.on`), `.toggle` (`.on`), `.check` (`.on`).
Status (always a word): `.badge` + `.unsaved|.conflict|.ok|.voiced`, `.dot` modifier; `.chip`, `.chip.accent` (instrument chip).
Lists: `.list` > `.row` (`.sel`, `.explore`) with `.grow` > `.name` + `.meta`, `.badges`, `.section-label`; `.card` (`.pad`).
Notices: `.notice` (`.accent|.unsaved|.conflict`) with `.act` for its action.
Overlays: `.scrim` (bottom sheet) or `.scrim.center` (dialog) positioned over a screen — put it as the last child of the `.dev` (which is `position: relative`); `.sheet` (with `.grip`), `.dialog`, `.actions`.
Music: `.chart` holds chart lines built with the `L` helpers (see *Charts*); a line can carry an extra class for marking: `mark-def` (shows defaults, dashed), `mark-conf` (conflict), `mark-tap` (chords tappable in arrange mode). `.shapes` + ChordBox. `.editor` > `.ln` with `.md` (markdown syntax lines), `.ch`, `.cur`, `.err`, `.err-note` (the words under an `.err` line, "Line N: …" — unnumbered, in the interface face, tied to the red line by a rule in `--conflict`; status in words, never the red alone), `.mk` (conflict marker lines), `.add`/`.del` (diff lines) — monospaced, for source text only.
Diffs: `.diff` > `.d` > `.k` + `.was` / `.now`.
Type: `.t-display`, `.t-h1`, `.t-h2`, `.t-h3` (small caps label), `.t-body`, `.t-small`, `.t-mono`.
Progress: `.bar` > `div` with `style="width: 40%"`.

## Charts

Put this at the top of `renderVals()` (classic JS) and build each chart as an array of lines:

```js
const segsOf = (chords, words) => {
  const toks = []; const re = /\S+/g; let m;
  while ((m = re.exec(chords))) toks.push({ c: m[0], at: m.index });
  if (!toks.length) return [{ c: '', w: words }];
  const segs = [];
  if (toks[0].at > 0) segs.push({ c: '', w: words.slice(0, toks[0].at).replace(/([^\s_])_+(?=[^\s_]|$)/g, '$1') });
  toks.forEach((t, i) => {
    const end = i + 1 < toks.length ? toks[i + 1].at : Math.max(words.length, t.at);
    segs.push({ c: t.c, w: words.slice(t.at, end).replace(/([^\s_])_+(?=[^\s_]|$)/g, '$1') || ' ' });
  });
  return segs.map((sg, i) => ({ c: sg.c, w: sg.w, j: i + 1 < segs.length && /\S$/.test(sg.w) && /^\S/.test(segs[i + 1].w) }));
};
const L = {
  sec: (t) => ({ isSec: true, text: t }),
  sung: (c, w, cls) => ({ isSung: true, segs: segsOf(c, w), cls: cls || '' }),
  bars: (t, cls) => ({ isBars: true, ms: t.split('|').map((x) => x.trim()).filter((x) => x).map((x) => ({ cs: x })), cls: cls || '' }),
  run: (t, cls) => ({ isRun: true, text: t, cls: cls || '' }),
  words: (t) => ({ isWords: true, text: t }),
  gap: () => ({ isGap: true }),
};
// e.g.
const tarde = [
  L.sec('Primeira Parte'),
  L.sung('G           D', 'Quando eu te vi passar'),
  L.sung('Em              C', 'naquela tarde clara'),
  L.gap(),
  L.bars('G | D | Em | C'),
];
```

`L.sung(chordLine, words)` takes the chord line and the words as they are written in the source, column-aligned, and turns them into segments attached by column — that is the format's own attachment rule, so write the pair as a musician would type it. Underscore padding in the words (`W_hen`, the canonical text's room made inside a word) is removed by the helper, as a proportional renderer does; where a chord then opens room inside a word, the `.fill` span draws a centred hyphen in the gap, as under notes in sheet music. `L.bars` is a chord-only line with bar lines; `L.run` a chord-only line with no bars (`G D Em C`, an intro); `L.words` a line of words with no chords.

Render a chart with exactly this markup (rename `tarde` to your list):

```html
<div class="chart">
  <sc-for list="{{tarde}}" as="l" hint-placeholder-count="6">
    <sc-if value="{{l.isSec}}" hint-placeholder-val="{{ false }}"><div class="sec-name">{{l.text}}</div></sc-if>
    <sc-if value="{{l.isSung}}" hint-placeholder-val="{{ true }}"><div class="sung {{l.cls}}"><sc-for list="{{l.segs}}" as="sg" hint-placeholder-count="3"><span class="s"><span class="c">{{sg.c}}</span><span class="w">{{sg.w}}<sc-if value="{{sg.j}}" hint-placeholder-val="{{ false }}"><span class="fill"></span></sc-if></span></span></sc-for></div></sc-if>
    <sc-if value="{{l.isBars}}" hint-placeholder-val="{{ false }}"><div class="barline {{l.cls}}"><sc-for list="{{l.ms}}" as="ms" hint-placeholder-count="4"><span class="m">{{ms.cs}}</span></sc-for></div></sc-if>
    <sc-if value="{{l.isRun}}" hint-placeholder-val="{{ false }}"><div class="runline {{l.cls}}">{{l.text}}</div></sc-if>
    <sc-if value="{{l.isWords}}" hint-placeholder-val="{{ false }}"><div class="words">{{l.text}}</div></sc-if>
    <sc-if value="{{l.isGap}}" hint-placeholder-val="{{ false }}"><div class="gap"></div></sc-if>
  </sc-for>
</div>
```

A bigger chart on a tablet or computer: add `style="--chart-size: 20px"` to the `.chart` div.

## Icon snippets (24px, stroke currentColor; resize via width/height)

- search: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>`
- back: `<path d="M15 18l-6-6 6-6"></path>` · close: `<path d="M6 6l12 12M18 6L6 18"></path>` · plus: `<path d="M12 5v14M5 12h14"></path>` · check: `<path d="M5 12l5 5 9-10"></path>`
- more (filled): `<svg … fill="currentColor"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg>`
- transpose: `<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"></path>` · history: `<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"></path>`
- share: `<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5"></path>` · link: `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path>`
- sync: `<path d="M20 11a8 8 0 0 0-14-5l-2 2M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2M20 20v-4h-4"></path>` · offline (cloud-off): `<path d="M3 3l18 18M8 7a6 6 0 0 1 10 4h1a4 4 0 0 1 2 7.5M17 18H7a4 4 0 0 1-1-7.9"></path>`
- book(s): `<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-.8 3 15.6-3.5.8z"></path>` · file: `<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"></path><path d="M14 3v5h5"></path>` · folder: `<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"></path>`
- download: `<path d="M12 4v12M7 11l5 5 5-5M4 20h16"></path>` · upload: `<path d="M12 20V8M7 13l5-5 5 5M4 4h16"></path>` · trash: `<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path>` · edit: `<path d="M4 20h4L19 9l-4-4L4 16z"></path>`
- lock: `<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>` · user: `<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path>` · key (passkey): `<circle cx="8" cy="15" r="4"></circle><path d="M11 12l9-9M17 6l3 3M15 8l2 2"></path>`
- list: `<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"></path>` · play: `<path d="M7 4l13 8-13 8z"></path>` · drag handle: `<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"></path>` · warning: `<path d="M12 3l10 18H2zM12 10v5M12 18h.01"></path>` · fork: `<circle cx="6" cy="5" r="2"></circle><circle cx="18" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle><path d="M6 7v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7M12 12v5"></path>`

## When done

Report: the files written, and for each board one line per device on what it shows. Nothing else.
