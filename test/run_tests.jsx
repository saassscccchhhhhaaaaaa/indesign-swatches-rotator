//@target indesign
// Test runner: started in InDesign by test/run_tests.sh via AppleScript.
$.global.SR_TEST = true;
var TEST_DIR = File($.fileName).parent;
$.evalFile(File(TEST_DIR.parent.fsName + "/SwatchesRotator.jsx"));
SR.lang = "en";

var T = { lines: [], ok: 0, fail: 0, current: "" };

function check(cond, msg) {
    if (cond) { T.ok++; return; }
    T.fail++;
    T.lines.push("FAIL " + T.current + ": " + msg);
}

function eq(a, b, msg) { check(a === b, msg + " - expected " + b + ", got " + a); }

function test(name, fn) {
    var before = T.fail;
    T.current = name;
    try { fn(); } catch (e) {
        T.fail++;
        T.lines.push("FAIL " + name + ": exception " + e + " (line " + e.line + ")");
    }
    T.lines.push((T.fail === before ? "ok   " : "---  ") + name);
}

function keys(o) { var a = [], k; for (k in o) if (o.hasOwnProperty(k)) a.push(k); return a.sort(); }

// Test document: red, blue, a spot colour and a 40 % red tint on frames, a line, a group,
// text, a table, a grayscale image, a locked item and a locked layer.
function makeDoc() {
    var doc = app.documents.add(false), pg, c = {}, f = {}, tf, tbl, cell;
    doc.documentPreferences.facingPages = false;
    doc.viewPreferences.rulerOrigin = RulerOrigin.SPREAD_ORIGIN;
    doc.zeroPoint = [0, 0];
    c.red = doc.colors.add({ name: "Red", model: ColorModel.PROCESS, space: ColorSpace.CMYK, colorValue: [0, 100, 100, 0] });
    c.blue = doc.colors.add({ name: "Blue", model: ColorModel.PROCESS, space: ColorSpace.CMYK, colorValue: [100, 60, 0, 0] });
    c.spot = doc.colors.add({ name: "Spot", model: ColorModel.SPOT, space: ColorSpace.CMYK, colorValue: [0, 20, 100, 0] });
    c.extra = doc.colors.add({ name: "Extra", model: ColorModel.PROCESS, space: ColorSpace.CMYK, colorValue: [50, 0, 50, 0] });
    c.red40 = doc.tints.add(c.red, { tintValue: 40 });
    pg = doc.pages[0];
    f.rect = pg.rectangles.add({ geometricBounds: [10, 10, 50, 50], fillColor: c.red, strokeColor: c.spot, strokeWeight: 2 });
    f.tinted = pg.rectangles.add({ geometricBounds: [60, 10, 100, 50], fillColor: c.red40, strokeColor: "None" });
    f.half = pg.ovals.add({ geometricBounds: [110, 10, 150, 50], fillColor: c.blue, fillTint: 50, strokeColor: "None" });
    f.line = pg.graphicLines.add({ geometricBounds: [160, 10, 160, 100], strokeColor: c.spot, strokeWeight: 1 });
    f.g1 = pg.rectangles.add({ geometricBounds: [10, 60, 30, 80], fillColor: c.red, strokeColor: "None" });
    f.g2 = pg.rectangles.add({ geometricBounds: [10, 90, 30, 110], fillColor: c.blue, strokeColor: "None" });
    pg.groups.add([f.g1, f.g2]);
    tf = pg.textFrames.add({ geometricBounds: [200, 10, 240, 200], contents: "Hallo Welt" });
    tf.texts[0].characters.itemByRange(0, 4).fillColor = c.red;
    tf.texts[0].characters.itemByRange(6, 9).fillColor = c.spot;
    f.text = tf;
    tf = pg.textFrames.add({ geometricBounds: [250, 10, 330, 200] });
    tbl = tf.insertionPoints[0].tables.add({ bodyRowCount: 1, columnCount: 2 });
    cell = tbl.cells[0];
    cell.fillColor = c.blue;
    cell.contents = "X";
    cell.texts[0].fillColor = c.red;
    f.cell = cell;
    f.img = pg.rectangles.add({ geometricBounds: [340, 10, 380, 50], strokeColor: "None" });
    f.img.place(File(TEST_DIR.fsName + "/gray.png"));
    f.img.graphics[0].fillColor = c.blue;
    f.locked = pg.rectangles.add({ geometricBounds: [60, 60, 100, 100], fillColor: c.blue, strokeColor: "None" });
    f.locked.locked = true;
    f.onLocked = pg.rectangles.add({ geometricBounds: [60, 110, 100, 150], fillColor: c.red, strokeColor: "None",
        itemLayer: doc.layers.add({ name: "Locked" }) });
    doc.layers.itemByName("Locked").locked = true;
    return { doc: doc, c: c, f: f };
}

// The same item on another spread (same position in allPageItems)
function twin(item, spread) {
    var src = item.parent, i, items;
    while (src.constructor.name !== "Spread") src = src.parent;
    items = src.allPageItems;
    for (i = 0; i < items.length; i++) if (items[i].id === item.id) return spread.allPageItems[i];
    return null;
}

var docs = [];
var saved = { uil: app.scriptPreferences.userInteractionLevel, unit: app.scriptPreferences.measurementUnit };
try {
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
    app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;

    test("makeMap: injective, in pool, no unchanged colours", function () {
        var used = ["a", "b", "c"], pool = ["a", "b", "c", "d"], run, m, seen, i;
        for (run = 0; run < 20; run++) {
            m = SR.makeMap(used, pool);
            seen = {};
            for (i = 0; i < used.length; i++) {
                check(!seen[m[used[i]]], "value used twice: " + m[used[i]]);
                seen[m[used[i]]] = true;
                check(m[used[i]] !== used[i], used[i] + " stayed the same");
                check(m[used[i]] >= "a" && m[used[i]] <= "d", "value not in pool: " + m[used[i]]);
            }
        }
    });

    test("makeMap: single colour maps to itself", function () {
        eq(SR.makeMap(["a"], ["a"]).a, "a", "a");
    });

    test("isMixable: no None, Registration, gradient or tint", function () {
        var d = makeDoc(), doc = d.doc;
        docs.push(doc);
        check(!SR.isMixable(doc.swatches.itemByName("None").getElements()[0]), "None");
        check(!SR.isMixable(doc.swatches.itemByName("Registration").getElements()[0]), "Registration");
        check(SR.isMixable(doc.swatches.itemByName("Paper").getElements()[0]), "Paper");
        check(SR.isMixable(doc.swatches.itemByName("Black").getElements()[0]), "Black");
        check(SR.isMixable(d.c.spot), "Spot");
        check(!SR.isMixable(d.c.red40), "tint swatch");
        check(!SR.isMixable(doc.gradients.add()), "gradient");
    });

    test("collectUsed: base colours of everything on the spread", function () {
        var d = makeDoc();
        docs.push(d.doc);
        var used = SR.collectUsed(d.doc.spreads[0]);
        eq(keys(used).join(","), "Black,Blue,Red,Spot", "used");
    });

    test("rotate: copies, swaps everything, keeps tints and the original", function () {
        var d = makeDoc(), doc = d.doc, c = d.c, f = d.f, src = doc.spreads[0], copies, sp, map, x;
        docs.push(doc);
        copies = SR.rotate(doc, src, 2, ["Red", "Blue", "Spot"], { Red: c.red, Blue: c.blue, Spot: c.spot, Extra: c.extra });
        eq(doc.spreads.length, 3, "spreads");
        eq(copies.length, 2, "returned spreads");
        // Original untouched
        eq(f.rect.fillColor.name, "Red", "original fill");
        eq(f.text.texts[0].characters[0].fillColor.name, "Red", "original text");

        // Copy with a fixed map: Red -> Blue, Blue -> Spot, Spot -> Extra
        check(twin(f.rect, copies[0]).fillColor.name !== "Red", "random copy got a new fill");
        map = { Red: c.blue, Blue: c.spot, Spot: c.extra };
        sp = src.duplicate(LocationOptions.AT_END);
        SR.unlocked(doc, sp, function () { SR.recolor(sp, map); });
        eq(twin(f.rect, sp).fillColor.name, "Blue", "rect fill");
        eq(twin(f.rect, sp).strokeColor.name, "Extra", "rect stroke (spot)");
        x = twin(f.tinted, sp);
        eq(x.fillColor.name, "Blue", "tint swatch -> base colour");
        eq(Math.round(x.fillTint), 40, "tint swatch keeps 40 %");
        x = twin(f.half, sp);
        eq(x.fillColor.name, "Spot", "oval fill");
        eq(Math.round(x.fillTint), 50, "object tint kept");
        eq(twin(f.line, sp).strokeColor.name, "Extra", "line");
        eq(twin(f.g1, sp).fillColor.name, "Blue", "group child 1");
        eq(twin(f.g2, sp).fillColor.name, "Spot", "group child 2");
        x = twin(f.text, sp).texts[0];
        eq(x.characters[0].fillColor.name, "Blue", "text word 1");
        eq(x.characters[7].fillColor.name, "Extra", "text word 2");
        x = sp.textFrames.everyItem().getElements();
        for (var i = 0, cell = null; i < x.length; i++) if (x[i].tables.length) cell = x[i].tables[0].cells[0];
        eq(cell.fillColor.name, "Spot", "cell fill");
        eq(cell.texts[0].fillColor.name, "Blue", "cell text");
        eq(cell.topEdgeStrokeColor.name, "Black", "unmapped Black stays");
        eq(twin(f.img, sp).graphics[0].fillColor.name, "Spot", "grayscale image");
        x = twin(f.locked, sp);
        eq(x.fillColor.name, "Spot", "locked item recoloured");
        check(x.locked, "locked item locked again");
        eq(twin(f.onLocked, sp).fillColor.name, "Blue", "item on locked layer");
        check(doc.layers.itemByName("Locked").locked, "layer locked again");
    });
} catch (e) {
    T.fail++;
    T.lines.push("FAIL runner: " + e + " (line " + e.line + ")");
} finally {
    for (var d = docs.length - 1; d >= 0; d--) {
        try { if (docs[d].isValid) docs[d].close(SaveOptions.NO); } catch (e2) {}
    }
    app.scriptPreferences.measurementUnit = saved.unit;
    app.scriptPreferences.userInteractionLevel = saved.uil;
    var out = Folder(TEST_DIR.fsName + "/output");
    out.create();
    var rf = File(out.fsName + "/result.txt");
    rf.encoding = "UTF-8";
    rf.lineFeed = "Unix";
    rf.open("w");
    rf.write(T.lines.join("\n") + "\nRESULT: " + T.ok + " ok, " + T.fail + " failed\n");
    rf.close();
}
