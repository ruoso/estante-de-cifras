// Pairing (reader.browse_screens; workflow 19 §Pairing; Main.dc.html,
// Pair-code.dc.html): *Not paired* and the code page, one screen in two
// states. Two regions that change, each replaced in one place and counted in
// `revision`, and a foot that never does:
//
//   Not paired shown (`show`)            bar, content
//   the first `102` (`pairing`)          bar, content — the code page
//   another `102` on the code page       content
//   the code page's Back                 bar, content — Not paired, no message
//
// *Pair with your account* sends `5 pair {}` and the page stays, the button
// inverted, until a `102`; *Get a new code* the same on the code page. The
// code page draws the code, the address from its `url` and *This code works
// until 14:42*; `{ expired: true }` puts *That code has expired.* in the
// code's place, `{ offline: true }` the Wi-Fi sentence, each with *Get a new
// code*. Nothing on it changes by itself (rule 2).
import QtQuick
import "../song"
import "../chart"
import "../chart/metrics.js" as M
import "pages.js" as Pages

Item {
    id: screen
    objectName: "notPaired"

    property var endpoint: null
    readonly property Faces faces: Faces {}

    readonly property ListBar bar: listBar
    readonly property Region content: contentRegion
    readonly property ListFoot foot: listFoot
    // "notPaired", or the code page's "code", "expired", "offline".
    readonly property string mode: contentRegion.content.mode || "notPaired"
    // A `102` is drawn only while the code page is asked for or shown.
    readonly property bool accepts: d.asked || mode !== "notPaired"
    readonly property string pending: d.pending
    readonly property alias pairButton: pairButton
    readonly property alias newCodeButton: newCodeButton
    readonly property alias titleText: titleText
    readonly property alias introText: introText
    readonly property alias codeText: codeText
    readonly property alias untilText: untilText
    readonly property alias sentenceText: sentenceText

    width: M.screenWidth
    height: M.barHeight + M.contentHeight + M.footHeight

    // Not paired, from the start.
    function show() {
        d.asked = false;
        d.pending = "";
        listBar.show({ title: Pages.copy.appName, back: false, action: "" });
        contentRegion.show({ mode: "notPaired" });
    }

    // A `102 pairing`, when accepted.
    function pairing(p) {
        if (!screen.accepts || p === null || typeof p !== "object")
            return;
        let c;
        if (p.expired === true)
            c = { mode: "expired" };
        else if (p.offline === true)
            c = { mode: "offline" };
        else if (typeof p.code === "string" && p.code !== "")
            c = { mode: "code", code: p.code, address: Pages.address(p.url),
                  until: Pages.worksUntil(p.expiresAt) };
        else
            return;
        const fromStart = screen.mode === "notPaired";
        d.asked = false;
        d.pending = "";
        if (fromStart)
            listBar.show({ title: Pages.copy.pairTitle, back: true, action: "" });
        contentRegion.show(c);
    }

    QtObject {
        id: d
        property bool asked: false
        property string pending: ""

        function pair(name) {
            if (d.pending !== "")
                return;
            d.pending = name;
            d.asked = true;
            if (screen.endpoint)
                screen.endpoint.sendMessage(5, JSON.stringify({}));
        }
    }

    ListBar {
        id: listBar
        x: 0
        y: 0
        faces: screen.faces
        onBackTapped: screen.show()
    }

    Region {
        id: contentRegion
        objectName: "content"
        x: 0
        y: M.barHeight
        width: screen.width
        height: M.contentHeight
        content: ({ mode: "notPaired" })

        readonly property bool start: (content.mode || "notPaired") === "notPaired"
        readonly property bool code: content.mode === "code"
        readonly property int side: 140
        readonly property int textWidth: width - 2 * side

        // --- Not paired ---

        Text {
            id: titleText
            objectName: "notPairedTitle"
            visible: contentRegion.start
            x: contentRegion.side
            y: 220
            width: contentRegion.textWidth
            height: Math.ceil(contentHeight)
            color: "black"
            font.family: screen.faces.ui
            font.weight: Font.Bold
            font.pixelSize: 76
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: Pages.copy.notPairedTitle
        }

        Text {
            id: notPairedText
            objectName: "notPairedText"
            visible: contentRegion.start
            x: contentRegion.side
            y: titleText.y + titleText.height + 56
            width: 1060
            height: Math.ceil(contentHeight)
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 42
            lineHeight: 1.4
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: Pages.copy.notPairedText
        }

        InkButton {
            id: pairButton
            objectName: "pairButton"
            faces: screen.faces
            visible: contentRegion.start
            active: visible
            x: contentRegion.side
            y: notPairedText.y + notPairedText.height + 80
            height: 132
            padding: 64
            fontSize: 44
            text: Pages.copy.pair
            held: d.pending === "pair"
            onActivated: d.pair("pair")
        }

        // --- the code page ---

        Text {
            id: introText
            objectName: "pairIntro"
            visible: contentRegion.code
            x: contentRegion.side
            y: 200
            width: contentRegion.textWidth
            height: Math.ceil(contentHeight)
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 44
            lineHeight: 1.4
            wrapMode: Text.WordWrap
            textFormat: Text.StyledText
            // The address is the backend's; escaped before it is styled.
            text: "On your phone or computer, go to <b>"
                  + String(contentRegion.content.address || "").replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;").replace(/>/g, "&gt;")
                  + "</b> and enter:"
        }

        Rectangle {
            id: codeBox
            objectName: "codeBox"
            visible: contentRegion.code
            x: contentRegion.side
            y: introText.y + introText.height + 48
            width: Math.ceil(codeText.implicitWidth) + 2 * 72
            height: Math.ceil(codeText.implicitHeight) + 2 * 40
            radius: 16
            color: "white"
            border.color: "black"
            border.width: 4
            antialiasing: false

            Text {
                id: codeText
                objectName: "code"
                x: 72
                y: 40
                width: Math.ceil(implicitWidth)
                height: Math.ceil(implicitHeight)
                color: "black"
                font.family: screen.faces.mono
                font.variableAxes: ({ "wght": 700 })
                font.pixelSize: 150
                font.letterSpacing: 12
                textFormat: Text.PlainText
                text: contentRegion.content.code || ""
            }
        }

        Text {
            id: untilText
            objectName: "codeUntil"
            visible: contentRegion.code
            x: contentRegion.side
            y: codeBox.y + codeBox.height + 48
            width: contentRegion.textWidth
            height: Math.ceil(contentHeight)
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 40
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: contentRegion.content.until || ""
        }

        // In the code's place: the code expired, or no network.
        Text {
            id: sentenceText
            objectName: "pairSentence"
            visible: contentRegion.content.mode === "expired" || contentRegion.content.mode === "offline"
            x: contentRegion.side
            y: 200
            width: contentRegion.textWidth
            height: Math.ceil(contentHeight)
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 44
            lineHeight: 1.4
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: contentRegion.content.mode === "expired" ? Pages.copy.expired
                  : contentRegion.content.mode === "offline" ? Pages.copy.offline : ""
        }

        InkButton {
            id: newCodeButton
            objectName: "newCodeButton"
            faces: screen.faces
            visible: !contentRegion.start
            active: visible
            x: contentRegion.side
            y: contentRegion.code ? untilText.y + untilText.height + 88
                                  : sentenceText.y + sentenceText.height + 88
            height: 120
            padding: 56
            fontSize: 40
            text: Pages.copy.getNewCode
            held: d.pending === "newCode"
            onActivated: d.pair("newCode")
        }
    }

    ListFoot {
        id: listFoot
        x: 0
        y: M.barHeight + M.contentHeight
        faces: screen.faces
    }
}
