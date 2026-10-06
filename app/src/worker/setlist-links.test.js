// Unit — the pure setlist-link rewrite a move composes (books.file_view,
// workflow 14 L144-146; cifra.md spec §10.4-10.5, §10.10). Fixtures are
// purpose-written setlists, never anyone's words.
import { describe, it, expect } from 'vitest';
import { parseSetlist, writeSetlist } from 'cifra-md';
import { relinkSetlists } from './setlist-links.js';

// The folder-relative link destination of the one song item in a setlist text.
function itemDest(text) {
  const model = parseSetlist(text);
  const item = model.body.find((el) => el.type === 'song');
  return item?.path ?? null;
}

const ROOT_SET = ['# Sunday set', '', '1. [Valsa](valsa.cifra.md)', '2. [Outra](outra.cifra.md)', ''].join('\n');
const GIGS_SET = ['# Ensaio', '', '1. [Valsa](../valsa.cifra.md)', ''].join('\n');
const OTHER_SET = ['# Other', '', '1. [Outra](outra.cifra.md)', ''].join('\n');

describe('relinkSetlists', () => {
  it('rewrites the item that resolves to the moved song and leaves the rest untouched (workflow 14 L144-146)', () => {
    const changed = relinkSetlists({
      setlists: [
        { path: 'sunday.setlist.md', text: ROOT_SET },
        { path: 'other.setlist.md', text: OTHER_SET },
      ],
      fromPath: 'valsa.cifra.md',
      toPath: 'mpb/valsa-da-esquina.cifra.md',
    });
    // Only the referencing setlist is returned.
    expect(changed.map((s) => s.path)).toEqual(['sunday.setlist.md']);
    // The matched item points at the new path; the other item is unchanged.
    const model = parseSetlist(changed[0].text);
    const songs = model.body.filter((el) => el.type === 'song');
    expect(songs[0].path).toBe('mpb/valsa-da-esquina.cifra.md');
    expect(songs[1].path).toBe('outra.cifra.md');
    // Output is canonical (writeSetlist by construction, spec §10.9).
    expect(changed[0].text).toBe(writeSetlist(parseSetlist(changed[0].text)));
  });

  it('a setlist in another folder gets the correct ../descent path (spec §10.10)', () => {
    const changed = relinkSetlists({
      setlists: [{ path: 'gigs/ensaio.setlist.md', text: GIGS_SET }],
      fromPath: 'valsa.cifra.md',
      toPath: 'mpb/valsa-da-esquina.cifra.md',
    });
    expect(changed).toHaveLength(1);
    expect(itemDest(changed[0].text)).toBe('../mpb/valsa-da-esquina.cifra.md');
  });

  it('a move within the same folder changes only the file name', () => {
    const SAME = ['# Set', '', '1. [A](a.cifra.md)', ''].join('\n');
    const changed = relinkSetlists({
      setlists: [{ path: 'mpb/set.setlist.md', text: SAME }],
      fromPath: 'mpb/a.cifra.md',
      toPath: 'mpb/b.cifra.md',
    });
    expect(changed).toHaveLength(1);
    expect(itemDest(changed[0].text)).toBe('b.cifra.md');
  });

  it('a setlist that does not reference the song is not returned', () => {
    const changed = relinkSetlists({
      setlists: [{ path: 'other.setlist.md', text: OTHER_SET }],
      fromPath: 'valsa.cifra.md',
      toPath: 'mpb/valsa-da-esquina.cifra.md',
    });
    expect(changed).toEqual([]);
  });
});
