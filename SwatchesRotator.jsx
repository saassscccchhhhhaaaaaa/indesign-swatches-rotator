//@target indesign
/*
    SwatchesRotator.jsx - Version 1.0.0
    Author: Sascha Fronczek - https://saschafronczek.de
    License: MIT (see LICENSE)

    Duplicates the active spread X times and gives every copy a new colour mix:
    each colour is swapped for another one everywhere in the copy (red -> blue, blue -> yellow ...),
    so different colours stay different. The pool is the colours used on the spread plus any
    swatches ticked in the dialog. Tints are kept (red 40 % -> blue 40 %), spot colours work like any swatch.
    Recolours frames, vectors, lines, text, tables and grayscale/1-bit images.
    Not recoloured: gradients (their stops are global), effect colours, master page items, placed AI/PDF.
*/

var SR = {};

SR.VERSION = "1.0.0";
SR.AUTHOR = "Sascha Fronczek";
SR.WEBSITE = "saschafronczek.de";
SR.TRIES = 50; // shuffles per copy to avoid colours that stay the same

// [colour property, tint property] per object kind
SR.ITEM_PROPS = [["fillColor", "fillTint"], ["strokeColor", "strokeTint"], ["gapColor", "gapTint"]];
SR.TEXT_PROPS = [["fillColor", "fillTint"], ["strokeColor", "strokeTint"], ["underlineColor", "underlineTint"],
    ["strikeThroughColor", "strikeThroughTint"], ["ruleAboveColor", "ruleAboveTint"], ["ruleBelowColor", "ruleBelowTint"]];
SR.CELL_PROPS = [["fillColor", "fillTint"], ["topEdgeStrokeColor", "topEdgeStrokeTint"],
    ["bottomEdgeStrokeColor", "bottomEdgeStrokeTint"], ["leftEdgeStrokeColor", "leftEdgeStrokeTint"],
    ["rightEdgeStrokeColor", "rightEdgeStrokeTint"]];

// ---------- Texts ----------

SR.STRINGS = {
    en: {
        title: "Swatches Rotator",
        noDoc: "Please open a document first.",
        noColors: "No swappable colours found on this spread.",
        noSpread: "Please show a document spread, not a master.",
        copies: "Copies:",
        swatches: "Swatches in the mix (click to tick/untick):",
        used: "used",
        badCount: "Please enter a number of copies from 1 to 100.",
        tooFew: "Please tick at least two swatches.",
        done: "{0} copies created, {1} colours mixed.",
        language: "Language:",
        cancel: "Cancel"
    },
    de: {
        title: "Swatches Rotator",
        noDoc: "Bitte zuerst ein Dokument \u00f6ffnen.",
        noColors: "Auf diesem Druckbogen wurden keine tauschbaren Farben gefunden.",
        noSpread: "Bitte einen Dokument-Druckbogen anzeigen, keine Musterseite.",
        copies: "Kopien:",
        swatches: "Farbfelder im Mix (Klick = an/aus):",
        used: "benutzt",
        badCount: "Bitte eine Anzahl Kopien von 1 bis 100 eingeben.",
        tooFew: "Bitte mindestens zwei Farbfelder anhaken.",
        done: "{0} Kopien erstellt, {1} Farben gemischt.",
        language: "Sprache:",
        cancel: "Abbrechen"
    }
};

SR.LANGUAGES = [{ code: "en", name: "English" }, { code: "de", name: "Deutsch" }];

SR.settingsFile = function () {
    return File(Folder.userData.fsName + "/SwatchesRotator/settings.txt");
};

// Saved UI language; English if nothing (valid) is saved.
SR.loadLanguage = function () {
    var file = SR.settingsFile(), s, m;
    try {
        if (file.exists && file.open("r")) {
            s = file.read();
            file.close();
            m = /lang=(\w+)/.exec(s);
            if (m && SR.STRINGS[m[1]]) return m[1];
        }
    } catch (e) {}
    return "en";
};

SR.saveLanguage = function (code) {
    var file = SR.settingsFile();
    try {
        file.parent.create();
        file.encoding = "UTF-8";
        if (file.open("w")) {
            file.write("lang=" + code + "\n");
            file.close();
        }
    } catch (e) {}
};

SR.lang = SR.loadLanguage();

// Translated text for key; {0}, {1} ... are replaced by the further arguments.
SR.t = function (key) {
    var s = SR.STRINGS[SR.lang][key], i;
    if (s === undefined) s = SR.STRINGS.en[key];
    for (i = 1; i < arguments.length; i++) s = s.split("{" + (i - 1) + "}").join(String(arguments[i]));
    return s;
};

// ---------- Mapping (no InDesign objects) ----------

// Random injective map used name -> pool name; the shuffle with the fewest unchanged colours wins.
// rnd: optional random function (tests).
SR.makeMap = function (used, pool, rnd) {
    var best = null, bestFixed = Infinity, t, p, i, j, tmp, fixed, map;
    rnd = rnd || Math.random;
    for (t = 0; t < SR.TRIES && bestFixed > 0; t++) {
        p = pool.slice(0);
        for (i = p.length - 1; i > 0; i--) { // Fisher-Yates
            j = Math.floor(rnd() * (i + 1));
            tmp = p[i]; p[i] = p[j]; p[j] = tmp;
        }
        map = {};
        fixed = 0;
        for (i = 0; i < used.length; i++) {
            map[used[i]] = p[i];
            if (p[i] === used[i]) fixed++;
        }
        if (fixed < bestFixed) { best = map; bestFixed = fixed; }
    }
    return best;
};

// ---------- Swatches ----------

// Swatch that can be swapped or used in the pool: plain colours (process, spot, Paper, Black)
// and mixed inks; not None, Registration, gradients or tints (tints count as their base colour).
SR.isMixable = function (s) {
    var kind = s && s.constructor && s.constructor.name;
    if (kind === "MixedInk") return true;
    return kind === "Color" && s.model !== ColorModel.REGISTRATION;
};

// { base, tint } for a colour property value; tint is null for plain colours, null result = not swappable
SR.resolve = function (s) {
    if (!s || typeof s !== "object" || !s.isValid) return null;
    if (s.constructor.name === "Tint") return { base: s.baseColor, tint: s.tintValue };
    return SR.isMixable(s) ? { base: s, tint: null } : null;
};

// ---------- Walking a spread ----------

// Calls fn(obj, props) for every colour-carrying object on the spread.
SR.walk = function (spread, fn) {
    var items = spread.allPageItems, i, k, item, kind;
    for (i = 0; i < items.length; i++) {
        item = items[i];
        kind = item.constructor.name;
        if (kind === "Group") continue; // a group's fill would recolour all its children
        fn(item, SR.ITEM_PROPS);
        if (kind === "TextFrame") SR.walkText(item.texts[0], fn);
        try {
            for (k = 0; k < item.textPaths.length; k++) SR.walkText(item.textPaths[k].texts[0], fn);
        } catch (e) {} // only splines have text paths
    }
};

// Text ranges, tables and table cells of a text (only the part inside its frame).
SR.walkText = function (text, fn) {
    var ranges = text.textStyleRanges.everyItem().getElements(), tables = text.tables.everyItem().getElements();
    var i, k, cells;
    for (i = 0; i < ranges.length; i++) fn(ranges[i], SR.TEXT_PROPS);
    for (i = 0; i < tables.length; i++) {
        cells = tables[i].cells.everyItem().getElements();
        for (k = 0; k < cells.length; k++) {
            fn(cells[k], SR.CELL_PROPS);
            SR.walkText(cells[k].texts[0], fn);
        }
    }
};

// Names of the base colours used on the spread -> { name: swatch }
SR.collectUsed = function (spread) {
    var used = {};
    SR.walk(spread, function (obj, props) {
        for (var i = 0, r; i < props.length; i++) {
            try { r = SR.resolve(obj[props[i][0]]); } catch (e) { r = null; }
            if (r) used[r.base.name] = r.base;
        }
    });
    return used;
};

// Swaps the colours of the spread by map { base name: new swatch }; tints are kept.
// Returns the number of changed properties.
SR.recolor = function (spread, map) {
    var count = 0;
    SR.walk(spread, function (obj, props) {
        var i, r, to, tint;
        for (i = 0; i < props.length; i++) {
            try {
                r = SR.resolve(obj[props[i][0]]);
                to = r && map[r.base.name];
                if (!to || to === r.base) continue;
                if (r.tint !== null) {
                    tint = obj[props[i][1]];
                    tint = r.tint * (tint < 0 ? 100 : tint) / 100;
                }
                obj[props[i][0]] = to;
                if (r.tint !== null) obj[props[i][1]] = tint;
                count++;
            } catch (e) {} // e.g. colour images cannot be coloured
        }
    });
    return count;
};

// ---------- Main work ----------

// Unlocks layers and items of the spread, runs fn, locks them again.
SR.unlocked = function (doc, spread, fn) {
    var layers = doc.layers.everyItem().getElements(), items = spread.allPageItems, locked = [], i;
    for (i = 0; i < layers.length; i++) if (layers[i].locked) { locked.push(layers[i]); layers[i].locked = false; }
    for (i = 0; i < items.length; i++) if (items[i].locked) { locked.push(items[i]); items[i].locked = false; }
    try { return fn(); } finally {
        for (i = 0; i < locked.length; i++) try { locked[i].locked = true; } catch (e) {}
    }
};

// Duplicates the spread `copies` times, each copy with its own mix.
// used: names of colours to swap, pool: { name: swatch } to swap them into. Returns the new spreads.
SR.rotate = function (doc, spread, copies, used, pool) {
    var names = [], n, spreads = [], last = spread, i, nameMap, map;
    for (n in pool) if (pool.hasOwnProperty(n)) names.push(n);
    for (i = 0; i < copies; i++) {
        last = last.duplicate(LocationOptions.AFTER, last);
        nameMap = SR.makeMap(used, names);
        map = {};
        for (n in nameMap) if (nameMap.hasOwnProperty(n)) map[n] = pool[nameMap[n]];
        SR.unlocked(doc, last, function () { SR.recolor(last, map); });
        spreads.push(last);
    }
    return spreads;
};

// ---------- Dialog ----------

// Returns { copies, picked: [names] } or null. all: [{ name, used }], used ones first.
SR.ask = function (all) {
    var w = new Window("dialog", SR.t("title")), texts = [], oldLang = SR.lang;
    var g, count, list, langList, info, i, item, res;
    function label(ctrl, key) {
        texts.push({ ctrl: ctrl, key: key });
        ctrl.text = SR.t(key);
        return ctrl;
    }
    function itemText(e) { return e.used ? e.name + "  (" + SR.t("used") + ")" : e.name; }
    function relabel() {
        for (var j = 0; j < texts.length; j++) texts[j].ctrl.text = SR.t(texts[j].key);
        for (j = 0; j < all.length; j++) list.items[j].text = itemText(all[j]);
        w.text = SR.t("title");
        w.layout.layout(true);
    }

    w.alignChildren = "fill";
    g = w.add("group");
    label(g.add("statictext"), "copies");
    count = g.add("edittext", undefined, "3");
    count.characters = 5;
    label(w.add("statictext"), "swatches");
    list = w.add("listbox", undefined, []);
    list.preferredSize = [340, 260];
    for (i = 0; i < all.length; i++) {
        item = list.add("item", itemText(all[i]));
        item.checked = all[i].used;
    }
    // A click toggles the tick; the selection is cleared so the next click toggles again.
    list.onChange = function () {
        if (!list.selection) return;
        list.selection.checked = !list.selection.checked;
        list.selection = null;
    };

    g = w.add("group");
    g.alignment = "left";
    label(g.add("statictext"), "language");
    langList = g.add("dropdownlist");
    for (i = 0; i < SR.LANGUAGES.length; i++) {
        langList.add("item", SR.LANGUAGES[i].name);
        if (SR.LANGUAGES[i].code === SR.lang) langList.selection = i;
    }
    if (!langList.selection) langList.selection = 0;
    langList.onChange = function () {
        if (!langList.selection) return;
        SR.lang = SR.LANGUAGES[langList.selection.index].code;
        relabel();
    };

    info = w.add("statictext", undefined, "Version " + SR.VERSION + "  |  " + SR.AUTHOR + "  |  " + SR.WEBSITE);
    info.enabled = false;
    g = w.add("group");
    g.alignment = "right";
    label(g.add("button", undefined, "", { name: "cancel" }), "cancel");
    g.add("button", undefined, "OK", { name: "ok" });

    while (true) {
        if (w.show() !== 1) { SR.lang = oldLang; return null; }
        res = { copies: Number(count.text), picked: [] };
        for (i = 0; i < all.length; i++) if (list.items[i].checked) res.picked.push(all[i].name);
        if (!(res.copies >= 1 && res.copies <= 100 && res.copies % 1 === 0)) alert(SR.t("badCount"));
        else if (res.picked.length < 2) alert(SR.t("tooFew"));
        else break;
    }
    SR.saveLanguage(SR.lang);
    return res;
};

SR.run = function () {
    var doc, spread, usedMap, all = [], rest = [], sw, i, n, ans, pool = {}, used = [], spreads;
    if (!app.documents.length) { alert(SR.t("noDoc")); return; }
    doc = app.activeDocument;
    spread = app.activeWindow.activeSpread;
    if (spread.constructor.name !== "Spread") { alert(SR.t("noSpread")); return; }
    usedMap = SR.collectUsed(spread);
    for (n in usedMap) if (usedMap.hasOwnProperty(n)) all.push({ name: n, used: true });
    if (!all.length) { alert(SR.t("noColors")); return; }
    sw = doc.swatches.everyItem().getElements();
    for (i = 0; i < sw.length; i++) {
        if (SR.isMixable(sw[i]) && !usedMap.hasOwnProperty(sw[i].name)) rest.push({ name: sw[i].name, used: false });
    }
    ans = SR.ask(all.concat(rest));
    if (!ans) return;
    for (i = 0; i < ans.picked.length; i++) {
        pool[ans.picked[i]] = doc.swatches.itemByName(ans.picked[i]);
        if (usedMap.hasOwnProperty(ans.picked[i])) used.push(ans.picked[i]);
    }
    app.doScript(function () {
        spreads = SR.rotate(doc, spread, ans.copies, used, pool);
    }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, SR.t("title"));
    alert(SR.t("done", spreads.length, used.length), SR.t("title"));
};

if (!$.global.SR_TEST) {
    SR.run();
}
