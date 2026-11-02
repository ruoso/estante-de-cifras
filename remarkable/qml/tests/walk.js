.pragma library
// Helpers for the chart tests (reader.qml_chart): walk an item tree and check
// what workflow 19's rule 6 asks of every Rectangle and Text (one bit, whole
// pixels, strokes of at least 2 px).

// Every item under root (root included), depth first, in child order.
function items(root) {
    var out = [];
    (function visit(item) {
        if (!item)
            return;
        out.push(item);
        var kids = item.children || [];
        for (var i = 0; i < kids.length; ++i)
            visit(kids[i]);
    })(root);
    return out;
}

function named(root, name) {
    return items(root).filter(function (item) { return item.objectName === name; });
}

function isRectangle(item) {
    return /^QQuickRectangle(_QML_\d+)?\(/.test(String(item));
}

function isText(item) {
    return /^QQuickText(_QML_\d+)?\(/.test(String(item));
}

function blackOrWhite(c) {
    return Qt.colorEqual(c, "#000000") || Qt.colorEqual(c, "#ffffff");
}

function integral(item) {
    return Number.isInteger(item.x) && Number.isInteger(item.y)
        && Number.isInteger(item.width) && Number.isInteger(item.height);
}

// The problems rule 6 finds under root: one string per offending item.
function oneBitProblems(root) {
    var problems = [];
    var all = items(root);
    for (var i = 0; i < all.length; ++i) {
        var item = all[i];
        var name = (item.objectName || String(item));
        if (isRectangle(item)) {
            if (!blackOrWhite(item.color))
                problems.push(name + ": colour " + item.color);
            if (item.antialiasing)
                problems.push(name + ": antialiased");
            if (!integral(item))
                problems.push(name + ": geometry " + [item.x, item.y, item.width, item.height]);
            // A border is drawn in its own colour only where it differs from
            // the fill (Qt's default 1 px black border on a black fill draws
            // nothing apart from it).
            if (item.border.width > 0 && !Qt.colorEqual(item.border.color, item.color)) {
                if (item.border.width < 2)
                    problems.push(name + ": border " + item.border.width + " px");
                if (!blackOrWhite(item.border.color))
                    problems.push(name + ": border colour " + item.border.color);
            } else if (Math.min(item.width, item.height) < 2) {
                problems.push(name + ": stroke " + Math.min(item.width, item.height) + " px");
            }
            if (item.opacity !== 1)
                problems.push(name + ": opacity " + item.opacity);
        } else if (isText(item)) {
            if (!blackOrWhite(item.color))
                problems.push(name + ": text colour " + item.color);
            if (!integral(item))
                problems.push(name + ": geometry " + [item.x, item.y, item.width, item.height]);
            if (item.opacity !== 1)
                problems.push(name + ": opacity " + item.opacity);
        }
    }
    return problems;
}

// Every Rectangle and Text under root.
function inked(root) {
    return items(root).filter(function (item) { return isRectangle(item) || isText(item); });
}
