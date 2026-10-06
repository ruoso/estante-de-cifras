// Worker-thread environment shims, run before anything that pulls in
// isomorphic-git or lightning-fs. Both libraries assume a Node-shaped global
// that a Web Worker does not have, and the gaps only bite on the first git
// WRITE (creating a book: `git.init` + commit) — reads on a fresh device touch
// neither path — so OPEN and search have masked this until the shelf write path
// (books.shelf). The unit/behavior tests run in node, where both globals exist,
// so this file is a no-op there.
//
// 1. `Buffer`: isomorphic-git references a free `Buffer` global (Node provides
//    it; a Worker does not), throwing "Buffer is not defined" the first time it
//    builds a tree/commit object. The `buffer` package (already present — it is
//    isomorphic-git's own transitive dependency via readable-stream) is the
//    standard browser polyfill; assigning it onto `globalThis` is what makes
//    the free reference resolve. It reads no `global`, so importing it first is
//    safe even before the shim below.
//
// 2. `global`: `fast-text-encoding` (bundled by @isomorphic-git/lightning-fs)
//    initialises by assigning its polyfill onto `window`, else `global`, else
//    `undefined` — then throws "Cannot read properties of undefined (reading
//    'TextEncoder')" in a Worker, where neither exists. A Worker already has
//    `TextEncoder`/`TextDecoder` as real globals, so pointing `global` at
//    `globalThis` gives the polyfill a target and lets it no-op onto them.
//
// This must run before lightning-fs/isomorphic-git are imported, so it is the
// worker entry's first (side-effect) import — ESM evaluates imports in source
// order, depth-first, before the importer's body.
import { Buffer } from 'buffer';

globalThis.global ??= globalThis;
globalThis.Buffer ??= Buffer;
