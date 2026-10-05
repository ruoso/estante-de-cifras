// Two "devices" is two isolated browser contexts — two cookie jars, two
// independent sessions — the seam the sharing and new-device journeys
// (workflows 10, 13; DIRECTION §3.3 lines 175–176, books for members only, up
// to fifty per book) bind an account to each. At this foundation stage there is
// no sign-in surface, so the helper delivers the context isolation; the
// Mailpit-driven sign-in step is added by the first `account` e2e-web journey,
// reusing this harness, never a new one (the e2e_web refinement, Decisions).

// Open a second isolated device: a fresh browser context and a page in it. The
// caller closes the context when done — `await device.context.close()`.
export async function openDevice(browser, options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  return { context, page };
}
