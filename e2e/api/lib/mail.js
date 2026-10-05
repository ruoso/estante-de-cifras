import { mailUrl } from './env.js';

// The mail helper: reads the catcher (Mailpit) over its HTTP API — the seam
// the emailed sign-in link flow (workflow 13, DIRECTION §3.3 lines 175–177) is
// tested through (the e2e_api refinement, §What this task is #2). Mailpit
// exposes a read API (GET /api/v1/messages, /api/v1/message/{id}), a clear
// (DELETE /api/v1/messages) and a send (POST /api/v1/send). No service
// component sends mail yet (sign-in is downstream), so the send endpoint is how
// the harness exercises the reader end-to-end.

async function mailFetch(path, options = {}) {
  const response = await fetch(new URL(path, `${mailUrl}/`).toString(), options);
  if (!response.ok) {
    throw new Error(`Mailpit ${options.method ?? 'GET'} ${path} → ${response.status}`);
  }
  return response;
}

// Mailpit reports addresses as { Name, Address }; its send request takes
// { Email, Name }. Read whichever is present so helpers are symmetric.
function addressOf(addr) {
  return (addr?.Address ?? addr?.Email ?? '').toLowerCase();
}

// List messages: { total, unread, count, messages: [...] }, newest first.
export async function listMessages() {
  const response = await mailFetch('/api/v1/messages');
  return response.json();
}

// Fetch one message with its full body (Text, HTML).
export async function getMessage(id) {
  const response = await mailFetch(`/api/v1/message/${encodeURIComponent(id)}`);
  return response.json();
}

// The latest message addressed to `recipient`, with its full body, or null.
export async function latestMessageTo(recipient) {
  const { messages } = await listMessages();
  const target = recipient.toLowerCase();
  const summary = (messages ?? []).find((message) =>
    (message.To ?? []).some((addr) => addressOf(addr) === target),
  );
  return summary ? getMessage(summary.ID) : null;
}

// Poll for a message to `recipient` — mail travels Mailpit's SMTP→store path,
// so it may not be listed the instant send() returns.
export async function waitForMessageTo(recipient, { timeout = 5000, interval = 100 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const message = await latestMessageTo(recipient);
    if (message) return message;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// Extract the first URL (or first match of `pattern`) from a message body —
// how the sign-in link is pulled from the email.
export function extractLink(message, pattern = /https?:\/\/\S+/) {
  const body = `${message.Text ?? ''}\n${message.HTML ?? ''}`;
  const match = body.match(pattern);
  return match ? match[0] : null;
}

// Empty the mailbox.
export async function clearMailbox() {
  await mailFetch('/api/v1/messages', { method: 'DELETE' });
}

// Inject a message through Mailpit's send API (returns { ID }).
export async function sendMessage({ from, to, subject, text, html }) {
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ Email: email }));
  const body = { From: { Email: from }, To: recipients, Subject: subject };
  if (text != null) body.Text = text;
  if (html != null) body.HTML = html;
  const response = await mailFetch('/api/v1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}
