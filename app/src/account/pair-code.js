// The client-side shape check of a pairing code (reader.pair_web; workflow 13
// §The page L387–392): the field takes the code as it is typed — upper or lower
// case, with or without the dash or spaces — and only on the press is a code
// that is not six letters and numbers said to be malformed, with nothing sent.
//
// Pure (pinned by pair-code.test.js). It checks the shape the workflow states
// and nothing more: the code's alphabet (which leaves out look-alikes such as O,
// 0, 1, I and L) is the service's, which answers a look-alike as unknown
// (Decision 3) — the app and the service share no code, only the contract.

const SEPARATORS = /[\s-]+/g;
const SHAPE = /^[A-Za-z0-9]{6}$/;

// `{ ok: true, code }` with the code as typed (trimmed) — the service
// normalises it — or `{ ok: false }` when it is not six letters and numbers
// once spaces and dashes are left out.
export function checkPairCode(typed) {
  const code = typeof typed === 'string' ? typed.trim() : '';
  return SHAPE.test(code.replace(SEPARATORS, '')) ? { ok: true, code } : { ok: false };
}
