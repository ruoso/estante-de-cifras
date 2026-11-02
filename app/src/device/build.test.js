// @vitest-environment node
// unit — the device bundle as built (reader.bundle; docs/remarkable-reader.md
// §4, §8). The gate runs Vitest before `npm run build`, so this builds into a
// temporary directory on every run and pins the manifest (§8), ES2017, that no
// polyfill is missing (§4, the spike's list), and that one locale is carried.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { Linter } from 'eslint';
import { parse } from 'cifra-md';
import { buildDevice, FIXTURE_FILE, MANIFEST_FILE } from './build.js';
import { SHAPE_CACHE_SALT } from '../core/shape-cache.js';
import { transpose } from '../core/transpose.js';
import { songDialect } from '../core/notation/dialects.js';
import { chartRows } from '../chart/layout.js';
import { surfaceInstruments } from '../worker/instruments.js';

let dir;
let outDir;
let fixtureDir;
let manifest;
let bundle;
let fixture;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'estante-device-'));
  outDir = path.join(dir, 'device');
  fixtureDir = path.join(dir, 'fixture');
  await buildDevice({ outDir, fixtureDir });
  manifest = JSON.parse(await readFile(path.join(outDir, MANIFEST_FILE), 'utf8'));
  bundle = await readFile(path.join(outDir, manifest.bundle.path));
  fixture = JSON.parse(await readFile(path.join(fixtureDir, FIXTURE_FILE), 'utf8'));
}, 120_000);

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('the manifest (§8)', () => {
  it('has exactly its fields, the host API and the salt', () => {
    expect(Object.keys(manifest).sort()).toEqual(['bundle', 'hostApi', 'salt', 'version']);
    expect(manifest.hostApi).toBe(1);
    expect(manifest.salt).toBe(SHAPE_CACHE_SALT);
  });

  it('names the bundle by its hash, beside it', async () => {
    expect(manifest.bundle.path).toMatch(/^bundle\.[0-9a-f]{8}\.js$/);
    expect(await readdir(outDir)).toEqual(expect.arrayContaining([manifest.bundle.path, MANIFEST_FILE]));
    const sha256 = createHash('sha256').update(bundle).digest('hex');
    expect(manifest.bundle.sha256).toBe(sha256);
    expect(manifest.bundle.path).toBe(`bundle.${sha256.slice(0, 8)}.js`);
    expect(manifest.version).toBe(sha256.slice(0, 12));
  });
});

describe('the bundle', () => {
  it('parses as ES2017 script (§4: rolldown to ES2017)', () => {
    const messages = new Linter().verify(bundle.toString('utf8'), {
      languageOptions: { ecmaVersion: 2017, sourceType: 'script' },
    });
    expect(messages.filter((m) => m.fatal)).toEqual([]);
  });

  it('runs with no Intl, structuredClone, TextEncoder or TextDecoder (§4 polyfills)', () => {
    const context = vm.createContext({});
    vm.runInContext('delete globalThis.Intl;', context);
    expect(vm.runInContext('typeof Intl + typeof structuredClone + typeof TextEncoder + typeof TextDecoder', context)).toBe(
      'undefinedundefinedundefinedundefined',
    );
    vm.runInContext(bundle.toString('utf8'), context);
    context.text = readFileSync(new URL('../../example-book/the-ferry-line.cifra.md', import.meta.url), 'utf8');
    context.entryJson = JSON.stringify(fixture.entry);
    context.tableJson = JSON.stringify(fixture.table);
    const out = JSON.parse(
      vm.runInContext(
        `JSON.stringify({
          hostApi: estante.hostApi,
          salt: estante.salt,
          loaded: estante.load(JSON.parse(entryJson), JSON.parse(tableJson)),
          at0: estante.sheet(text, 0),
          at5: estante.sheet(text, 5),
          misses: estante.misses(),
        })`,
        context,
      ),
    );
    expect(out.hostApi).toBe(1);
    expect(out.salt).toBe(SHAPE_CACHE_SALT);
    expect(out.loaded.held).toBe(Object.keys(fixture.table.shapes).length);
    const model = parse(context.text);
    const rows = (offset) => JSON.parse(JSON.stringify(chartRows(transpose(model, offset, { dialect: songDialect(model) }))));
    expect(out.at0.rows).toEqual(rows(0));
    expect(out.at5.rows).toEqual(rows(5));
    expect(out.at5.shapes.length).toBeGreaterThan(0);
    expect(out.at5.shapes.every((s) => s.diagram && !s.pending)).toBe(true);
    expect(out.misses).toEqual([]);
  });

  it('carries English and no other locale (§4: one locale)', () => {
    const code = bundle.toString('utf8');
    // diagram.startingAt, read by render/diagram.js, in pt-BR and in English.
    expect(readFileSync(new URL('../i18n/locales/pt-BR.js', import.meta.url), 'utf8')).toContain('a partir da casa');
    expect(code).not.toContain('a partir da casa');
    expect(code).toContain('starting at fret');
  });
});

describe('the fixture (reader.engine)', () => {
  it('is the example book’s table under the standard guitar, made by the Worker’s fill', () => {
    expect(Object.keys(fixture).sort()).toEqual(['entry', 'salt', 'songs', 'table']);
    expect(fixture.salt).toBe(SHAPE_CACHE_SALT);
    expect(fixture.entry).toEqual(JSON.parse(JSON.stringify(surfaceInstruments({}).standard)));
    expect(fixture.songs).toEqual([
      'morning-on-the-porch.cifra.md',
      'the-ferry-line.cifra.md',
      'walking-to-the-market.cifra.md',
    ]);
    expect(typeof fixture.table.fingerprint).toBe('string');
    expect(Object.keys(fixture.table.shapes).length).toBeGreaterThan(0);
  });
});
