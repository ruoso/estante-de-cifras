// build.js — building the reMarkable reader's bundle (reader.bundle;
// docs/remarkable-reader.md §4, §8): the IIFE under its content hash, the
// manifest that names it, and — outside the served tree — the example book's
// default-shape table, made by the Worker's own fill, for the reader's
// integration test (reader.engine).
//
// Node only. It prints nothing; the CLI (scripts/build-device.js) prints paths
// and the hash, never song text.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { HOST_API } from './host-api.js';
import { SHAPE_CACHE_SALT } from '../core/shape-cache.js';
import { fillDefaultShapes } from '../worker/default-shape-fill.js';
import { surfaceInstruments } from '../worker/instruments.js';

const APP_DIR = fileURLToPath(new URL('../../', import.meta.url));
const CONFIG_FILE = path.join(APP_DIR, 'vite.device.config.js');
const EXAMPLE_BOOK = path.join(APP_DIR, 'example-book');

export const MANIFEST_FILE = 'manifest.json';
export const FIXTURE_FILE = 'example-book.default-shapes.json';

// The one entry chunk Vite built.
function entryCode(output) {
  const outputs = Array.isArray(output) ? output : [output];
  const chunks = outputs.flatMap((o) => o.output ?? []).filter((c) => c.type === 'chunk');
  if (chunks.length !== 1) throw new Error(`device build: expected one chunk, got ${chunks.length}`);
  return chunks[0].code;
}

// The example book's songs, by file name, read from disk (the app's own
// loader, worker/example-book.js, is Vite-only).
async function exampleSongs() {
  const names = (await readdir(EXAMPLE_BOOK)).filter((n) => n.endsWith('.cifra.md')).sort();
  const texts = await Promise.all(names.map((n) => readFile(path.join(EXAMPLE_BOOK, n), 'utf8')));
  return { names, texts };
}

/**
 * Build the device bundle and its manifest into `outDir`, and the example
 * book's default-shape table into `fixtureDir`. Relative directories are read
 * from the app's directory.
 *
 * @param {{ outDir: string, fixtureDir: string }} opts
 * @returns {Promise<{ bundlePath: string, manifestPath: string, fixturePath: string, manifest: object }>}
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

  const { names, texts } = await exampleSongs();
  const entry = surfaceInstruments({}).standard;
  const writes = await fillDefaultShapes({ texts, entry, cacheModel: {} });
  const fixture = { salt: SHAPE_CACHE_SALT, entry, table: writes[0]?.value ?? null, songs: names };
  await mkdir(fixtures, { recursive: true });
  const fixturePath = path.join(fixtures, FIXTURE_FILE);
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);

  return { bundlePath, manifestPath, fixturePath, manifest };
}
