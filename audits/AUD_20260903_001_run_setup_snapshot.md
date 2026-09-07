# AUD_20260903_001 — Run setup snapshot in Results

Date: 2026-09-03
Work item: `WI_20260903_001_run_setup_snapshot`

## Classification

T2 — user-visible Results/provenance feature.

## Reviewed implementation

- `runtime/bridge/results.jl` reads four JSON files from each existing `inputs_snapshot/` and exposes them as `setupSnapshot` in the Results payload.
- `src/components/RunSetupSnapshot.tsx` adds a compact `View run setup` control and a read-only dialog for a selected historical run.
- The dialog shows one category at a time with Device parameters, Sources, Simulation, and Optimizer tabs.
- Stored dictionaries are presented as variable/value rows; original variable names and stored values are preserved without unit conversion or reinterpretation.
- `src/screens/ResultsScreen.tsx` places the setup control in the Results toolbar instead of adding a permanent full-width Results section.
- `src/types.ts` adds the additive Results payload typing.
- Focused tests check that source values remain tied to the selected run and that dictionary presentation does not modify values.

## Scientific and runtime boundary

No simulation path was intentionally changed. In particular this work does not modify:

- `desktop/main.cjs` run startup;
- `runtime/bridge/run.jl`;
- runtime simulation overrides;
- vendored JCO solver/optimizer code;
- source construction or unit conversion;
- HDF5 writers or existing `.jco` project format.

The only Julia change is in `results.jl`, which is invoked when Results are indexed/read.

## Compatibility

Historical runs without `inputs_snapshot/` remain readable; their setup snapshot is reported as unavailable. The Results schema identifier remains `jco.results/4` because this is an additive optional field.

## Required verification before merge

- repository test/build CI green;
- governance CI green;
- manual Windows test on the same known project: simulation timing remains approximately the verified ~2 s Linear baseline;
- confirm that changing current Setup does not alter the displayed snapshot of an older run;
- confirm the setup dialog remains compact and does not introduce a permanent scrolling section in Results.
