# AUD 20260831 008 — Harmonic Balance Results explorer

## Status
Qualified

## Scope
Implementation of WI_20260831_008: enhanced optimizer parameter history plus the first point-addressable Harmonic Balance Results explorer.

## Changes reviewed
- Optimization Parameter history now supports a single parameter or `All parameters`; all-mode renders separate raw-value charts.
- HB Results uses stored `source_i_frequency` / `source_i_amplitude` coordinates with exact slicing over hidden source coordinates.
- Convergence filter uses the persisted `converged` 0/1 column.
- HB Point data displays scalar nonlinear data and can load user-retained arrays from `saved_data/nonlinear.h5` by stable `point_id`.
- Amplitude response plots persisted `performance` and `delta_quantity` separately versus one selected source amplitude while every other source coordinate is fixed.
- Results bridge exposes the existing nonlinear saved-data catalog as `savedNonlinear`.
- Added pull-request test/build CI to catch TypeScript/build regressions before merge.

## Scientific integrity assessment
- No solver inputs, optimizer mathematics, JCO simulation numerics or persisted scalar values are changed.
- No conversion from source current amplitude to power is performed because the nonlinear summary table stores amplitude, not an impedance-defined power quantity.
- Higher-dimensional HB views are exact stored-row slices; there is no averaging/interpolation/projection.
- Performance and delta_quantity are not normalized or combined because they may have incompatible units/scales.

## Automated evidence
- Added unit tests for exact HB slicing and all/converged/non-converged filtering.
- Pull-request CI is configured to run `npm test` and `npm run build`.

## Remaining validation
- Windows/Electron interaction should be checked on a real HB run with multiple swept source coordinates, both convergence states if available, and retained nonlinear arrays.
- The preferred visual density of `All parameters` may need adjustment after testing on a larger optimizer history.

Pending runtime checks qualify the audit; they do not imply a numerical-model change or `.jco` migration.
