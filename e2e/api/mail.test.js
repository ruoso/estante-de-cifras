/**
 * e2e-api — the mail catcher's API answers, and the read helper works
 * end-to-end.
 *
 * Pins the mail-reading seam the emailed sign-in flow (workflow 13, DIRECTION
 * §3.3 lines 175–177) is tested through, and the .tji note's "the mail
 * catcher's API answers". No service component sends mail yet (sign-in is
 * downstream), so a purpose-written message is injected through Mailpit's send
 * API; the helper then finds it by recipient, extracts its link and clears the
 * mailbox — the exact path workflow 13's tests reuse. A unique recipient per
 * test keeps the ≤4-worker run collision-free.
 */
import { describe, it, expect } from 'vitest';

import {
  listMessages,
  waitForMessageTo,
  latestMessageTo,
  extractLink,
  clearMailbox,
  sendMessage,
} from './lib/mail.js';

function uniqueId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

describe('mail catcher', () => {
  it('lists messages as 200 JSON', async () => {
    const list = await listMessages();
    expect(Array.isArray(list.messages)).toBe(true);
    expect(typeof list.total).toBe('number');
  });

  it('finds an injected message by recipient, extracts its link, then clears it', async () => {
    const recipient = `signin-${uniqueId()}@estante.test`;
    const link = `https://estante.test/sign-in/${uniqueId()}`;

    await sendMessage({
      from: 'no-reply@estante.test',
      to: recipient,
      subject: 'Your sign-in link',
      text: `Welcome to Estante de Cifras.\n\nTap to sign in: ${link}\n`,
    });

    const message = await waitForMessageTo(recipient);
    expect(message, 'the injected message should be found by recipient').not.toBeNull();

    const found = extractLink(message, /https:\/\/estante\.test\/sign-in\/\S+/);
    expect(found).toBe(link);

    await clearMailbox();
    expect(await latestMessageTo(recipient)).toBeNull();
  });
});
