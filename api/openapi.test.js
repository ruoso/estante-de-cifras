// unit — "the contract document validates" (JS side), per the api_contract
// refinement. Pins that api/openapi.yaml parses, conforms to OpenAPI 3.1, has
// every $ref resolvable, and gives every operation an operationId. This is the
// first test file in api/'s JS package, so the gate's api/ JS `test` branch
// goes live.

import { describe, it, expect } from 'vitest';

import { validateContract, loadContract } from './validate.js';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'];

// Walk the whole (dereferenced) document looking for a leftover `$ref`, which
// would mean a reference the parser could not resolve.
function findUnresolvedRef(node, path = '$') {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const hit = findUnresolvedRef(node[i], `${path}[${i}]`);
      if (hit) return hit;
    }
  } else if (node && typeof node === 'object') {
    if ('$ref' in node) return `${path}.$ref`;
    for (const [key, value] of Object.entries(node)) {
      const hit = findUnresolvedRef(value, `${path}.${key}`);
      if (hit) return hit;
    }
  }
  return null;
}

describe('api/openapi.yaml', () => {
  it('conforms to the OpenAPI 3.1 specification', async () => {
    const { valid, errors } = await validateContract();
    // Surface the first error if it fails, so the gate log says what broke.
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('declares OpenAPI 3.1', async () => {
    const doc = await loadContract();
    expect(doc.openapi).toMatch(/^3\.1\./);
  });

  it('resolves every $ref', async () => {
    // dereference() throws on an unresolvable ref; this also guards against a
    // ref that silently survives dereferencing.
    const doc = await loadContract();
    expect(findUnresolvedRef(doc)).toBeNull();
  });

  it('gives every operation an operationId, and they are unique', async () => {
    const doc = await loadContract();
    const ids = [];
    for (const [path, item] of Object.entries(doc.paths ?? {})) {
      for (const method of HTTP_METHODS) {
        const op = item?.[method];
        if (!op) continue;
        expect(op.operationId, `${method.toUpperCase()} ${path} is missing operationId`).toBeTruthy();
        ids.push(op.operationId);
      }
    }
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all five areas by tag', async () => {
    const doc = await loadContract();
    const tags = new Set();
    for (const item of Object.values(doc.paths ?? {})) {
      for (const method of HTTP_METHODS) {
        for (const tag of item?.[method]?.tags ?? []) tags.add(tag);
      }
    }
    for (const area of ['Sign-in', 'Books', 'Shelf', 'Sharing', 'Git']) {
      expect(tags.has(area), `no operation tagged "${area}"`).toBe(true);
    }
  });
});
