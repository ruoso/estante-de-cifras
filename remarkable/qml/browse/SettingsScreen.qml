// Settings (reader.browse_screens; workflow 19 §The shelf, Settings, as
// amended; Settings.dc.html). Bar: Back (to the shelf) · *Settings*. Then, in
// this order: Account (*Paired with* the account), Sync (the shelf's sync
// line as it was when the page opened — it does not change here, rule 5),
// Shapes (the count hidden, with **Show all again**, or *No shapes hidden.*),
// This reader (*Version 0.1.0*), and **Sign out**, which asks once: pressed,
// the question replaces it with **Sign out** and **Cancel**. Four regions,
// each replaced in one place and counted in `revision`:
//
//   the page opened (`show`)            bar, content, shapes, sign-out part
//   Show all again answered (`showShapes`)  shapes
//   Sign out asked / Cancel             the sign-out part
//
// `content` holds Account, Sync and This reader; Shapes sits between them in
// a region of its own.
import QtQuick
import "../song"
import "../chart"
import "../chart/metrics.js" as M
import "../status.js" as Status
import "pages.js" as Pages

Item {
    id: screen
    objectName: "settingsScreen"

    property var endpoint: null
    readonly property Faces faces: Faces {}

    readonly property ListBar bar: listBar
    readonly property Region content: contentRegion
    readonly property Region shapes: shapesRegion
    readonly property Region signOut: signOutRegion
    readonly property alias accountPart: accountPart
    readonly property alias syncPart: syncPart
    readonly property alias readerPart: readerPart
    readonly property Text shapesText: shapesPart.valueText
    readonly property alias showAllButton: showAllButton
    readonly property alias signOutButton: signOutButton
    readonly property alias questionText: questionText
    readonly property alias confirmButton: confirmButton
    readonly property alias cancelButton: cancelButton
    readonly property string pending: d.pending
    // Sign out confirmed: the device signs out (Main shows Not paired when
    // the state says so).
    signal signedOut

    width: M.screenWidth
    height: M.barHeight + M.contentHeight + M.footHeight

    readonly property int partHeight: 160

    // A `107 settings`, and the state the shelf's sync line is read from.
    function show(settings, state) {
        d.pending = "";
        listBar.show({ title: Pages.copy.settings, back: true, action: "" });
        contentRegion.show({
            account: Pages.pairedWith(settings && settings.account),
            sync: Status.statusLine(state),
            version: Pages.versionLine(settings && settings.version)
        });
        shapesRegion.show({ hidden: Number(settings && settings.hiddenShapes) || 0 });
        signOutRegion.show({ asking: false });
    }

    // A `107` while the page is shown — Show all again answered: the Shapes
    // line only.
    function showShapes(settings) {
        if (d.pending === "showAll")
            d.pending = "";
        shapesRegion.show({ hidden: Number(settings && settings.hiddenShapes) || 0 });
    }

    QtObject {
        id: d
        property string pending: ""

        function send(type, payload) {
            if (screen.endpoint)
                screen.endpoint.sendMessage(type, JSON.stringify(payload));
        }
    }

    // A part of the page: its heading in bold capitals over its words, a
    // 2 px rule under it (Settings.dc.html L26–41).
    component Part: Item {
        id: part
        property string heading: ""
        property string value: ""
        property int valueWidth: width - 2 * M.contentSide
        readonly property alias valueText: valueText
        width: M.screenWidth
        height: screen.partHeight
        Text {
            objectName: "partHeading"
            x: M.contentSide
            y: 28
            width: part.width - 2 * M.contentSide
            height: 40
            color: "black"
            font.family: screen.faces.ui
            font.weight: Font.Bold
            font.pixelSize: 30
            font.letterSpacing: 2
            font.capitalization: Font.AllUppercase
            verticalAlignment: Text.AlignVCenter
            textFormat: Text.PlainText
            text: part.heading
        }
        Text {
            id: valueText
            objectName: "partValue"
            x: M.contentSide
            y: 78
            width: part.valueWidth
            height: 56
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 44
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: part.value
        }
        Rectangle {
            objectName: "partRule"
            x: M.contentSide
            y: part.height - M.listRule
            width: part.width - 2 * M.contentSide
            height: M.listRule
            color: "black"
            antialiasing: false
        }
    }

    ListBar {
        id: listBar
        x: 0
        y: 0
        faces: screen.faces
        pending: d.pending === "back" ? "back" : ""
        onBackTapped: {
            if (d.pending !== "")
                return;
            d.pending = "back";
            d.send(2, { view: "shelf" });
        }
    }

    Region {
        id: contentRegion
        objectName: "content"
        x: 0
        y: M.barHeight
        width: screen.width
        height: 4 * screen.partHeight
        content: ({ account: "", sync: "", version: "" })

        Part {
            id: accountPart
            objectName: "account"
            y: 0
            heading: Pages.copy.account
            value: contentRegion.content.account || ""
        }
        Part {
            id: syncPart
            objectName: "sync"
            y: screen.partHeight
            heading: Pages.copy.syncHeading
            value: contentRegion.content.sync || ""
        }
        Part {
            id: readerPart
            objectName: "thisReader"
            y: 3 * screen.partHeight
            heading: Pages.copy.thisReader
            value: contentRegion.content.version || ""
        }
    }

    Region {
        id: shapesRegion
        objectName: "shapes"
        x: 0
        y: M.barHeight + 2 * screen.partHeight
        width: screen.width
        height: screen.partHeight
        content: ({ hidden: 0 })

        Part {
            id: shapesPart
            objectName: "shapesPart"
            y: 0
            heading: Pages.copy.shapes
            value: Pages.hiddenLine(shapesRegion.content.hidden)
            valueWidth: shapesRegion.content.hidden > 0
                        ? showAllButton.x - 32 - M.contentSide : width - 2 * M.contentSide
        }

        InkButton {
            id: showAllButton
            objectName: "showAllAgain"
            faces: screen.faces
            visible: shapesRegion.content.hidden > 0
            active: visible
            x: shapesRegion.width - M.contentSide - width
            y: 60
            height: 96
            padding: 40
            fontSize: 36
            text: Pages.copy.showAllAgain
            held: d.pending === "showAll"
            onActivated: {
                if (d.pending !== "")
                    return;
                d.pending = "showAll";
                d.send(9, {});
            }
        }
    }

    // Sign out, and its question (Decision 5).
    Region {
        id: signOutRegion
        objectName: "signOut"
        x: 0
        y: M.barHeight + 4 * screen.partHeight
        width: screen.width
        height: M.contentHeight - 4 * screen.partHeight
        content: ({ asking: false })

        InkButton {
            id: signOutButton
            objectName: "signOutButton"
            faces: screen.faces
            visible: signOutRegion.content.asking !== true
            active: visible
            x: M.contentSide
            y: 64
            height: 120
            padding: 56
            fontSize: 40
            text: Pages.copy.signOut
            onActivated: signOutRegion.show({ asking: true })
        }

        Text {
            id: questionText
            objectName: "signOutQuestion"
            visible: signOutRegion.content.asking === true
            x: M.contentSide
            y: 64
            width: 1100
            height: Math.ceil(contentHeight)
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 36
            lineHeight: 1.4
            wrapMode: Text.WordWrap
            textFormat: Text.PlainText
            text: Pages.copy.signOutQuestion
        }

        InkButton {
            id: confirmButton
            objectName: "confirmSignOut"
            faces: screen.faces
            visible: signOutRegion.content.asking === true
            active: visible
            x: M.contentSide
            y: questionText.y + questionText.height + 32
            height: 120
            padding: 56
            fontSize: 40
            text: Pages.copy.signOut
            held: d.pending === "signOut"
            onActivated: {
                if (d.pending !== "")
                    return;
                d.pending = "signOut";
                d.send(6, {});
                screen.signedOut();
            }
        }

        InkButton {
            id: cancelButton
            objectName: "cancelSignOut"
            faces: screen.faces
            visible: signOutRegion.content.asking === true
            active: visible
            x: confirmButton.x + confirmButton.width + 32
            y: confirmButton.y
            height: 120
            padding: 56
            fontSize: 40
            text: Pages.copy.cancel
            onActivated: {
                if (d.pending !== "")
                    return;
                signOutRegion.show({ asking: false });
            }
        }
    }

    // An empty foot, its rule kept: the content never changes height.
    ListFoot {
        id: listFoot
        x: 0
        y: M.barHeight + M.contentHeight
        faces: screen.faces
    }
}
