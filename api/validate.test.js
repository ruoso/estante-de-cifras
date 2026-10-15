// unit — "the small helper … tested on a conforming and a non-conforming
// sample" (JS side), per the api_contract refinement. Pins that the JS helper
// passes a conforming sample and rejects a non-conforming one, with the schema
// errors, for representative operations: the create-book request and the
// change-check response.

import { describe, it, expect, beforeAll } from 'vitest';

import { createValidator, REQUEST, RESPONSE } from './validate.js';

let validator;

beforeAll(async () => {
  validator = await createValidator();
});

describe('createBook request', () => {
  it('passes a conforming request', () => {
    const result = validator.validate('createBook', REQUEST, { title: 'Choros para estudo' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects an empty title, and returns the schema errors', () => {
    const result = validator.validate('createBook', REQUEST, { title: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].keyword).toBe('minLength');
  });

  it('rejects a missing title', () => {
    const result = validator.validate('createBook', REQUEST, {});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === 'required')).toBe(true);
  });

  it('rejects an unknown property', () => {
    const result = validator.validate('createBook', REQUEST, { title: 'Ok', secret: 'x' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === 'additionalProperties')).toBe(true);
  });
});

describe('changeCheck 200 response', () => {
  it('passes a conforming response', () => {
    const payload = {
      books: [
        { bookId: 'bk_1', status: 'changed', head: 'a'.repeat(40) },
        { bookId: 'bk_2', status: 'gone' },
        { bookId: 'bk_3', status: 'unchanged', originalNewSaves: 3 },
      ],
    };
    const result = validator.validate('changeCheck', RESPONSE, payload, { status: 200 });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a bad status enum and a malformed head', () => {
    const payload = {
      books: [{ bookId: 'bk_1', status: 'moved', head: 'not-a-sha' }],
    };
    const result = validator.validate('changeCheck', RESPONSE, payload, { status: 200 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a top-level shape that is not the response envelope', () => {
    const result = validator.validate('changeCheck', RESPONSE, { changed: [] }, { status: 200 });
    expect(result.valid).toBe(false);
  });
});

// books.owner_name — the Book's optional ownerName (a member's view of who
// shares the book, workflow 10 §Leaving a book): present or absent, but a string.
describe('listBooks 200 response', () => {
  const book = (extra) => ({
    id: 'bk_1',
    title: 'Choros para estudo',
    role: 'reader',
    visibility: 'private',
    gitUrl: 'https://estante.example/git/bk_1.git',
    ...extra,
  });

  it('passes a Book with ownerName', () => {
    const result = validator.validate(
      'listBooks',
      RESPONSE,
      { books: [book({ ownerName: 'Ana Lima' })] },
      { status: 200 },
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes a Book without ownerName', () => {
    const result = validator.validate('listBooks', RESPONSE, { books: [book({ role: 'owner' })] }, { status: 200 });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a non-string ownerName', () => {
    const result = validator.validate('listBooks', RESPONSE, { books: [book({ ownerName: 42 })] }, { status: 200 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('the helper itself', () => {
  it('throws on an unknown operationId', () => {
    expect(() => validator.validate('nope', REQUEST, {})).toThrow(/operationId/);
  });

  it('requires a status for a response', () => {
    expect(() => validator.validate('createBook', RESPONSE, {})).toThrow(/status/);
  });
});
