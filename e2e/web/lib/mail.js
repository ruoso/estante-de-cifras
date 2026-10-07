import { mailUrl } from './env.js';

// The Mailpit reader for the e2e-web harness: the emailed sign-in link journey
// (workflow 13, the WebAuthn fallback) reads the catcher over its HTTP API to
// pull the `/sign-in/<token>` link a user would open, then drives the browser
// to it. Mirrors e2e/api/lib/mail.js — the api and web harnesses share no code
// (DIRECTION §3.6 line 288), so the reader is re-stated here, lean, against the
// same Mailpit API. The devices.js header anticipated exactly this reader being
// added to this harness, reused by the first account journey, never a new one.

async function mailFetch(path, options = {}) {
  const response = await fetch(new URL(path, `${mailUrl()}/`).toString(), options);
  if (!response.ok) {
    throw new Error(`Mailpit ${options.method ?? 'GET'} ${path} → ${response.status}`);
  }
  return response;
}

// Mailpit reports addresses as { Name, Address }.
function addressOf(addr) {
  return (addr?.Address ?? '').toLowerCase();
}

// List messages, newest first: { total, unread, count, messages: [...] }.
async function listMessages() {
  const response = await mailFetch('/api/v1/messages');
  return response.json();
}

// Fetch one message with its full body (Text, HTML).
async function getMessage(id) {
  const response = await mailFetch(`/api/v1/message/${encodeURIComponent(id)}`);
  return response.json();
}

// The latest message addressed to `recipient`, with its full body, or null.
async function latestMessageTo(recipient) {
  const { messages } = await listMessages();
  const target = recipient.toLowerCase();
  const summary = (messages ?? []).find((message) =>
    (message.To ?? []).some((addr) => addressOf(addr) === target),
  );
  return summary ? getMessage(summary.ID) : null;
}

// Poll for a message to `recipient` — mail travels Mailpit's SMTP→store path,
// so it may not be listed the instant the service's request returns.
export async function waitForMessageTo(recipient, { timeout = 5000, interval = 100 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const message = await latestMessageTo(recipient);
    if (message) return message;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// Pull the first `/sign-in/<token>` URL from a message body — how the sign-in
// link is read from the email.
export function extractSignInLink(message) {
  const body = `${message.Text ?? ''}\n${message.HTML ?? ''}`;
  const match = body.match(/https?:\/\/\S*\/sign-in\/\S+/);
  if (!match) return null;
  return match[0].replace(/[\s"'<>]+$/, '');
}
