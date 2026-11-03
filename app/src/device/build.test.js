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
import { buildDevice, FIXTURE_BOOKS, FIXTURE_FILE, MANIFEST_FILE } from './build.js';
import { SHAPE_CACHE_SALT } from '../core/shape-cache.js';
import { transpose } from '../core/transpose.js';
import { songDialect } from '../core/notation/dialects.js';
import { chartRows } from '../chart/layout.js';
import { surfaceInstruments } from '../worker/instruments.js';
import { fillDefaultShapes } from '../worker/default-shape-fill.js';

let dir;
let outDir;
let fixtureDir;
let manifest;
let bundle;
let fixture;
let fixtures; // by file name

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'estante-device-'));
  outDir = path.join(dir, 'device');
  fixtureDir = path.join(dir, 'fixture');
  await buildDevice({ outDir, fixtureDir });
  manifest = JSON.parse(await readFile(path.join(outDir, MANIFEST_FILE), 'utf8'));
  bundle = await readFile(path.join(outDir, manifest.bundle.path));
  fixture = JSON.parse(await readFile(path.join(fixtureDir, FIXTURE_FILE), 'utf8'));
  fixtures = {};
  for (const { file } of FIXTURE_BOOKS) {
    fixtures[file] = JSON.parse(await readFile(path.join(fixtureDir, file), 'utf8'));
  }
}, 240_000);

afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('the manifest (§8)', () => {
  it('has exactly its fields, the host API and the salt', () => {
    expect(Object.keys(manifest).sort()).toEqual(['bundle', 'hostApi', 'salt', 'version']);
    expect(manifest.hostApi).toBe(2);
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
    expect(out.hostApi).toBe(2);
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
  const APP = new URL('../../', import.meta.url);
  const texts = (f) => f.songs.map((name) => readFileSync(new URL(`${f.book}/${name}`, APP), 'utf8'));

  it('is the example book’s table under the standard guitar, made by the Worker’s fill', () => {
    expect(Object.keys(fixture).sort()).toEqual(['book', 'entry', 'expected', 'salt', 'setlist', 'songs', 'table']);
    expect(fixture.book).toBe('example-book');
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

  it('writes one fixture per fixture book, each naming its book', () => {
    expect(FIXTURE_BOOKS.map((b) => b.file)).toEqual([FIXTURE_FILE, 'choros.default-shapes.json']);
    for (const { file, book } of FIXTURE_BOOKS) {
      expect(fixtures[file].book).toBe(book);
      expect(fixtures[file].salt).toBe(SHAPE_CACHE_SALT);
      expect(fixtures[file].songs.length).toBeGreaterThan(0);
    }
    expect(fixtures['choros.default-shapes.json'].songs).toHaveLength(4);
  });

  it('holds, for each book, the Worker’s fill over its songs', async () => {
    for (const f of Object.values(fixtures)) {
      const writes = await fillDefaultShapes({ texts: texts(f), entry: f.entry, cacheModel: {} });
      expect(f.table).toEqual(JSON.parse(JSON.stringify(writes[0].value)));
    }
  }, 120_000);

  // §4.1: against the fill, nothing is pending at any of the twelve keys.
  it('records the bundle’s answers at all twelve keys with no misses', () => {
    for (const f of Object.values(fixtures)) {
      expect(f.expected.load.held).toBe(Object.keys(f.table.shapes).length);
      expect(Object.keys(f.expected.sheets)).toEqual(f.songs);
      for (const name of f.songs) {
        const sheets = f.expected.sheets[name];
        expect(sheets).toHaveLength(12);
        sheets.forEach((sheet, offset) => {
          expect(sheet.error).toBeUndefined();
          expect(sheet.offset).toBe(offset);
          expect(sheet.shapes.some((s) => s.pending)).toBe(false);
        });
      }
      expect(f.expected.held.misses).toBe(0);
      expect(f.expected.held.songs).toBe(f.songs.length);
    }
  });

  it('the choro songs are chord-heavy, read in three dialects, and parse with no diagnostic', () => {
    const f = fixtures['choros.default-shapes.json'];
    const models = texts(f).map((text) => parse(text));
    for (const model of models) expect(model.diagnostics).toEqual([]);
    expect(new Set(models.map((m) => songDialect(m)))).toEqual(new Set(['brazilian', 'american', 'realbook']));
    const symbols = new Set(
      Object.values(f.expected.sheets).flatMap((sheets) => sheets[0].shapes.map((s) => s.symbol)),
    );
    for (const pattern of [/°|dim/, /m7\(b5\)/, /7\(b9\)/, /7\(#5\)/, /7\(#11\)/, /6[(/]9/, /13/, /\//]) {
      expect([...symbols].some((s) => pattern.test(s)), String(pattern)).toBe(true);
    }
  });

  it('records the example set’s playable items', () => {
    const { setlist } = fixture.expected;
    expect(setlist.missing).toBe(0);
    expect(setlist.items.map((i) => i.path)).toEqual([
      'morning-on-the-porch.cifra.md',
      'the-ferry-line.cifra.md',
      'walking-to-the-market.cifra.md',
    ]);
    expect(setlist.items[2].key).toBe('A');
    expect(fixtures['choros.default-shapes.json'].expected.setlist).toBeUndefined();
  });
});
