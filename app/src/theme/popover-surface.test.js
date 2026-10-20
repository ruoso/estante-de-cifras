// unit — every React Aria popover is drawn on the shared surface
// (shell.popover_surface). Six Popovers had no class and nothing styled a bare
// one, so they rendered see-through over what is beneath (usability review
// 2026-10-19, M7/M9). This reads every component source from disk, as
// tokens-used.test.js does, and pins:
//   - each `<Popover` opening tag in a non-test .jsx carries a className whose
//     static string holds the `popover` token (the note's "a check that fails
//     on a Popover without it");
//   - controls.css draws `.popover` from the theme: --surface, --line,
//     --radius, a box-shadow, and its rows a --surface-2 focused fill
//     (constraint 3; DIRECTION §3.7: RAC components carry no look of their own).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const srcDir = path.join(process.cwd(), 'src');
const components = readdirSync(srcDir, { recursive: true })
  .filter((rel) => /\.jsx$/.test(rel) && !/\.test\.jsx$/.test(rel))
  .map((rel) => [rel.split(path.sep).join('/'), readFileSync(path.join(srcDir, rel), 'utf-8')]);

const controls = readFileSync(path.join(srcDir, 'theme', 'controls.css'), 'utf-8');

// The `<Popover …>` opening tags in a source that lack the `popover` class,
// as `file:line`. The tag runs to the first `>` outside a `{…}` expression.
function barePopovers(file, text) {
  const found = [];
  for (const m of text.matchAll(/<Popover\b/g)) {
    let depth = 0;
    let end = m.index + m[0].length;
    for (; end < text.length; end++) {
      const c = text[end];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    const tag = text.slice(m.index, end);
    const cls = tag.match(/className=(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)\s*\})/);
    const value = cls ? cls.slice(1).find((v) => v !== undefined) : null;
    if (value === null || !value.split(/\s+/).includes('popover')) {
      found.push(`${file}:${text.slice(0, m.index).split('\n').length}`);
    }
  }
  return found;
}

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');

// The declarations of every rule whose selector list matches `test`.
function declarationsOf(css, test) {
  return [...stripComments(css).matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((m) => test(m[1].trim()))
    .map((m) => m[2])
    .join(';');
}

describe('popover surface (shell.popover_surface)', () => {
  it('reads the component sources', () => {
    expect(components.length).toBeGreaterThan(10);
    expect(components.some(([, text]) => text.includes('<Popover'))).toBe(true);
  });

  it('every Popover carries the popover surface class', () => {
    const bare = components.flatMap(([file, text]) => barePopovers(file, text));
    expect(bare).toEqual([]);
  });

  it('the scan reports a bare Popover, a classless one and one with another class', () => {
    const snippet = [
      '<Popover>',
      '<Popover placement="bottom end">',
      '<Popover className="card">',
      '<Popover className="popover-ish">',
      '<Popover className="popover file-create-menu" placement="bottom end">',
      "<Popover className={'instr-popover popover'} offset={4}>",
    ].join('\n');
    expect(barePopovers('x.jsx', snippet)).toEqual(['x.jsx:1', 'x.jsx:2', 'x.jsx:3', 'x.jsx:4']);
  });

  it('the popover surface is drawn from the theme', () => {
    const surface = declarationsOf(controls, (sel) => sel.split(',').some((s) => s.trim() === '.popover'));
    expect(surface).toMatch(/background:\s*var\(--surface\)/);
    expect(surface).toMatch(/border:\s*1px solid var\(--line\)/);
    expect(surface).toMatch(/border-radius:\s*var\(--radius\)/);
    expect(surface).toMatch(/box-shadow:\s*[^;]+/);
    expect(surface).toMatch(/color:\s*var\(--ink\)/);
    expect(surface).toMatch(/overflow:\s*auto/);
    expect(surface).toMatch(/max-height:/);

    const focusedRow = declarationsOf(controls, (sel) => /\.popover/.test(sel) && /\[data-focused\]/.test(sel));
    expect(focusedRow).toMatch(/background:\s*var\(--surface-2\)/);
    const rows = declarationsOf(controls, (sel) => /\.popover/.test(sel) && /menuitem/.test(sel) && !/\[data-/.test(sel));
    expect(rows).toMatch(/min-height:\s*44px/);
  });
});
