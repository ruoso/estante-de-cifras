// A stand-in for AppLoad's library type (net.asivery.AppLoad 1.0), for the
// reader's QML tests only. The real one's surface the reader uses (rm-appload
// src/AppLibrary.h at v0.6.0): reloadList(), which reloads AppLoad's list of
// apps, giving each app a new resource prefix. Here it counts its calls in
// AppLoadLauncher's record, so a test reads the order of reload and launch.
import QtQml
import net.asivery.AppLoad 1.0

QtObject {
    function reloadList() {
        AppLoadLauncher.calls = AppLoadLauncher.calls.concat(["reloadList"]);
        return 1;
    }
}
