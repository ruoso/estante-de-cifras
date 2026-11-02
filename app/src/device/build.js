// build.js — building the reMarkable reader's bundle (reader.bundle;
// docs/remarkable-reader.md §4, §8): the IIFE under its content hash, the
// manifest that names it, and — outside the served tree — one fixture per
// fixture book for the reader's integration test (reader.engine): the book's
// default-shape table, made by the Worker's own fill, and the built bundle's
// own answers under Node, the oracle goja must match byte for byte (§4 "no
// port").
//
// Node only. It prints nothing; the CLI (scripts/build-device.js) prints paths
// and the hash, never song text.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { HOST_API } from './host-api.js';
import { SHAPE_CACHE_SALT } from '../core/shape-cache.js';
import { fillDefaultShapes } from '../worker/default-shape-fill.js';
import { surfaceInstruments } from '../worker/instruments.js';

const APP_DIR = fileURLToPath(new URL('../../', import.meta.url));
const CONFIG_FILE = path.join(APP_DIR, 'vite.device.config.js');

export const MANIFEST_FILE = 'manifest.json';
export const FIXTURE_FILE = 'example-book.default-shapes.json';

/**
 * The fixture books, each with its fixture's file name and its directory,
 * app-relative (the Go test reads the texts from there). The example book
 * also carries a setlist the oracle plays.
 */
export const FIXTURE_BOOKS = [
  { file: FIXTURE_FILE, book: 'example-book', setlist: 'a-short-set.setlist.md' },
  { file: 'choros.default-shapes.json', book: 'src/device/fixtures/choros', setlist: null },
];

// The one entry chunk Vite built.
function entryCode(output) {
  const outputs = Array.isArray(output) ? output : [output];
  const chunks = outputs.flatMap((o) => o.output ?? []).filter((c) => c.type === 'chunk');
  if (chunks.length !== 1) throw new Error(`device build: expected one chunk, got ${chunks.length}`);
  return chunks[0].code;
}

// A book's songs, by file name, read from disk (the app's own loader,
// worker/example-book.js, is Vite-only).
async function bookSongs(book) {
  const dir = path.join(APP_DIR, book);
  const names = (await readdir(dir)).filter((n) => n.endsWith('.cifra.md')).sort();
  const texts = await Promise.all(names.map((n) => readFile(path.join(dir, n), 'utf8')));
  return { names, texts };
}

// The built bundle's own answers, from its bytes evaluated in a fresh
// `node:vm` context: `load`, `sheet` for every song at offsets 0-11 with no
// options, `held()` after them, and the setlist when the book has one. Values
// cross as JSON, as they do into goja.
function oracle(code, { entry, table, names, texts, setlistText, setlistPath }) {
  const context = vm.createContext({});
  vm.runInContext(code, context);
  context.input = JSON.stringify({ entry, table, texts, setlistText, setlistPath, bookPaths: names });
  const out = JSON.parse(
    vm.runInContext(
      `(() => {
        const input = JSON.parse(globalThis.input);
        const load = estante.load(input.entry, input.table);
        const sheets = input.texts.map((text) => {
          const at = [];
          for (let offset = 0; offset < 12; offset += 1) at.push(estante.sheet(text, offset));
          return at;
        });
        const held = estante.held();
        const setlist = input.setlistText == null ? null : estante.setlist(input.setlistText, input.setlistPath, input.bookPaths);
        return JSON.stringify({ load, sheets, held, setlist });
      })()`,
      context,
    ),
  );
  const expected = {
    load: out.load,
    sheets: Object.fromEntries(names.map((name, i) => [name, out.sheets[i]])),
    held: out.held,
  };
  if (setlistPath) expected.setlist = out.setlist;
  return expected;
}

/**
 * Build the device bundle and its manifest into `outDir`, and one fixture per
 * fixture book into `fixtureDir`. Relative directories are read from the app's
 * directory.
 *
 * @param {{ outDir: string, fixtureDir: string }} opts
 * @returns {Promise<{ bundlePath: string, manifestPath: string, fixturePath: string, fixturePaths: string[], manifest: object }>}
 */
export async function buildDevice({ outDir, fixtureDir }) {
  const out = path.resolve(APP_DIR, outDir);
  const fixtures = path.resolve(APP_DIR, fixtureDir);

  const output = await build({ configFile: CONFIG_FILE, build: { write: false } });
  const code = Buffer.from(entryCode(output), 'utf8');
  const sha256 = createHash('sha256').update(code).digest('hex');
  const bundleName = `bundle.${sha256.slice(0, 8)}.js`;

  // §8: the manifest's `qml` and `backend` fields are reader.payload's.
  const manifest = {
    version: sha256.slice(0, 12),
    hostApi: HOST_API,
    salt: SHAPE_CACHE_SALT,
    bundle: { path: bundleName, sha256 },
  };

  await mkdir(out, { recursive: true });
  const bundlePath = path.join(out, bundleName);
  const manifestPath = path.join(out, MANIFEST_FILE);
  await writeFile(bundlePath, code);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const entry = surfaceInstruments({}).standard;
  await mkdir(fixtures, { recursive: true });
  const fixturePaths = [];
  for (const { file, book, setlist } of FIXTURE_BOOKS) {
    const { names, texts } = await bookSongs(book);
    const writes = await fillDefaultShapes({ texts, entry, cacheModel: {} });
    const table = writes[0]?.value ?? null;
    const setlistText = setlist ? await readFile(path.join(APP_DIR, book, setlist), 'utf8') : null;
    const expected = oracle(code.toString('utf8'), { entry, table, names, texts, setlistText, setlistPath: setlist });
    const fixture = { book, salt: SHAPE_CACHE_SALT, entry, songs: names, table, expected };
    if (setlist) fixture.setlist = setlist;
    const fixturePath = path.join(fixtures, file);
    await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
    fixturePaths.push(fixturePath);
  }

  return { bundlePath, manifestPath, fixturePath: fixturePaths[0], fixturePaths, manifest };
}
