import { encode as cborEncode } from 'cbor2';

/**
 * A software WebAuthn authenticator for the e2e-api harness: it plays the role
 * a platform authenticator and the browser would, turning the service's
 * begin-ceremony options into the attestation/assertion JSON the finish
 * endpoint forwards to go-webauthn. There is no off-the-shelf standalone
 * authenticator for Node, so this is a small purpose-built helper on Node
 * WebCrypto plus a CBOR encoder (service.passkeys Decision 10) — like the
 * Mailpit reader before it, not a parallel harness.
 *
 * It supports exactly what the passkeys task needs over HTTP: ES256 (the
 * WebAuthn default), `none` attestation, discoverable (resident) credentials,
 * and an advancing signature counter. It is black-box: it sees only the JSON
 * options the API returns, exactly as a device would.
 */

const b64url = {
  encode(bytes) {
    return Buffer.from(bytes).toString('base64url');
  },
  decode(str) {
    return new Uint8Array(Buffer.from(str, 'base64url'));
  },
};

// WebAuthn authenticator-data flags (§6.1).
const FLAG_UP = 0x01; // user present
const FLAG_UV = 0x04; // user verified
const FLAG_AT = 0x40; // attested credential data present

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

function concat(...chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function uint16(n) {
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
}

function uint32(n) {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

// WebCrypto ECDSA produces an IEEE P1363 (r||s) signature; go-webauthn's EC2
// verifier expects ASN.1 DER, so convert. r and s are 32 bytes each.
function p1363ToDer(raw) {
  const r = raw.slice(0, 32);
  const s = raw.slice(32, 64);
  const enc = (v) => {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    let b = v.slice(i);
    if (b[0] & 0x80) b = concat(new Uint8Array([0]), b); // keep it positive
    return concat(new Uint8Array([0x02, b.length]), b);
  };
  const body = concat(enc(r), enc(s));
  return concat(new Uint8Array([0x30, body.length]), body);
}

// A resident credential the authenticator holds: its id, key pair, user handle
// and the relying-party id it belongs to, plus its advancing counter.
class Credential {
  constructor(id, keyPair, userHandle, rpId) {
    this.id = id;
    this.keyPair = keyPair;
    this.userHandle = userHandle;
    this.rpId = rpId;
    this.signCount = 0;
  }
}

export class Authenticator {
  /** @param {string} origin the ceremony origin written into clientDataJSON. */
  constructor(origin) {
    this.origin = origin;
    this.creds = [];
  }

  // create() plays navigator.credentials.create(): it mints an ES256 resident
  // credential and returns the registration response JSON for register/finish.
  async create(publicKey) {
    const rpId = publicKey.rp.id;
    const userHandle = b64url.decode(publicKey.user.id);

    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const credId = crypto.getRandomValues(new Uint8Array(20));
    const cred = new Credential(credId, keyPair, userHandle, rpId);

    const clientDataJSON = this.#clientData('webauthn.create', publicKey.challenge);
    const authData = concat(
      await sha256(new TextEncoder().encode(rpId)),
      new Uint8Array([FLAG_UP | FLAG_UV | FLAG_AT]),
      uint32(0), // signature counter starts at zero
      new Uint8Array(16), // all-zero AAGUID: no device fingerprint
      uint16(credId.length),
      credId,
      await this.#cosePublicKey(keyPair.publicKey),
    );
    const attestationObject = cborEncode(
      new Map([
        ['fmt', 'none'],
        ['attStmt', new Map()],
        ['authData', authData],
      ]),
    );

    this.creds.push(cred);
    return {
      id: b64url.encode(credId),
      rawId: b64url.encode(credId),
      type: 'public-key',
      response: {
        clientDataJSON: b64url.encode(clientDataJSON),
        attestationObject: b64url.encode(new Uint8Array(attestationObject)),
      },
      clientExtensionResults: {},
      authenticatorAttachment: 'platform',
    };
  }

  // get() plays navigator.credentials.get(): it finds a resident credential for
  // the relying party, advances its counter, signs the assertion, and returns
  // the response JSON for authenticate/finish.
  async get(publicKey) {
    const cred = this.creds.find((c) => c.rpId === publicKey.rpId);
    if (!cred) throw new Error(`no resident credential for rpId ${publicKey.rpId}`);

    const clientDataJSON = this.#clientData('webauthn.get', publicKey.challenge);
    cred.signCount += 1;
    const authData = concat(
      await sha256(new TextEncoder().encode(cred.rpId)),
      new Uint8Array([FLAG_UP | FLAG_UV]),
      uint32(cred.signCount),
    );
    const clientDataHash = await sha256(clientDataJSON);
    const signed = concat(authData, clientDataHash);
    const raw = new Uint8Array(
      await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cred.keyPair.privateKey, signed),
    );

    return {
      id: b64url.encode(cred.id),
      rawId: b64url.encode(cred.id),
      type: 'public-key',
      response: {
        clientDataJSON: b64url.encode(clientDataJSON),
        authenticatorData: b64url.encode(authData),
        signature: b64url.encode(p1363ToDer(raw)),
        userHandle: b64url.encode(cred.userHandle),
      },
      clientExtensionResults: {},
    };
  }

  // #clientData builds the JSON the client collects and the authenticator signs
  // over. crossOrigin is always false (one origin, DIRECTION §3.3). The
  // challenge is echoed verbatim so it matches the server's stored challenge.
  #clientData(type, challenge) {
    return new TextEncoder().encode(
      JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false }),
    );
  }

  // #cosePublicKey CBOR-encodes an ES256 EC2 public key in COSE_Key form (the
  // integer-keyed map go-webauthn's parser expects).
  async #cosePublicKey(publicKey) {
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    const x = b64url.decode(jwk.x);
    const y = b64url.decode(jwk.y);
    const key = new Map([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, x],
      [-3, y],
    ]);
    return new Uint8Array(cborEncode(key));
  }
}
