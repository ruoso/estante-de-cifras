// download-zip.js — saving a Worker-produced book zip as a file, shared by the
// book detail's Download (books.online) and the sign-out dialog's download guard
// (account.sign_out). The Worker owns the zip bytes (DOWNLOAD_BOOK → BOOK_DOWNLOAD,
// remote stripped); this is the one view-side act — turning those bytes into a
// file the browser saves (workflow 7 L63). No git, no IndexedDB, no song text in
// the filename.

// A filename-safe slug for the downloaded zip — ASCII letters, digits and
// dashes, from the book's title; a title that reduces to nothing falls back to a
// neutral word (never a book id or song text in the name).
export function slugFor(title) {
  const slug = String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'book';
}

// Save a zip the Worker produced as a file (workflow 7 L63: "the browser saves
// the file"). Guarded so a test environment without `URL.createObjectURL` does
// not throw — the download is exercised end to end in e2e-web.
export function saveZip(title, bytes) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugFor(title)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
