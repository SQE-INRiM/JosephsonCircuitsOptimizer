# AUD_20260903_003 — Project file safety recovery

Date: 2026-09-03
Work item: `WI_20260903_003_project_file_safety`

## Classification

T2 — desktop project loading/saving safety. No numerical or persistent-schema change.

## Implementation

This branch selectively reuses the already-tested project-model changes from historical PR #50:

- required JSON loads fail instead of silently falling back to defaults;
- required circuit and metric source read failures are surfaced;
- Save preserves malformed existing configuration rather than overwriting it;
- empty optional Julia hook editors remove the corresponding files;
- focused Node tests cover malformed load, malformed save, and stale optional hook removal.

## Scientific/runtime boundary

No files under `runtime/` are changed. Solver, optimizer, circuit construction, source generation, cost/performance functions, sweep behavior, Results indexing, HDF5 schemas and the `.jco` project format are unchanged.

## Recovery baseline

Base: `dc67eb32e7ed1fb004ef1d1ec3f4c1c7c18324f6`, already validated on Windows with the ~2 s Linear simulation and active-run protection.

## Required verification before merge

- PR build check green;
- governance check green;
- normal project open/save succeeds on Windows;
- known simulation remains near the validated ~2 s Linear timing.
