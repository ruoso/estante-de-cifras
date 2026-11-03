// A stand-in for AppLoad's launcher singleton (net.asivery.AppLoad 1.0), for
// the reader's QML tests only. The real one's surface (rm-appload
// src/Launcher.h at v0.6.0): launchApplication(id, args, env, window). Here
// `calls` records each call in order (with AppLoadLibrary's reloadList), and
// clear() forgets.
pragma Singleton
import QtQml

QtObject {
    property var calls: []

    function launchApplication(id, args, env, windowed) {
        if (typeof id !== "string")
            throw new TypeError("launchApplication: the id must be a string");
        calls = calls.concat(["launch:" + id + ":" + (windowed === true)]);
    }

    function clear() {
        calls = [];
    }
}
