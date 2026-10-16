#!/bin/bash
# Symlinks the script into every InDesign Scripts Panel folder found (macOS).
set -e
SRC="$(cd "$(dirname "$0")" && pwd)/SwatchesRotator.jsx"
found=0
for d in "$HOME/Library/Preferences/Adobe InDesign"/*/*/Scripts/"Scripts Panel"; do
  [ -d "$d" ] || continue
  ln -sfn "$SRC" "$d/SwatchesRotator.jsx"
  echo "Installed: $d"
  found=1
done
[ "$found" = 1 ] || echo "No Scripts Panel folder found. Start InDesign and open Window > Utilities > Scripts once."
