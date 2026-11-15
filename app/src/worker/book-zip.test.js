// Unit — the ported zip writer/reader (books.online; workflow 7 L55-63). Pins
// the download format: a zip of binary entries round-trips (write then read),
// including a non-text (binary) entry, and `crc32` matches. Modelled on the
// explore-chords source this ports (explore-chords/src/state/zip.js), extended
// to the `{ name, bytes }` entries a git repo's `.git/objects` need (Decision 6).
import { describe, it, expect } from 'vitest';

import { createZip, readZip, crc32 } from './book-zip.js';

const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);

describe('book-zip (workflow 7 L55-63)', () => {
  it('round-trips a text entry and a binary entry (write then read)', async () => {
    // A README (text, encoded to bytes by the caller) and a git object's worth
    // of binary bytes that are NOT valid UTF-8 — the case the text-only
    // explore-chords writer could not carry.
    const binary = new Uint8Array([0x00, 0x01, 0xff, 0xfe, 0x80, 0x7f, 0x00, 0xde, 0xad]);
    const files = [
      { name: 'README.md', bytes: enc('# A book\n') },
      { name: '.git/objects/ab/cdef', bytes: binary },
    ];

    const blob = await createZip(files);
    expect(blob.size).toBeGreaterThan(0);
    const back = await readZip(await blob.arrayBuffer());

    expect(back.map((f) => f.name)).toEqual(['README.md', '.git/objects/ab/cdef']);
    expect(dec(back[0].bytes)).toBe('# A book\n');
    // The binary entry survives byte-for-byte — not mangled through UTF-8.
    expect(Array.from(back[1].bytes)).toEqual(Array.from(binary));
  });

  it('crc32 of a round-tripped entry matches the source bytes', async () => {
    const bytes = enc('coração — a song title with non-ASCII bytes\n');
    const blob = await createZip([{ name: 'song.cifra.md', bytes }]);
    const [entry] = await readZip(await blob.arrayBuffer());
    // The reader already verifies the stored CRC against the inflated bytes; an
    // explicit check pins that crc32 is deterministic over the round trip.
    expect(crc32(entry.bytes)).toBe(crc32(bytes));
  });

  it('rejects a buffer that is not a zip', async () => {
    await expect(readZip(enc('not a zip at all').buffer)).rejects.toThrow();
  });

  it('gives each entry bytes of its own, not a window onto the whole zip', async () => {
    // A window keeps the whole zip alive, and IndexedDB stores the whole buffer
    // under a view: a book's git objects (stored, not deflated) once each
    // carried a copy of the zip into storage.
    const blob = await createZip([
      { name: 'a.cifra.md', bytes: enc('# A\n') },
      { name: 'b.cifra.md', bytes: enc('# B\n') },
    ]);
    const entries = await readZip(await blob.arrayBuffer());
    for (const { bytes } of entries) {
      expect(bytes.byteOffset).toBe(0);
      expect(bytes.buffer.byteLength).toBe(bytes.byteLength);
    }
  });

  // Each refusal names the check that failed, so the upload screen can show it
  // as an error code (books.uploadErrorCode).
  describe('each refusal carries a code', () => {
    const zipBytes = async () => {
      const blob = await createZip([{ name: 'song.cifra.md', bytes: enc('# Partida\n') }]);
      return new Uint8Array(await blob.arrayBuffer());
    };

    it('not a zip at all: zip_not_a_zip', async () => {
      await expect(readZip(enc('not a zip at all').buffer)).rejects.toMatchObject({ name: 'ZipError', code: 'zip_not_a_zip' });
    });

    it('a directory that does not point at its entries: zip_unreadable', async () => {
      const bytes = await zipBytes();
      const view = new DataView(bytes.buffer);
      // Find the end record and point its directory offset at the middle of nowhere.
      let end = bytes.length - 22;
      while (view.getUint32(end, true) !== 0x06054b50) end -= 1;
      view.setUint32(end + 16, 1, true);
      await expect(readZip(bytes.buffer)).rejects.toMatchObject({ code: 'zip_unreadable' });
    });

    it('an entry that does not match its checksum: zip_entry_damaged', async () => {
      const bytes = await zipBytes();
      const view = new DataView(bytes.buffer);
      // Change the CRC the directory records for the entry: its bytes, stored or
      // deflated, no longer match it.
      let end = bytes.length - 22;
      while (view.getUint32(end, true) !== 0x06054b50) end -= 1;
      const central = view.getUint32(end + 16, true);
      view.setUint32(central + 16, view.getUint32(central + 16, true) ^ 0xffffffff, true);
      await expect(readZip(bytes.buffer)).rejects.toMatchObject({ code: 'zip_entry_damaged' });
    });
  });
});
