// author.js — the commit identity (storage.working_copy). DIRECTION §3.2
// L164-170: "Commits are authored with a per-user no-reply address,
// `<user-id>@users.estantedecifras.app`, never the user's real email."; and
// "before sign-in, a device's commits carry a local id in its place, which the
// account's address replaces in the saves not yet pushed when the user signs
// in."
//
// This module owns ONE mapping: an `id` -> the no-reply address, and the
// isomorphic-git `author`/`committer` shape built from it. It does not generate
// the local id, store the display name, or know about sign-in — those belong to
// the home book and the account flow (storage.home_book; Decision 7). The `id`
// it is handed is either the account user-id or the device local id; it forms
// the address the same way for both, so the save path never has to care which.
//
// Pure: no I/O, no logging, no song text, no real email (standing rules). Plain
// ESM, Worker-only; the main thread and the view never import it.

// The root domain the app is served from (DIRECTION §3.2 L160). The `users.`
// sub-domain namespaces the per-user no-reply addresses so they can never
// collide with a real mailbox at the apex.
const NO_REPLY_DOMAIN = 'users.estantedecifras.app';

/**
 * The per-user no-reply address for an identity `id` — the account user-id, or
 * the device local id before sign-in (DIRECTION §3.2 L164-170). Never the user's
 * real email: the address is derived purely from the opaque id.
 *
 * @param {string} id
 * @returns {string}
 */
export function noReplyAddress(id) {
  return `${id}@${NO_REPLY_DOMAIN}`;
}

/**
 * Build the isomorphic-git `author`/`committer` object for a save. `name` is
 * the display name the home book keeps (asked once — workflow 4 L67-72); `id`
 * is the identity the address is formed from. `now` is injected so a test can
 * pin the timestamp; it defaults to the wall clock.
 *
 * The timestamp is whole seconds since the epoch and the timezone offset is in
 * minutes, matching isomorphic-git's commit author contract.
 *
 * @param {{ id: string, name: string }} identity
 * @param {number} [now] milliseconds since the epoch
 * @returns {{ name: string, email: string, timestamp: number, timezoneOffset: number }}
 */
export function authorFrom({ id, name }, now = Date.now()) {
  return {
    name,
    email: noReplyAddress(id),
    timestamp: Math.floor(now / 1000),
    timezoneOffset: new Date(now).getTimezoneOffset(),
  };
}
