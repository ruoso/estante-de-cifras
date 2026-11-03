// Settings (reader.browse_screens; workflow 19 §The shelf, Settings, as
// amended; Settings.dc.html). Bar: Back (to the shelf) · *Settings*. Then, in
// this order: Account (*Paired with* the account), Sync (the shelf's sync
// line as it was when the page opened — it does not change here, rule 5),
// Shapes (the count hidden, with **Show all again**, or *No shapes hidden.*),
// This reader (*Version 0.1.0*, and under it *Update the reader on your
// reMarkable* when the site serves a hostApi newer than the backend speaks —
// reader.self_update, design §8), Chord names (*As written* or *As voiced*
// — as the shapes shown sound them — *As in your account* or *Chosen on this
// reMarkable*, and the button naming the other, one tap), Instrument (the one every song is read
// with, *As in your account* or *Chosen on this reMarkable*, and **Change**,
// shown when the account has two or more — workflow 19 §Settings), and
// **Sign out**, which asks once: pressed, the question replaces it with
// **Sign out** and **Cancel**. **Change** replaces it the same way with the
// instruments to choose, the one read with inverted, and **Cancel**; one
// chosen is kept on this reMarkable, the account's own follows the account
// again. Five regions, each replaced in one place and counted in `revision`:
//
//   the page opened (`show`)            bar, content, shapes, chord names, instrument, sign-out part
//   chord names switched (`answered`)   chord names
//   a text size chosen                  the whole page, made again at it (Main)
//   Show all again answered (`answered`)    shapes
//   Sign out asked / Cancel             the sign-out part
//   Change / Cancel                     the sign-out part
//   an instrument chosen (`answered`)   instrument, the sign-out part
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
    readonly property Region instrument: instrumentRegion
    readonly property Region chordNames: chordNamesRegion
    readonly property Region textSize: textSizeRegion
    readonly property alias textSizeButtons: textSizeRepeater
    readonly property alias chordNamesPart: chordNamesPart
    readonly property alias chordNamesButton: chordNamesButton
    readonly property alias instrumentPart: instrumentPart
    readonly property alias changeButton: changeButton
    readonly property alias instrumentButtons: instrumentRepeater
    readonly property alias cancelInstrumentButton: cancelInstrumentButton
    readonly property alias accountPart: accountPart
    readonly property alias syncPart: syncPart
    readonly property alias readerPart: readerPart
    readonly property Text updateText: readerPart.noteText
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
    // This reader holds a second line (the update's) under its version.
    readonly property int readerHeight: 200
    // Text size: its heading over a row of 100 px buttons.
    readonly property int textSizeHeight: 190
    // Where Instrument starts; the part below it (Sign out, the instruments
    // to choose) is drawn from there, Sign out one part lower.
    readonly property int instrumentTop: M.barHeight + 4 * partHeight + readerHeight + textSizeHeight

    // A `107 settings`, and the state the shelf's sync line is read from.
    function show(settings, state) {
        d.pending = "";
        listBar.show({ title: Pages.copy.settings, back: true, action: "" });
        contentRegion.show({
            account: Pages.pairedWith(settings && settings.account),
            sync: Status.statusLine(state),
            version: Pages.versionLine(settings && settings.version),
            update: Pages.updateLine(settings && settings.updateReader)
        });
        shapesRegion.show({ hidden: Number(settings && settings.hiddenShapes) || 0 });
        chordNamesRegion.show(chordNamesContent(settings));
        textSizeRegion.show({ size: M.textPt });
        instrumentRegion.show(instrumentContent(settings));
        signOutRegion.show({ asking: false, choosing: false, instruments: [] });
    }

    // What the Chord names part draws, from a `107`.
    function chordNamesContent(settings) {
        const names = settings && settings.chordNames === "voiced" ? "voiced" : "written";
        return {
            names: names,
            note: Pages.instrumentNote(settings && settings.chordNamesChosen === true),
            account: settings && settings.accountChordNames === "voiced" ? "voiced" : "written"
        };
    }

    // A `107` while the page is shown: an instrument chosen redraws the
    // Instrument part and puts Sign out back; Show all again answered, the
    // Shapes line only.
    function answered(settings) {
        if (d.pending === "chordNames") {
            d.pending = "";
            chordNamesRegion.show(chordNamesContent(settings));
            return;
        }
        if (d.pending === "instrument") {
            d.pending = "";
            instrumentRegion.show(instrumentContent(settings));
            signOutRegion.show({ asking: false, choosing: false, instruments: [] });
            return;
        }
        if (d.pending === "showAll")
            d.pending = "";
        shapesRegion.show({ hidden: Number(settings && settings.hiddenShapes) || 0 });
    }

    // What the Instrument part draws, from a `107`: nothing without a choice
    // to make.
    function instrumentContent(settings) {
        const list = (settings && settings.instruments) || [];
        if (list.length < 2)
            return { shown: false, name: "", note: "", instruments: [], current: "", account: "" };
        const current = String(settings.instrument || "");
        const read = list.find(i => i.id === current);
        return {
            shown: true,
            name: read ? read.name : "",
            note: Pages.instrumentNote(settings.instrumentChosen === true),
            instruments: list,
            current: current,
            account: String(settings.accountInstrument || "")
        };
    }

    QtObject {
        id: d
        property string pending: ""
        // The instrument asked for, while its 107 is awaited.
        property string choosing: ""

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
        // A second line under the value ("" for none).
        property string note: ""
        property int valueWidth: width - 2 * M.contentSide
        readonly property alias valueText: valueText
        readonly property alias noteText: noteText
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
        Text {
            id: noteText
            objectName: "partNote"
            visible: part.note !== ""
            x: M.contentSide
            y: 136
            width: part.width - 2 * M.contentSide
            height: 40
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 32
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            textFormat: Text.PlainText
            text: part.note
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
        height: 3 * screen.partHeight + screen.readerHeight
        content: ({ account: "", sync: "", version: "", update: "" })

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
            height: screen.readerHeight
            heading: Pages.copy.thisReader
            value: contentRegion.content.version || ""
            note: contentRegion.content.update || ""
        }
    }

    // How the chart names its chords (workflow 19 §Settings).
    Region {
        id: chordNamesRegion
        objectName: "chordNames"
        x: 0
        y: M.barHeight + 3 * screen.partHeight + screen.readerHeight
        width: screen.width
        height: screen.partHeight
        content: ({ names: "written", note: "", account: "written" })

        Part {
            id: chordNamesPart
            objectName: "chordNamesPart"
            y: 0
            heading: Pages.copy.chordNames
            value: Pages.chordNamesLine(chordNamesRegion.content.names)
            note: chordNamesRegion.content.note || ""
            valueWidth: chordNamesButton.x - 32 - M.contentSide
        }

        InkButton {
            id: chordNamesButton
            objectName: "switchChordNames"
            faces: screen.faces
            active: signOutRegion.content.choosing !== true
            x: chordNamesRegion.width - M.contentSide - width
            y: 30
            height: 100
            padding: 40
            fontSize: 36
            text: Pages.chordNamesSwitch(chordNamesRegion.content.names)
            held: d.pending === "chordNames"
            onActivated: {
                if (d.pending !== "")
                    return;
                const next = chordNamesRegion.content.names === "voiced" ? "written" : "voiced";
                d.pending = "chordNames";
                // The account's own follows the account again.
                d.send(14, { value: next === chordNamesRegion.content.account ? null : next });
            }
        }
    }

    // The chart's text size, in points (workflow 19 §Settings): the sizes
    // offered, the one read inverted; one chosen makes the screens again at
    // it (Main), Settings reopened.
    Region {
        id: textSizeRegion
        objectName: "textSize"
        x: 0
        y: M.barHeight + 4 * screen.partHeight + screen.readerHeight
        width: screen.width
        height: screen.textSizeHeight
        content: ({ size: M.standardPt })

        readonly property int buttonWidth: Math.floor((width - 2 * M.contentSide - (M.textSizes.length - 1) * 12) / M.textSizes.length)

        Text {
            objectName: "textSizeHeading"
            x: M.contentSide
            y: 28
            width: textSizeRegion.width - 2 * M.contentSide
            height: 40
            color: "black"
            font.family: screen.faces.ui
            font.weight: Font.Bold
            font.pixelSize: 30
            font.letterSpacing: 2
            font.capitalization: Font.AllUppercase
            verticalAlignment: Text.AlignVCenter
            textFormat: Text.PlainText
            text: Pages.copy.textSize
        }

        Repeater {
            id: textSizeRepeater
            model: M.textSizes
            delegate: InkButton {
                required property int modelData
                required property int index
                readonly property int size: modelData
                objectName: "textSizeChoice"
                faces: screen.faces
                active: signOutRegion.content.choosing !== true
                x: M.contentSide + index * (textSizeRegion.buttonWidth + 12)
                y: 74
                width: textSizeRegion.buttonWidth
                height: 100
                padding: 12
                fontSize: 34
                bold: false
                text: modelData + " pt"
                held: modelData === textSizeRegion.content.size || d.pending === "textSize:" + modelData
                onActivated: {
                    if (d.pending !== "" || modelData === textSizeRegion.content.size)
                        return;
                    d.pending = "textSize:" + modelData;
                    // The standard is no choice.
                    d.send(15, { value: modelData === M.standardPt ? null : modelData });
                }
            }
        }

        Rectangle {
            x: M.contentSide
            y: textSizeRegion.height - M.listRule
            width: textSizeRegion.width - 2 * M.contentSide
            height: M.listRule
            color: "black"
            antialiasing: false
        }
    }

    // The instrument every song is read with (workflow 19 §Settings).
    Region {
        id: instrumentRegion
        objectName: "instrument"
        x: 0
        y: screen.instrumentTop
        width: screen.width
        height: screen.partHeight
        content: ({ shown: false, name: "", note: "", instruments: [], current: "", account: "" })

        Part {
            id: instrumentPart
            objectName: "instrumentPart"
            visible: instrumentRegion.content.shown === true && signOutRegion.content.choosing !== true
            y: 0
            heading: Pages.copy.instrument
            value: instrumentRegion.content.name || ""
            note: instrumentRegion.content.note || ""
            valueWidth: changeButton.x - 32 - M.contentSide
        }

        InkButton {
            id: changeButton
            objectName: "changeInstrument"
            faces: screen.faces
            visible: instrumentRegion.content.shown === true && signOutRegion.content.choosing !== true
            active: visible && signOutRegion.content.choosing !== true
            x: instrumentRegion.width - M.contentSide - width
            y: 30
            height: 100
            padding: 40
            fontSize: 36
            text: Pages.copy.change
            onActivated: {
                if (d.pending !== "")
                    return;
                signOutRegion.show({ asking: false, choosing: true, instruments: instrumentRegion.content.instruments });
            }
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
        y: screen.instrumentTop
        width: screen.width
        height: M.barHeight + M.contentHeight - screen.instrumentTop
        // Sign out sits one part down, under Instrument; the instruments to
        // choose take the whole region, Instrument's place too.
        readonly property int signOutTop: screen.partHeight
        content: ({ asking: false, choosing: false, instruments: [] })

        // The instruments to choose, in place of Sign out: columns of three
        // 100 px buttons (rule 10), up to three columns.
        readonly property int chooseRows: 3
        readonly property int chooseColumns: Math.min(3, Math.max(1, Math.ceil((content.instruments || []).length / chooseRows)))
        readonly property int chooseWidth: Math.floor((width - 2 * M.contentSide - (chooseColumns - 1) * 32) / chooseColumns)

        Text {
            id: chooseText
            objectName: "chooseInstrumentText"
            visible: signOutRegion.content.choosing === true
            x: M.contentSide
            y: 32
            width: signOutRegion.width - 2 * M.contentSide
            height: 48
            color: "black"
            font.family: screen.faces.ui
            font.pixelSize: 36
            verticalAlignment: Text.AlignVCenter
            textFormat: Text.PlainText
            text: Pages.copy.chooseInstrument
        }

        Repeater {
            id: instrumentRepeater
            model: signOutRegion.content.choosing === true
                   ? (signOutRegion.content.instruments || []).slice(0, signOutRegion.chooseRows * 3) : []
            delegate: InkButton {
                required property var modelData
                required property int index
                objectName: "chooseInstrument"
                faces: screen.faces
                readonly property int column: Math.floor(index / signOutRegion.chooseRows)
                readonly property int row: index % signOutRegion.chooseRows
                x: M.contentSide + column * (signOutRegion.chooseWidth + 32)
                y: 96 + row * 112
                width: signOutRegion.chooseWidth
                height: 100
                padding: 32
                fontSize: 36
                bold: false
                elide: true
                text: Pages.instrumentLabel(modelData, instrumentRegion.content.account)
                held: modelData.id === instrumentRegion.content.current
                      || (d.pending === "instrument" && d.choosing === modelData.id)
                onActivated: {
                    if (d.pending !== "")
                        return;
                    if (modelData.id === instrumentRegion.content.current) {
                        signOutRegion.show({ asking: false, choosing: false, instruments: [] });
                        return;
                    }
                    d.pending = "instrument";
                    d.choosing = modelData.id;
                    // The account's own follows the account again.
                    d.send(12, { id: modelData.id === instrumentRegion.content.account ? null : modelData.id });
                }
            }
        }

        InkButton {
            id: cancelInstrumentButton
            objectName: "cancelInstrument"
            faces: screen.faces
            visible: signOutRegion.content.choosing === true
            active: visible
            x: M.contentSide
            y: 96 + Math.min(signOutRegion.chooseRows, (signOutRegion.content.instruments || []).length) * 112 + 20
            height: 100
            padding: 56
            fontSize: 36
            text: Pages.copy.cancel
            onActivated: {
                if (d.pending !== "")
                    return;
                signOutRegion.show({ asking: false, choosing: false, instruments: [] });
            }
        }

        InkButton {
            id: signOutButton
            objectName: "signOutButton"
            faces: screen.faces
            visible: signOutRegion.content.asking !== true && signOutRegion.content.choosing !== true
            active: visible
            x: M.contentSide
            y: signOutRegion.signOutTop + 64
            height: 120
            padding: 56
            fontSize: 40
            text: Pages.copy.signOut
            onActivated: signOutRegion.show({ asking: true, choosing: false, instruments: [] })
        }

        Text {
            id: questionText
            objectName: "signOutQuestion"
            visible: signOutRegion.content.asking === true
            x: M.contentSide
            y: signOutRegion.signOutTop + 64
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
                signOutRegion.show({ asking: false, choosing: false, instruments: [] });
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
