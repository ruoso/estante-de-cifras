// host-api.js — the version of the device bundle's host API
// (docs/remarkable-reader.md §4, §8). The reader's Go host reads it from the
// manifest and from `estante.hostApi`, and refuses a bundle it does not speak.
// It changes only when a call's shape does, and only once a payload is served
// (reader.payload); until then a new call joins version 1.

export const HOST_API = 1;
