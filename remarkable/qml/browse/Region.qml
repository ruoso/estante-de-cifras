// One region of a browse screen (reader.browse_screens; workflow 19 rule 4,
// §What it costs): what it draws is replaced in one place, `show`, which
// bumps `revision` — so a test counts its redraws, as the song screen's
// regions are counted (reader.song_screen Decision 2). What it draws binds
// to `content` only.
import QtQuick

Item {
    id: region

    property var content: ({})
    property int revision: 0

    function show(c) {
        region.content = c;
        region.revision += 1;
    }
}
