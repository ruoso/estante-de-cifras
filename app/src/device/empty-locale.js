// empty-locale.js — what the device build resolves every locale but English to
// (docs/remarkable-reader.md §4: one locale, not four). An empty message table
// makes `t` fall back to English, as it does for any key a language lacks, so
// i18n/index.js keeps one shape for both builds.

export default {};
