// "Offer a passkey on this device" — the pure predicate (account.sign_in
// Decision 5; workflow 13 lines 23-24). After a sign-in that did not leave a
// passkey resident on this device, the surface offers to register one, so next
// time is the same-ecosystem "Use a passkey" case.
//
// That is: after every emailed-link redeem, and after a passkey assertion whose
// `authenticatorAttachment` is `cross-platform` or absent (the cross-device /
// another-ecosystem case). It is skipped when the assertion is `platform` — the
// passkey already lives here — and after a registration, which just created one
// here. `authenticatorAttachment` is the standard, test-observable signal on the
// `PublicKeyCredential`, so no server round-trip is needed (Decision 5).
//
// Pure, DOM-free (pinned by offer-passkey.test.js).
export function shouldOfferPasskey({ method, authenticatorAttachment } = {}) {
  if (method === 'redeem') return true;
  if (method === 'authenticate') return authenticatorAttachment !== 'platform';
  return false;
}
