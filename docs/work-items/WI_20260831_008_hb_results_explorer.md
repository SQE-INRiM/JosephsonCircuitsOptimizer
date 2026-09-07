# WI 20260831 008 — Harmonic Balance Results explorer

## Goal
Turn Harmonic Balance Results into a point-addressable source-space explorer comparable to Linear Results, while preserving the nonlinear dataset's own semantics.

## Requested behavior
- Optimization Parameter history offers one selected parameter or `All parameters`.
- `All parameters` shows separate compact raw-value charts so incompatible parameter scales are not mixed.
- HB Landscape allows source frequency/amplitude coordinates on X/Y and exact fixed-value slicing over remaining source coordinates.
- HB points can be filtered by solver convergence: all, converged, or non-converged.
- Clicking an HB landscape point exposes its source coordinates, scalar nonlinear metrics, convergence state, device parameters and retained nonlinear arrays.
- Add an Amplitude response view for `performance` and `delta_quantity` versus the selected source amplitude while all other source coordinates are fixed explicitly.

## Scientific constraints
- HB source-space slicing is exact row selection only: no averaging, interpolation or projection.
- Convergence filtering uses the stored numeric `converged` column and does not reinterpret solver status.
- Source amplitudes are displayed in the stored units/values; the GUI does not derive electrical power without an explicit impedance/power definition in the dataset.
- `performance`, additional user-performance metrics and `delta_quantity` are displayed as persisted; no normalization is introduced.
- Optimizer parameter histories remain raw optimizer samples.

## Data/compatibility
- Expose `saved_data/nonlinear.h5` through the Results bridge as `savedNonlinear`; no `.jco` schema migration is required because the file already exists in current runs.
- Older runs without nonlinear retained data remain readable and simply show no retained arrays.

## Validation
- Unit-test exact HB slicing and convergence filtering.
- Run TypeScript tests and renderer build in pull-request CI.
- Windows/Electron runtime validation remains recommended with a real multi-source HB run.
