# AUD 20260901 001 — HB saved-data X axis and multi-run deletion

## Status
Qualified

## Scope
Implementation of WI_20260901_001.

## Changes reviewed
- Harmonic Balance retained-array plotting now supports an explicit X-axis source chosen from arrays saved for the same point.
- Automatic stored frequency/index remains the default.
- Custom X arrays are used only for Y traces with the same sample count; incompatible traces fall back to their canonical axis with a visible warning.
- Complex HB arrays retain magnitude, real, imaginary and phase views.
- A stage-independent run manager supports selecting and deleting multiple stored runs with one confirmation.
- The active run is excluded from destructive selection.
- Multi-run deletion reuses the existing validated single-run delete operation sequentially and reports partial progress if a later deletion fails.

## Scientific integrity assessment
The change does not alter simulation outputs or transform numerical values. Selecting a retained array as X only changes plot coordinates when the arrays have the same number of samples. No interpolation or resampling is introduced.

## Validation evidence
- Added a unit test for custom-axis length compatibility.
- Existing PR CI is expected to execute the full Vitest suite and TypeScript/Vite build.

## Remaining validation
- Manual Windows/Electron validation with a real HB point containing at least two retained arrays is pending.
- Manual deletion of multiple disposable runs from a saved `.jco` project is pending.

These remaining checks qualify the audit but do not require a project-format migration.
