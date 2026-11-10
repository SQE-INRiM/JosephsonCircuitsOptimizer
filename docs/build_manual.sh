#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p docs/.manual-build
if command -v rsvg-convert >/dev/null 2>&1; then
  rsvg-convert -f pdf -o docs/.manual-build/jco-logo.pdf docs/images/jco-logo.svg
elif command -v inkscape >/dev/null 2>&1; then
  inkscape docs/images/jco-logo.svg --export-type=pdf --export-filename=docs/.manual-build/jco-logo.pdf
else
  echo "Missing SVG-to-PDF converter: install librsvg2-bin (rsvg-convert) or Inkscape." >&2
  exit 1
fi
if [[ -f Project.toml ]]; then
  version="$(sed -n 's/^version = "\([^"]*\)"/\1/p' Project.toml | head -n1)"
  if [[ -n "$version" ]]; then
    printf '\\renewcommand{\\JCOversion}{%s}\n' "$version" > docs/manual_version.tex
  fi
fi
pdflatex -interaction=nonstopmode -halt-on-error -file-line-error -output-directory docs/.manual-build docs/JCO_Documentation.tex
pdflatex -interaction=nonstopmode -halt-on-error -file-line-error -output-directory docs/.manual-build docs/JCO_Documentation.tex
cp docs/.manual-build/JCO_Documentation.pdf docs/JCO_Documentation.pdf
echo "Generated docs/JCO_Documentation.pdf"
