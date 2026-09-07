# WI 20260901 001 — HB saved-data X axis and multi-run deletion

## Goal
Improve Results usability in two places without changing stored scientific data:

1. allow Harmonic Balance retained arrays to use another retained array as the plotted X axis, matching the capability already available in Linear point data;
2. allow multiple stored runs of one project to be selected and deleted in one user action.

## Acceptance criteria
- HB point data exposes `Automatic · stored frequency/index` plus every retained array as X-axis choices.
- A custom retained X axis is applied only when its sample count matches the plotted Y trace; otherwise the trace keeps its canonical stored axis and the GUI says why.
- Complex retained arrays keep magnitude/real/imaginary/phase selection.
- Multi-run management is available independently of the selected Results stage.
- The active running simulation cannot be selected for deletion.
- Multi-run deletion requires one explicit confirmation and reports partial completion if an individual deletion fails.
- Existing `.jco`, summary HDF5 and saved-data schemas are unchanged.

## Risk classification
T2: user-visible Results behavior and destructive run management, but no change to numerical simulation or persistent schema.
