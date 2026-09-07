# AUD_20260827_003 — Run storage and timing

**Status:** qualified

## Subject

Implementation of the numerical-storage and Run-screen cleanup identified from real Chalmers 3WM `.jco` runs.

## Evidence reviewed

- Real completed full runs supplied by the maintainer showed working Linear → Optimization → HB execution and multi-point HB sweeps.
- Existing output folders confirmed that compact Linear/HB summary HDF5 tables were retained, while generic frequency-resolved traces were not.
- Existing Run UI source contained project-specific demo descriptions and a fake duration.
- The Julia progress helper already emits `PROGRESS_DONE stage=...`; the Electron parser previously ignored that event.

## Changes audited

- `runtime/bridge/gui_runtime_overrides.jl`
  - preserves existing summary HDF5 schemas;
  - writes separate Linear/HB trace HDF5 files;
  - stores complex fundamental S-parameters as paired real/imaginary datasets;
  - disables automatic plot/correlation image persistence for GUI-launched runs.
- `runtime/bridge/run.jl`
  - loads the GUI-specific runtime policy after importing JCO.
- `desktop/main.cjs`, `src/services/jcoAdapter.ts`, `src/store.ts`
  - propagate stage completion events and compute/display actual elapsed durations.
- `src/data/carthago.ts`, `src/screens/RunScreen.tsx`
  - remove misleading project-specific stage descriptions and unnecessary idle Current Run fields.
- Tests/documentation/changelog updated consistently.

## Static validation

- The exact committed `desktop/main.cjs` content was checked with `node --check` before upload.
- Run-screen test was updated for the neutral stage label.
- Store test now checks formatting of a backend-provided 67-second stage duration.
- GitHub Governance check completed successfully after the work-item commit.

## Qualification / unresolved validation

The execution environment used for this change does not provide Julia. Therefore this audit cannot certify that HDF5.jl writes the new trace schema correctly or that the overridden methods execute successfully against the installed JosephsonCircuits version.

A real desktop acceptance run is required. The run should verify:

1. full numerical pipeline still completes;
2. `linear_traces.h5` and `nonlinear_traces.h5` are created when applicable;
3. trace point counts and frequency lengths match the executed sweeps;
4. each saved `Sij` has matching `real` and `imag` arrays;
5. no new automatic plot PNGs are created;
6. Run-stage elapsed durations agree with observed Julia execution.

Until that evidence is collected, the change remains **qualified**, not failed. The existing successful-run evidence supports proceeding with integration while retaining this explicit validation gap.
