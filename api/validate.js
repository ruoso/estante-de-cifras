// A thin validator over the Estante de Cifras API contract (`openapi.yaml`),
// for the app's (JavaScript) tests. The app and the service share no code
// (DIRECTION §3.6), so each side carries its own small validator over the one
// contract; the Go side is `validate.go`. "Small" is the bar: select the schema
// the contract names for an operation and direction, then validate with a
// standard JSON-Schema validator (Ajv, draft 2020-12 — which OpenAPI 3.1
// adopts). This file writes no endpoint and no client.

import { fileURLToPath } from 'node:url';

import { validate as validateDocument, dereference } from '@readme/openapi-parser';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// The contract ships beside this module, so consumers get it with the package.
export const CONTRACT_PATH = fileURLToPath(new URL('./openapi.yaml', import.meta.url));

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'];

// The directions a payload can be checked in: a request body, or a response at
// a given status.
export const REQUEST = 'request';
export const RESPONSE = 'response';

// Check that the contract document itself conforms to the OpenAPI 3.1
// specification (the note's "the contract document validates", JS side).
// Returns { valid, errors }.
export async function validateContract(contractPath = CONTRACT_PATH) {
  const result = await validateDocument(contractPath);
  return { valid: Boolean(result.valid), errors: result.errors ?? [] };
}

// Load and fully dereference the contract (every $ref inlined). Throws if a
// $ref cannot be resolved, which is itself part of what the contract-document
// test pins.
export async function loadContract(contractPath = CONTRACT_PATH) {
  return dereference(contractPath);
}

function findOperation(doc, operationId) {
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = item?.[method];
      if (op && op.operationId === operationId) {
        return { path, method, operation: op };
      }
    }
  }
  return null;
}

function selectSchema(operation, direction, status) {
  if (direction === REQUEST) {
    const schema = operation.requestBody?.content?.['application/json']?.schema;
    if (!schema) {
      throw new Error(`operation "${operation.operationId}" has no JSON request body to validate`);
    }
    return schema;
  }
  if (direction === RESPONSE) {
    if (status === undefined || status === null) {
      throw new Error(`a response status is required to validate the response of "${operation.operationId}"`);
    }
    const responses = operation.responses ?? {};
    const response = responses[String(status)] ?? responses.default;
    const schema = response?.content?.['application/json']?.schema;
    if (!schema) {
      throw new Error(
        `operation "${operation.operationId}" has no JSON response body at status ${status}`,
      );
    }
    return schema;
  }
  throw new Error(`unknown direction "${direction}" (expected "${REQUEST}" or "${RESPONSE}")`);
}

// Build a validator bound to the contract. The returned object exposes the
// dereferenced document and a `validate(operationId, direction, payload, opts)`
// that checks a payload against the schema the contract names for that
// operation and direction. Compiled schemas are cached per operation/direction.
export async function createValidator(contractPath = CONTRACT_PATH) {
  const doc = await dereference(contractPath);
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const compiled = new Map();

  function validate(operationId, direction, payload, { status } = {}) {
    const found = findOperation(doc, operationId);
    if (!found) {
      throw new Error(`no operation with operationId "${operationId}" in the contract`);
    }
    const key = `${operationId}\u0000${direction}\u0000${status ?? ''}`;
    let check = compiled.get(key);
    if (!check) {
      check = ajv.compile(selectSchema(found.operation, direction, status));
      compiled.set(key, check);
    }
    const valid = check(payload);
    return { valid, errors: valid ? [] : (check.errors ?? []) };
  }

  return { document: doc, validate };
}
