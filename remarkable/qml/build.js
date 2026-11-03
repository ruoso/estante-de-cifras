.pragma library
// The screens' build stamp (reader.app_folder; docs/remarkable-reader.md §8):
// tools/appfolder writes this file over in resources.rcc with a digest of the
// QML it compiles, and the same digest into the folder's manifest.json, which
// the backend reports in `101 state`. Main compares the two at its first state:
// different, these screens are a stale cache of xochitl's (AppLoad registers a
// new rcc under the URLs the engine already compiled), and Main reloads
// AppLoad's list and relaunches Estante. "" here, in the source, where nothing
// compares it (the tests, a desktop run).
var screens = "";
