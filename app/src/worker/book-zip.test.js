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
});
