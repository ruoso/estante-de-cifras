// The song screen's bar (reader.song_screen; workflow 19 §The screen, §A
// song; Song.dc.html L18–26): *Back* with its arrow, the title with the
// artist under it, and the key button — *C*, or *D (+2)* while transposed —
// absent for a song with no chords. 140 px, a 3 px rule under it. What it
// draws is replaced in one place, `show`, which bumps `revision`; the title
// never changes while a song is open — played from a setlist it reads *3 of
// 12 · Garota*, and changes with the song a turn reaches (reader.play).
import QtQuick
import "../chart/metrics.js" as M

Item {
    id: bar
    objectName: "bar"

    property var faces
    // The control waiting on the backend, by name (SongScreen's `pending`).
    property string pending: ""
    // { title, artist, keyLabel } — keyLabel "" for no key button.
    readonly property var content: d.content
    readonly property int revision: d.revision
    readonly property alias back: back
    readonly property alias keyButton: keyButton
    readonly property alias title: title
    readonly property alias artist: artist

    // The room kept at the right for the key button, as wide as it grows.
    readonly property int keyRoom: 300

    signal backTapped
    signal keyTapped

    function show(content) {
        d.content = content;
        d.revision += 1;
    }

    width: M.screenWidth
    height: M.barHeight

    QtObject {
        id: d
        property var content: ({ title: "", artist: "", keyLabel: "" })
        property int revision: 0
    }

    Rectangle {
        objectName: "barRule"
        x: 0
        y: M.barHeight - M.rule
        width: bar.width
        height: M.rule
        color: "black"
        antialiasing: false
    }

    InkButton {
        id: back
        objectName: "back"
        faces: bar.faces
        x: 40
        y: 18
        height: 100
        padding: 16
        bordered: false
        radius: 12
        arrow: "left"
        fontSize: 38
        text: "Back"
        onActivated: bar.backTapped()
    }

    Text {
        id: title
        objectName: "title"
        x: back.x + back.width + 32
        y: bar.content.artist ? 22 : Math.floor((M.barHeight - M.rule - height) / 2)
        // Up to the widest key button's place, whatever the key: choosing a
        // key never moves the title (rule 2).
        width: Math.max(0, bar.width - 40 - bar.keyRoom - 32 - x)
        height: 54
        color: "black"
        font.family: bar.faces ? bar.faces.ui : ""
        font.weight: Font.Bold
        font.pixelSize: 46
        elide: Text.ElideRight
        textFormat: Text.PlainText
        text: bar.content.title || ""
    }

    Text {
        id: artist
        objectName: "artist"
        visible: text !== ""
        x: title.x
        y: title.y + title.height + 2
        width: title.width
        height: 38
        color: "black"
        font.family: bar.faces ? bar.faces.ui : ""
        font.pixelSize: 30
        elide: Text.ElideRight
        textFormat: Text.PlainText
        text: bar.content.artist || ""
    }

    InkButton {
        id: keyButton
        objectName: "keyButton"
        faces: bar.faces
        visible: text !== ""
        active: visible
        x: bar.width - 40 - width
        y: 20
        height: 96
        padding: 36
        fontSize: 40
        text: bar.content.keyLabel || ""
        implicitWidth: Math.max(120, padding * 2 + Math.ceil(label.implicitWidth))
        onActivated: bar.keyTapped()
    }
}
