// Render the design-canvas boards (docs/mockups/*.dc.html) without the canvas
// runtime, and screenshot every device frame on them.
//
// The boards rely on the canvas's support.js, which is not in the repository.
// They use a small slice of it, which this file stands in for:
//   - <x-dc> holds the template; <helmet> holds head content (fonts);
//   - a <script type="text/x-dc" data-dc-script data-props> defines
//     `class Component extends DCLogic { renderVals() {...} }`, whose return
//     value fills the template; `this.props` carries the board's tweaks
//     (theme, density) or, for an imported component, its attributes;
//   - {{dotted.path}} holes in text and attribute values;
//   - <sc-for list="{{xs}}" as="x">, <sc-if value="{{flag}}">;
//   - <dc-import name="ChordBox" …attrs> — another board used as a component.
// hint-* attributes are canvas editor hints and are ignored.
//
// Usage: node audit/render-mockups.mjs [--themes estante,palco] [--out audit/out/mockups] [board…]
// Writes <out>/<theme>/<board>--<n>-<device>.png and <out>/frames.json.

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOCKUPS = join(ROOT, 'docs/mockups');
const require = createRequire(join(ROOT, 'e2e/web/package.json'));
const { chromium } = require('playwright');

const args = process.argv.slice(2);
let themes = ['estante', 'palco'];
let out = join(ROOT, 'audit/out/mockups');
const only = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--themes') themes = args[++i].split(',');
  else if (args[i] === '--out') out = resolve(args[++i]);
  else only.push(args[i]);
}

function parseBoard(file) {
  const html = readFileSync(join(MOCKUPS, file), 'utf8');
  const helmet = (html.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  const body = (html.match(/<x-dc>([\s\S]*?)<\/x-dc>/) || [, ''])[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const script = html.match(/<script type="text\/x-dc" data-dc-script data-props='([^']*)'>([\s\S]*?)<\/script>/);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [, file])[1];
  return { file, title, helmet, body, props: script ? JSON.parse(script[1]) : {}, code: script ? script[2] : '' };
}

// Runs in the page: expand a template against renderVals, recursively for imports.
function expandInPage({ boardJson, components, theme, density }) {
  class DCLogic { constructor(props) { this.props = props; } }
  const make = (code) => new Function('DCLogic', `${code}\nreturn Component;`)(DCLogic);
  const lookup = (scope, path) => {
    const [head, ...rest] = path.split('.');
    let v = scope[head];
    for (const k of rest) v = v == null ? undefined : v[k];
    return v;
  };
  const HOLE = /\{\{\s*([A-Za-z_$][\w$.]*)\s*\}\}/g;
  const fill = (text, scope) => text.replace(HOLE, (_, p) => { const v = lookup(scope, p); return v == null ? '' : String(v); });
  const single = (text) => { const m = /^\s*\{\{\s*([A-Za-z_$][\w$.]*)\s*\}\}\s*$/.exec(text || ''); return m && m[1]; };

  function expand(node, scope, outParent) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) { outParent.appendChild(document.createTextNode(fill(child.nodeValue, scope))); continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'sc-for') {
        const list = lookup(scope, single(child.getAttribute('list'))) || [];
        const as = child.getAttribute('as');
        for (const item of list) expand(child, { ...scope, [as]: item }, outParent);
        continue;
      }
      if (tag === 'sc-if') {
        if (lookup(scope, single(child.getAttribute('value')))) expand(child, scope, outParent);
        continue;
      }
      if (tag === 'dc-import') {
        const comp = components[child.getAttribute('name')];
        const props = {};
        for (const a of child.attributes) if (a.name !== 'name' && !a.name.startsWith('hint-')) props[a.name] = fill(a.value, scope);
        if (props.inherit === 'yes' || props.inherit === 'true') props.inherit = true;
        const wrap = document.createElement('span');
        wrap.style.display = 'inline-flex';
        renderInto(comp, props, wrap);
        outParent.appendChild(wrap);
        continue;
      }
      const real = child.namespaceURI && child.namespaceURI.includes('svg')
        ? document.createElementNS('http://www.w3.org/2000/svg', child.localName) : document.createElement(tag);
      for (const a of child.attributes) if (!a.name.startsWith('hint-')) real.setAttribute(a.name, fill(a.value, scope));
      expand(child.content || child, scope, real);
      outParent.appendChild(real);
    }
  }
  function renderInto(def, props, target) {
    const Comp = make(def.code);
    const vals = new Comp(props).renderVals();
    const tpl = document.createElement('template');
    tpl.innerHTML = def.body;
    expand(tpl.content, vals, target);
  }
  const root = document.getElementById('board');
  renderInto(boardJson, { theme, density }, root);
}

const files = readdirSync(MOCKUPS).filter((f) => f.endsWith('.dc.html') && f !== 'ChordBox.dc.html')
  .filter((f) => !only.length || only.some((o) => f.startsWith(o)));
const components = { ChordBox: parseBoard('ChordBox.dc.html') };
const css = readFileSync(join(MOCKUPS, 'theme.css'), 'utf8');

const browser = await chromium.launch();
const frames = [];
try {
  for (const theme of themes) {
    mkdirSync(join(out, theme), { recursive: true });
    for (const file of files) {
      const board = parseBoard(file);
      const page = await browser.newPage({ viewport: { width: 3400, height: 2200 } });
      await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">${board.helmet}<style>${css}</style></head><body><div id="board"></div></body></html>`, { waitUntil: 'load' });
      await page.evaluate(expandInPage, { boardJson: board, components, theme, density: 'comfortable' });
      await page.evaluate(() => document.fonts.ready);
      const stem = file.replace('.dc.html', '');
      // Every device frame, with the label of its column.
      const devs = await page.$$('.dev');
      const meta = await page.$$eval('.dev', (els) => els.map((el) => {
        const col = el.closest('.dev-col');
        const label = col?.querySelector('.dev-label')?.innerText.trim() ?? '';
        const kind = ['phone', 'tablet', 'desktop'].find((k) => el.classList.contains(k)) ?? 'other';
        return { kind, label, text: el.innerText.replace(/\s+\n/g, '\n').trim() };
      }));
      for (let i = 0; i < devs.length; i++) {
        const png = join(theme, `${stem}--${i + 1}-${meta[i].kind}.png`);
        await devs[i].screenshot({ path: join(out, png) });
        frames.push({ board: file, title: board.title, theme, index: i + 1, ...meta[i], png });
      }
      if (!devs.length) {
        const png = join(theme, `${stem}--board.png`);
        await page.locator('#board > *').first().screenshot({ path: join(out, png) });
        frames.push({ board: file, title: board.title, theme, index: 0, kind: 'board', label: '', text: '', png });
      }
      await page.close();
      console.log(`${theme} ${file}: ${devs.length || 'whole board'}`);
    }
  }
} finally {
  await browser.close();
}
writeFileSync(join(out, 'frames.json'), JSON.stringify(frames, null, 1));
console.log(`${frames.length} frames → ${out}`);
