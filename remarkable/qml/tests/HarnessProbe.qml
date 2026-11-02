// The harness test's fixture (reader.qml_harness): a small component written
// as a screen will be, against the real AppLoad type's surface. It says hello
// when it attaches and draws whether the reader is paired from the backend's
// state (design §6: 1 hello, 101 state), ignoring a type or a field it does
// not know.
import QtQuick
import net.asivery.AppLoad 1.0

Item {
    id: probe
    width: 400
    height: 100

    property alias endpoint: backend
    property alias label: pairedText
    readonly property int graphicsApi: GraphicsInfo.api

    property bool paired: false

    AppLoad {
        id: backend
        applicationID: "estante-reader"
        onMessageReceived: (type, contents) => {
            if (type !== 101)
                return;
            const state = JSON.parse(contents);
            probe.paired = state.paired === true;
        }
    }

    Text {
        id: pairedText
        text: probe.paired ? "Paired" : "Not paired"
    }

    Component.onCompleted: backend.sendMessage(1, JSON.stringify({}))
}
