// The native WebAuthn JSON (de)serialisation seam (account.sign_in Decision 2).
// The service owns the WebAuthn shape (go-webauthn) and speaks standard JSON;
// the browser's own `PublicKeyCredential.parseCreationOptionsFromJSON` /
// `parseRequestOptionsFromJSON` and `credential.toJSON()` do the only app-side
// conversion needed — base64url ⇄ ArrayBuffer — so no runtime dependency is
// added ([[adding-npm-deps-needs-lockfile-and-network]]). Keeping it one module
// means a polyfill could be dropped in later without touching the client.
//
// Everything is read from `globalThis` at call time, so the behavior level can
// stand in a stubbed `navigator.credentials` and a stubbed `PublicKeyCredential`
// (jsdom provides neither), while the real browser and the e2e virtual
// authenticator use the platform's own.

// Register a credential (navigator.credentials.create). `optionsJSON` is the
// service's standard `PublicKeyCredentialCreationOptions` JSON. Returns the
// credential as JSON to echo to `finish`, plus the authenticator attachment the
// offer-a-passkey rule keys off (null when the platform does not report one).
export async function createCredential(optionsJSON) {
  const publicKey = globalThis.PublicKeyCredential.parseCreationOptionsFromJSON(optionsJSON);
  const credential = await globalThis.navigator.credentials.create({ publicKey });
  return {
    credential: credential.toJSON(),
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
  };
}

// Sign in with a credential (navigator.credentials.get). `optionsJSON` is the
// service's standard `PublicKeyCredentialRequestOptions` JSON.
export async function getCredential(optionsJSON) {
  const publicKey = globalThis.PublicKeyCredential.parseRequestOptionsFromJSON(optionsJSON);
  const credential = await globalThis.navigator.credentials.get({ publicKey });
  return {
    credential: credential.toJSON(),
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
  };
}

// The user dismissed the platform prompt (or it was aborted): the ceremony is
// cancelled, not failed, so the surface returns to the method step with no
// error shouted (Constraints: "cancelling the browser prompt … returns to the
// method step with no error").
export function isCancellation(error) {
  return error?.name === 'NotAllowedError' || error?.name === 'AbortError';
}
