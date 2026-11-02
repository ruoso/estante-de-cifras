// A stand-in for AppLoad's QML endpoint (net.asivery.AppLoad 1.0), for the
// reader's QML tests only (reader.qml_harness). run.py puts this module first
// on the import path, so a screen's own `import net.asivery.AppLoad 1.0`
// resolves here; the screen's QML is the shipped QML, unedited.
//
// The real surface, same names and signatures (rm-appload src/AppLoad.h at
// df974a6): applicationID, messageReceived(int, QString), sendMessage(int,
// QString), terminate(). Where the real Q_INVOKABLE would silently mangle an
// argument — a type that is not an integer, contents that are not a string
// (an object reaches the backend as "[object Object]") or not JSON (design §6:
// every payload is JSON) — this one throws, so the test fails where the device
// would misbehave.
//
// The test side: `sent` records every message the frontend sent ({ type,
// contents, payload }, payload the parsed JSON), messageSent is emitted for
// SignalSpy, `terminated` says terminate() was called, play(type, payload)
// delivers a backend message (an object is JSON.stringify'd), clear() forgets.
import QtQml

QtObject {
    id: endpoint

    // --- the real type's surface ---

    property string applicationID

    signal messageReceived(int type, string contents)

    function sendMessage(type, contents) {
        if (typeof type !== "number" || !Number.isInteger(type))
            throw new TypeError("AppLoad.sendMessage: type must be an integer, got "
                                + typeof type);
        if (typeof contents !== "string")
            throw new TypeError("AppLoad.sendMessage: contents must be a string "
                                + "(JSON.stringify the payload), got " + typeof contents);
        let payload;
        try {
            payload = JSON.parse(contents);
        } catch (e) {
            throw new TypeError("AppLoad.sendMessage: contents must be JSON (design §6)");
        }
        endpoint._log = endpoint._log.concat([{ type: type, contents: contents, payload: payload }]);
        endpoint.messageSent(type, contents);
    }

    function terminate() {
        endpoint.terminated = true;
    }

    // --- the test side ---

    property var _log: []
    readonly property var sent: _log
    property bool terminated: false

    signal messageSent(int type, string contents)

    function play(type, payload) {
        if (typeof type !== "number" || !Number.isInteger(type))
            throw new TypeError("AppLoad.play: type must be an integer, got " + typeof type);
        endpoint.messageReceived(type, typeof payload === "string" ? payload
                                                                  : JSON.stringify(payload));
    }

    function clear() {
        endpoint._log = [];
        endpoint.terminated = false;
    }
}
