/**
 * e2e-api — the reMarkable reader's payload, served from the site under
 * /device/ beside the app, against the real compose image (reader.payload).
 *
 * Pins docs/remarkable-reader.md §8 (the served layout and manifest, the cache
 * policies, the 404) and §2.1 step 4 (the folder a person downloads is the
 * installable one). The image is built from the working tree by the gate, so
 * this reads the very payload its `reader` stage laid out. Black-box via
 * HttpClient at ESTANTE_E2E_BASE_URL, modeled on app.test.js.
 */
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

import { describe, it, expect, beforeAll } from 'vitest';

import { HttpClient } from './lib/http.js';

const HEX12 = /^[0-9a-f]{12}$/;
const HEX64 = /^[0-9a-f]{64}$/;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// The files the manifest names, as [key, entry].
function namedFiles(manifest) {
  return [
    ['bundle', manifest.bundle],
    ['qml', manifest.qml],
    ['backend.armv7', manifest.backend.armv7],
    ['backend.arm64', manifest.backend.arm64],
    ['folder.armv7', manifest.folder.armv7],
    ['folder.arm64', manifest.folder.arm64],
  ];
}

// A minimal ustar reader: { name → { type, data } } for every entry.
function untar(bytes) {
  const entries = new Map();
  const field = (block, start, length) => {
    const raw = block.subarray(start, start + length);
    const end = raw.indexOf(0);
    return new TextDecoder().decode(end === -1 ? raw : raw.subarray(0, end));
  };
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const block = bytes.subarray(offset, offset + 512);
    if (block.every((b) => b === 0)) break;
    const prefix = field(block, 345, 155);
    const base = field(block, 0, 100);
    const name = prefix ? `${prefix}/${base}` : base;
    const size = parseInt(field(block, 124, 12).trim() || '0', 8);
    const type = field(block, 156, 1) || '0';
    offset += 512;
    entries.set(name, { type, data: bytes.subarray(offset, offset + size) });
    offset += Math.ceil(size / 512) * 512;
  }
  return entries;
}

describe('the device payload (/device/)', () => {
  const client = new HttpClient();
  let manifest;
  const bodies = new Map();

  beforeAll(async () => {
    const response = await client.get('/device/manifest.json');
    expect(response.status).toBe(200);
    manifest = await response.json();
  });

  it('serves the manifest as revalidated JSON with noindex, in §8 shape', async () => {
    const response = await client.get('/device/manifest.json');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('cache-control')).toContain('no-cache');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');

    expect(manifest.version).toMatch(HEX12);
    expect(manifest.hostApi).toBe(1);
    expect(typeof manifest.salt).toBe('string');
    expect(manifest.salt.length).toBeGreaterThan(0);
    for (const [key, entry] of namedFiles(manifest)) {
      expect(typeof entry.path, key).toBe('string');
      expect(entry.sha256, key).toMatch(HEX64);
    }
    for (const arch of ['armv7', 'arm64']) {
      expect(manifest.backend[arch].hostApi).toBe(1);
      expect(manifest.backend[arch].version).toMatch(HEX12);
    }

    // §8: the payload's version is the digest of its files' sorted
    // "path sha256" lines.
    const lines = namedFiles(manifest)
      .map(([, entry]) => `${entry.path} ${entry.sha256}\n`)
      .sort();
    expect(manifest.version).toBe(sha256(lines.join('')).slice(0, 12));
  });

  it('serves every file it names, matching its sha256, with its cache policy', async () => {
    for (const [key, entry] of namedFiles(manifest)) {
      const response = await client.get(`/device/${entry.path}`);
      expect(response.status, key).toBe(200);
      const body = new Uint8Array(await response.arrayBuffer());
      expect(sha256(body), key).toBe(entry.sha256);
      bodies.set(key, body);
      const cache = response.headers.get('cache-control');
      if (key.startsWith('folder.')) {
        expect(cache, key).toContain('no-cache');
        expect(response.headers.get('content-type'), key).toBe('application/gzip');
      } else {
        expect(cache, key).toContain('immutable');
      }
    }

    // The backends are the architectures' ELF executables: armv7 is
    // ELFCLASS32 / EM_ARM (40), arm64 is ELFCLASS64 / EM_AARCH64 (183).
    for (const [arch, elfClass, machine] of [
      ['armv7', 1, 40],
      ['arm64', 2, 183],
    ]) {
      const elf = bodies.get(`backend.${arch}`);
      expect([...elf.subarray(0, 4)], arch).toEqual([0x7f, 0x45, 0x4c, 0x46]);
      expect(elf[4], arch).toBe(elfClass);
      expect(elf[18] | (elf[19] << 8), arch).toBe(machine);
    }
  });

  it('serves each folder as the installable one (design §2.1 step 4)', async () => {
    const qml = new Uint8Array(await (await client.get(`/device/${manifest.qml.path}`)).arrayBuffer());
    for (const arch of ['armv7', 'arm64']) {
      const archive = new Uint8Array(
        await (await client.get(`/device/${manifest.folder[arch].path}`)).arrayBuffer(),
      );
      const backend = new Uint8Array(
        await (await client.get(`/device/${manifest.backend[arch].path}`)).arrayBuffer(),
      );
      const entries = untar(new Uint8Array(gunzipSync(archive)));

      const folderManifest = JSON.parse(
        new TextDecoder().decode(entries.get('estante/manifest.json').data),
      );
      expect(folderManifest.id, arch).toBe('estante');
      expect(folderManifest.entry, arch).toBe('/Main.qml');
      expect(sha256(entries.get('estante/resources.rcc').data), arch).toBe(sha256(qml));
      expect(sha256(entries.get('estante/backend/entry').data), arch).toBe(sha256(backend));
    }
  });

  it('answers a missing device file with a 404, never the shell', async () => {
    const shell = await (await client.get('/')).text();
    const response = await client.get('/device/estante-reader-armv7.deadbeef');
    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    const body = await response.text();
    expect(body).not.toBe(shell);
    expect(body).not.toContain('<div id="root">');
  });
});
