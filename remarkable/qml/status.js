// The reader's one line of state (reader.app_folder), as a pure function of
// the backend's last `101 state` (docs/remarkable-reader.md §6), in workflow
// 19's own copy (§The shelf, the sync line; §Pairing, *Not paired*). Time is
// written as a time, device local, 24-hour (the refresh budget, rule 2).
// browse_screens moves this line onto the shelf and the Not paired page.
.pragma library

function hhmm(iso) {
    const t = new Date(iso);
    if (isNaN(t.getTime()))
        return "";
    const pad = (n) => (n < 10 ? "0" : "") + n;
    return pad(t.getHours()) + ":" + pad(t.getMinutes());
}

// statusLine(state) → the line to draw; "" before the first state.
function statusLine(state) {
    if (!state)
        return "";
    if (state.paired !== true)
        return "Not paired";
    if (state.syncing === true)
        return "Syncing…";
    const at = state.lastSync ? hhmm(state.lastSync) : "";
    if (state.error === "offline" && at !== "")
        return "Not connected — showing what was synced at " + at;
    if (at !== "")
        return "Synced at " + at;
    return "";
}
