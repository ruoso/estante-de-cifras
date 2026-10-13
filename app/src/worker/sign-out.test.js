// Unit tests for the pure sign-out survey aggregation and the keep-as-local
// shelf-change computation (account.sign_out). Pins the survey shape and the
// put-online inverse against workflow 13 §Signing out
// (docs/workflows/13-new-device.md:82-88) and the mockup
// (docs/mockups/W13-new-device.dc.html:187-192).

import { describe, it, expect } from 'vitest';
import { aggregateSignOutSurvey, keepAsLocalChanges, removeChanges } from './sign-out.js';

describe('aggregateSignOutSurvey', () => {
  it('lists an on-Estante book with unsaved songs under "not yet on Estante"', () => {
    const { notYetOnEstante, downloadGuard } = aggregateSignOutSurvey([
      { id: 'b1', title: 'Banda do Bairro', kind: 'shared', role: 'owner', savesWaiting: 0, unsavedSongs: 2, onEstante: true },
    ]);
    expect(notYetOnEstante).toEqual([
      { id: 'b1', title: 'Banda do Bairro', unsavedSongs: 2, savesWaiting: 0 },
    ]);
    expect(downloadGuard).toEqual([]);
  });

  it('lists an on-Estante book with unpushed saves under "not yet on Estante"', () => {
    const { notYetOnEstante, downloadGuard } = aggregateSignOutSurvey([
      { id: 'b2', title: 'Valsas', kind: 'shared', role: 'owner', savesWaiting: 1, unsavedSongs: 0, onEstante: true },
    ]);
    expect(notYetOnEstante).toEqual([
      { id: 'b2', title: 'Valsas', unsavedSongs: 0, savesWaiting: 1 },
    ]);
    expect(downloadGuard).toEqual([]);
  });

  it('guards a purely-local book for download, never under "not yet on Estante"', () => {
    // Even if a local book has local commits, it belongs to the download guard
    // ("only on this computer", mockup line 192) — not the on-Estante warning.
    const { notYetOnEstante, downloadGuard } = aggregateSignOutSurvey([
      { id: 'b3', title: 'Rascunhos', kind: 'local', role: null, savesWaiting: 3, unsavedSongs: 1, onEstante: false },
    ]);
    expect(notYetOnEstante).toEqual([]);
    expect(downloadGuard).toEqual([{ id: 'b3', title: 'Rascunhos' }]);
  });

  it('guards a shared book whose content is not yet on Estante for download', () => {
    const { notYetOnEstante, downloadGuard } = aggregateSignOutSurvey([
      { id: 'b4', title: 'Not pushed', kind: 'shared', role: 'owner', savesWaiting: 0, unsavedSongs: 0, onEstante: false },
    ]);
    expect(notYetOnEstante).toEqual([]);
    expect(downloadGuard).toEqual([{ id: 'b4', title: 'Not pushed' }]);
  });

  it('omits an on-Estante book with nothing local from both groups', () => {
    const { notYetOnEstante, downloadGuard } = aggregateSignOutSurvey([
      { id: 'b5', title: 'In step', kind: 'shared', role: 'reader', savesWaiting: 0, unsavedSongs: 0, onEstante: true },
    ]);
    expect(notYetOnEstante).toEqual([]);
    expect(downloadGuard).toEqual([]);
  });

  it('aggregates the mockup set (W13-new-device.dc.html:187-192)', () => {
    const { notYetOnEstante, downloadGuard } = aggregateSignOutSurvey([
      { id: 'banda', title: 'Banda do Bairro', kind: 'shared', role: 'owner', savesWaiting: 0, unsavedSongs: 2, onEstante: true },
      { id: 'valsas', title: 'Valsas', kind: 'shared', role: 'owner', savesWaiting: 1, unsavedSongs: 0, onEstante: true },
      { id: 'rascunhos', title: 'Rascunhos', kind: 'local', role: null, savesWaiting: 0, unsavedSongs: 0, onEstante: false },
    ]);
    expect(notYetOnEstante).toEqual([
      { id: 'banda', title: 'Banda do Bairro', unsavedSongs: 2, savesWaiting: 0 },
      { id: 'valsas', title: 'Valsas', unsavedSongs: 0, savesWaiting: 1 },
    ]);
    expect(downloadGuard).toEqual([{ id: 'rascunhos', title: 'Rascunhos' }]);
  });

  it('is empty for no books', () => {
    expect(aggregateSignOutSurvey([])).toEqual({ notYetOnEstante: [], downloadGuard: [] });
    expect(aggregateSignOutSurvey()).toEqual({ notYetOnEstante: [], downloadGuard: [] });
  });
});

describe('keepAsLocalChanges — the put-online inverse', () => {
  it('tombstones the hosted register and writes the local register', () => {
    expect(
      keepAsLocalChanges({ bookId: 'srv-1', deviceId: 'dev-A', label: 'Banda do Bairro', position: 2 }),
    ).toEqual([
      { path: ['books', 'srv-1', 'label'], value: null },
      { path: ['books', 'srv-1', 'link'], value: null },
      { path: ['books', 'srv-1', 'position'], value: null },
      { path: ['books', 'srv-1', 'role'], value: null },
      { path: ['local', 'dev-A', 'srv-1', 'title'], value: 'Banda do Bairro' },
      { path: ['local', 'dev-A', 'srv-1', 'position'], value: 2 },
    ]);
  });

  it('is the mirror of the put-online migration it inverts', () => {
    // Put-online writes books/{id}.{label,link,position,role} and tombstones
    // local/{deviceId}/{id}.{title,position} (logic.js:1506-1518). Keep-as-local
    // tombstones exactly the hosted keys it set and restores the local keys.
    const changes = keepAsLocalChanges({ bookId: 'srv-1', deviceId: 'dev-A', label: 'X', position: 5 });
    const hosted = changes.filter((c) => c.path[0] === 'books');
    expect(hosted.every((c) => c.value === null)).toBe(true);
    expect(hosted.map((c) => c.path[2])).toEqual(['label', 'link', 'position', 'role']);
    const local = changes.filter((c) => c.path[0] === 'local');
    expect(local.map((c) => c.path[3])).toEqual(['title', 'position']);
  });

  it('carries a null label/position through unchanged', () => {
    expect(keepAsLocalChanges({ bookId: 'b', deviceId: 'd' })).toEqual([
      { path: ['books', 'b', 'label'], value: null },
      { path: ['books', 'b', 'link'], value: null },
      { path: ['books', 'b', 'position'], value: null },
      { path: ['books', 'b', 'role'], value: null },
      { path: ['local', 'd', 'b', 'title'], value: null },
      { path: ['local', 'd', 'b', 'position'], value: null },
    ]);
  });
});

describe('removeChanges', () => {
  it('tombstones a hosted book’s register (label/link/position/role)', () => {
    expect(removeChanges({ bookId: 'srv-1', deviceId: 'dev-A', kind: 'shared' })).toEqual([
      { path: ['books', 'srv-1', 'label'], value: null },
      { path: ['books', 'srv-1', 'link'], value: null },
      { path: ['books', 'srv-1', 'position'], value: null },
      { path: ['books', 'srv-1', 'role'], value: null },
    ]);
  });

  it('tombstones a local book’s register (title/position) in the device namespace', () => {
    expect(removeChanges({ bookId: 'loc-1', deviceId: 'dev-A', kind: 'local' })).toEqual([
      { path: ['local', 'dev-A', 'loc-1', 'title'], value: null },
      { path: ['local', 'dev-A', 'loc-1', 'position'], value: null },
    ]);
  });
});
