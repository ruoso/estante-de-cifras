// The locale root (shell.i18n): the one component that makes the app speak the
// user's language and change it live. It mirrors ThemeRoot — it reads the
// chosen language from the store's `preferences` slice (never IndexedDB from
// the view — DIRECTION §3.7 line 409), resolves it against the browser's
// languages, makes it the module's current locale and carries it on `<html lang>`.
//
// The policy is the pure `resolveLocale`; this is the only layer here that
// knows React (DIRECTION §3.7 lines 415-417). The chosen language is one
// `{ value, at }` register in the `preferences` map (home-book-format §4.1),
// exactly like the theme; until the producer (storage.preferences_surface)
// lands the slice is `{}` and the language is the browser's — the first-run
// behaviour Workflow 1 §Language calls for.
//
// Two React translations of Explore Chords' `applyLocale`:
//   - `setLocale(locale)` runs in render, so the first paint under the new key
//     is already in the right language (module state is global and idempotent
//     to set);
//   - `<html lang>` is written in an effect, because `<html>` lives outside the
//     React root at `#root` and a DOM write on an ancestor is an effect's job.
//
// Re-render on change is a keyed remount, not a locale context (Decision): every
// `t()` call site reads the module's `current` with no React dependency on the
// locale, so under the React Compiler (DIRECTION §3.7 line 412) a plain parent
// re-render would not reach those memoized children and would leave stale
// strings on screen. Keying the subtree by the resolved locale forces React to
// unmount and remount it, so every `t()` re-reads — the module header's promise
// that "everything on screen re-renders on that change." A language switch is
// rare (once, from a settings control), so the remount cost is acceptable.

import { Fragment, useEffect } from 'react';
import { useSlice } from '../worker/useStore.js';
import { resolveLocale, setLocale } from './index.js';

export default function LocaleRoot({ store, children }) {
  const preferences = useSlice(store, 'preferences');
  const locale = resolveLocale(preferences?.language?.value);

  // Make it current during render so children (which read module state through
  // t()) paint in the right language on their first render under the new key.
  setLocale(locale);

  // Carry the language on <html lang> so assistive tech announces in it,
  // updated the instant the chosen language changes.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // The keyed boundary: a changed locale remounts the whole subtree so every
  // t() re-reads, even for a child that takes no locale prop.
  return <Fragment key={locale}>{children}</Fragment>;
}
