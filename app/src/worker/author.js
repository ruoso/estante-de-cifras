// author.js — the commit identity (storage.working_copy). DIRECTION §3.2
// L164-170: "Commits are authored with a per-user no-reply address,
// `<user-id>@users.estantedecifras.app`, never the user's real email."; and
// "before sign-in, a device's commits carry a local id in its place, which the
// account's address replaces in the saves not yet pushed when the user signs
// in."
//
// This module owns the mapping from an `id` to the no-reply address, and the
// isomorphic-git `author`/`committer` shape built from it. The `id` it is handed
// is either the account user-id or the device local id; it forms the address the
// same way for both, so the save path never has to care which.
//
// It also holds the ONE author resolver every commit path goes through
// (account.commit_author Constraint 2): `{ id: meta.accountId ??
// meta.localAuthorId, name }`. The resolver does no I/O of its own — the `meta`
// record and the home book's display name are read through accessors logic.js
// injects (storage.home_book Decision 7: device state lives on `meta`).
//
// No logging, no song text, no real email (standing rules). Plain ESM,
// Worker-only; the main thread and the view never import it.

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

/**
 * The one author resolver (account.commit_author Constraint 2). Every commit the
 * Worker makes takes its identity from `resolveAuthor()`:
 * `{ id: meta.accountId ?? meta.localAuthorId, name: authorName ?? 'Me' }`.
 *
 * The local author id is per device and distinct from the §2.3 device id
 * (storage/home_book Decision 6): a random id made on first need and kept as
 * `meta.localAuthorId`; the literal `local` is never written.
 *
 * - `readMeta()` resolves the `meta` record (`{}` when absent);
 * - `writeMeta(fields)` merges fields into it;
 * - `readName()` resolves the home book's display name, or null;
 * - `randomId()` mints an id (defaults to `crypto.randomUUID`).
 *
 * @param {{ readMeta: () => Promise<object>, writeMeta: (fields: object) => Promise<void>,
 *   readName?: () => Promise<string|null>, randomId?: () => string }} deps
 */
export function createAuthorResolver({
  readMeta,
  writeMeta,
  readName = async () => null,
  randomId = () => crypto.randomUUID(),
}) {
  let minting = null;

  // This device's local author id, made once: concurrent callers share the one
  // mint, so no two commits ever carry two different fresh ids.
  async function localAuthorId(meta) {
    if (!meta) meta = await readMeta();
    if (meta.localAuthorId) return meta.localAuthorId;
    if (!minting) {
      minting = (async () => {
        let id = randomId();
        while (id === 'local' || id === meta.deviceId) id = randomId();
        await writeMeta({ localAuthorId: id });
        return id;
      })();
      minting.catch(() => {
        minting = null;
      });
    }
    return minting;
  }

  /**
   * The identity a commit is authored with. `name` overrides the stored display
   * name — the save sheet's typed name, which may not be stored yet.
   *
   * @param {{ name?: string }} [override]
   * @returns {Promise<{ id: string, name: string }>}
   */
  async function resolveAuthor({ name } = {}) {
    const meta = await readMeta();
    const id = meta.accountId ?? (await localAuthorId(meta));
    const typed = typeof name === 'string' ? name.trim() : '';
    return { id, name: typed || (await readName()) || 'Me' };
  }

  // This device's local addresses (Constraint 3): the local author id's and the
  // legacy `<deviceId>@` the sync identity wrote before this task. Never the
  // shared `local@`, which every device wrote (Decision 2).
  async function localAddresses() {
    const meta = await readMeta();
    return [meta.localAuthorId, meta.deviceId].filter(Boolean).map(noReplyAddress);
  }

  // Every address that is this device's user: the account's, if signed in, and
  // the local ones (history's *you*, Decision 7).
  async function ownAddresses() {
    const meta = await readMeta();
    const local = await localAddresses();
    return meta.accountId ? [noReplyAddress(meta.accountId), ...local] : local;
  }

  return { resolveAuthor, localAuthorId, localAddresses, ownAddresses };
}
