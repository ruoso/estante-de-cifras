// host-api.js — the version of the device bundle's host API
// (docs/remarkable-reader.md §4, §8). The reader's Go host reads it from the
// manifest and from `estante.hostApi`, and refuses a bundle it does not speak.
// It changes only when a call's shape does, and only once a payload is served
// (reader.payload); until then a new call joins version 1.
//
// 2: `instrument(files, { instrumentId })` reads with the instrument chosen
// on the reader and lists the account's instruments; `sheet` lists the song's
// variations for the tuning and names the one read. The QML served beside it
// sends `12 instrument` and `13 variation`, which a backend of version 1
// cannot read — so it fetches neither and says *Update the reader*.

export const HOST_API = 2;
