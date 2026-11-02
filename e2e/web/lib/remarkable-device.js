// A reMarkable stand-in (reader.pair_web Decision 5): the reader's side of
// pairing, spoken with Node's `fetch` and no browser — the precedent is
// git-device.js, a non-browser second device living in lib/. It makes the calls
// only a reader makes, never the web UI: `begin` (no session) shows a code,
// `poll` collects the session once the person has approved the code on the
// Pair a device page, and `readStatus` is a read-only GET carrying that session
// as its `estante_session` cookie (api/openapi.yaml beginDevicePairing,
// pollDevicePairing). The session and the poll token are never logged.

import { baseUrl } from './env.js';

export class RemarkableDevice {
  constructor() {
    this.code = null;
    this.pollToken = null;
    this.session = null;
  }

  // POST /api/devices/pair/begin, no session: the code the reader shows.
  async begin() {
    const resp = await fetch(`${baseUrl}/api/devices/pair/begin`, { method: 'POST' });
    if (resp.status !== 201) throw new Error(`pair/begin answered ${resp.status}`);
    const pairing = await resp.json();
    this.code = pairing.code;
    this.pollToken = pairing.pollToken;
    return this.code;
  }

  // POST /api/devices/pair/poll with the poll token: `pending`, `expired`, or —
  // once — `approved`, whose session the stand-in keeps. Returns the status.
  async poll() {
    const resp = await fetch(`${baseUrl}/api/devices/pair/poll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pollToken: this.pollToken }),
    });
    if (resp.status !== 200) throw new Error(`pair/poll answered ${resp.status}`);
    const body = await resp.json();
    if (body.status === 'approved' && body.session) this.session = body.session;
    return body.status;
  }

  // A read-only GET under the reader's session: 200 while it is paired, 401
  // once it has been signed out.
  async readStatus() {
    if (!this.session) throw new Error('the stand-in holds no session: poll after the approve');
    const resp = await fetch(`${baseUrl}/api/account/sessions`, {
      headers: { cookie: `estante_session=${this.session}` },
    });
    return resp.status;
  }

  // Whether the reader can still read: its session answers a read.
  async canRead() {
    return (await this.readStatus()) === 200;
  }
}
