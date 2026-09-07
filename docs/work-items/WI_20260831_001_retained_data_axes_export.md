# WI_20260831_001 — Retained-data axes and export

Status: implemented, validation qualified
Risk tier: T2

## Goal

Refine the Linear Results selected-point workspace after real GUI use.

## Requested behavior

- Plain `save_data(S21)` should retain the source variable name `S21` without requiring duplicated filename/prefix keywords.
- Retained vectors from one selected point may be plotted together.
- A retained vector may be selected as the X axis for other compatible retained vectors.
- Automatic frequency use remains the default when vector length matches the stored common `frequency_hz` axis.
- A selected trace plot can be exported as a graph and as numerical CSV data including its X vector.
- Do not add cross-point overlays in this increment.

## Implementation

- GUI-only Julia include transform adds missing filename/prefix keywords to simple `save_data(symbol)` / `save_datas(symbol)` expressions before user metric code is evaluated. Explicit naming remains authoritative.
- Results offers an X-vector selector populated from the selected point's retained arrays; custom-X plots only combine equal-length vectors.
- Complex vectors remain selectable as magnitude/real/imag/phase for Y data; a complex vector used as X defaults to magnitude.
- Each generated trace chart can export SVG and CSV. Frequency plots display GHz but CSV retains raw `frequency_hz` values.
- Existing stored runs are not rewritten or renamed.

## Acceptance criteria

1. A new run containing `save_data(S21)` catalogues and labels the retained quantity as `S21`.
2. Multiple same-length saved Y arrays can share one automatic frequency plot.
3. A saved real vector can be selected as X and equal-length selected Y vectors are replotted against it.
4. Length-incompatible vectors do not get silently paired with the custom X vector.
5. SVG export reflects the currently shown trace graph.
6. CSV export contains the current X values plus every curve shown on that graph; frequency export uses Hz.
7. Existing `save_datas` and explicit `filename=` calls remain compatible.

## Validation

Static repository/diff review only in the agent environment. A local TypeScript/Vite build and a fresh Windows/Julia/HDF5 run are still required.
