# SwatchesRotator

InDesign script: duplicates the active spread X times and gives every copy a new colour mix.

Each colour is swapped consistently for another one (red → blue, blue → yellow …), so different colours stay
different and text never ends up on a background of the same colour. Tints are kept (red 40 % → blue 40 %),
spot colours work like any other swatch.

## Usage

1. Open the spread you want to vary.
2. Run `SwatchesRotator.jsx` from the Scripts panel.
3. Enter the number of copies and tick the swatches that may be mixed. Colours used on the spread are ticked
   already; tick more swatches to bring them in, untick a colour (e.g. Black) to keep it unchanged.

One undo step removes everything.

## What gets recoloured

Fill, stroke and gap colour of frames, shapes and lines (also in groups and anchored objects), text
(fill, stroke, underline, strike-through, paragraph rules, type on a path), tables (cell fill, cell edges, cell
text), and grayscale/1-bit images.

## Not recoloured

- Gradients: their colour stops are global and would change the original too.
- Effect colours (drop shadow, glow …), paragraph shading and borders.
- Master page items and placed AI/PDF/EPS files: InDesign cannot recolour them.

## Install

```bash
./install.sh
```

Links the script into every InDesign Scripts Panel folder found. Alternatively copy `SwatchesRotator.jsx` there by hand
(Scripts panel → right-click *User* → *Reveal in Finder*).

## Tests

```bash
./test/run_tests.sh
```

Runs the tests in InDesign 2026 and prints the result.

## License

MIT, see [LICENSE](LICENSE).
