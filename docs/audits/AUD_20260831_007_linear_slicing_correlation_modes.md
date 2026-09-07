# AUD 20260831 007 — Linear slicing and correlation modes

## Status
Qualified

## Scope
Implementation of WI_20260831_007 in compact Results.

## Changes reviewed
- Linear Landscape now supports two-axis views of sweeps with 2+ varying parameters by exact filtering of every non-axis parameter.
- Fixed-value selectors are populated only from values actually stored in the uniform Linear table.
- Point selection is brought back into the active slice whenever X/Y or fixed coordinates change.
- Correlation defaults to varying parameters only (`None`) and can include every stored scalar metric (`Metrics`).
- Existing JCO 1D density semantics, optimizer diagnostics, retained-data behavior and stored numerical values are unchanged.
- ADR 002 and helper tests were updated.

## Scientific integrity assessment
- Exact slicing preserves the coordinates of the persisted uniform sweep; there is no averaging, interpolation, optimizer-derived weighting or hidden projection.
- Correlation continues to use only the uniform Linear dataset.
- The `Metrics` option exposes parameter–metric and metric–metric Pearson correlations but does not claim causality or parameter importance.

## Validation evidence
- Added helper tests covering an explicit 3-parameter uniform table and verifying the selected fixed-coordinate slice.
- Added helper tests verifying parameter-only and parameter+all-metrics correlation dimensions.
- Existing density/number-format helper tests remain in place.
- Repository Governance check passed on PR #28.

## Remaining validation
- `npm test` and `npm run build` have not been executed in this tool environment.
- Electron/Windows runtime validation is pending on a real saved run with at least three varying Linear parameters.

These pending checks qualify the audit but do not alter the intended semantics or require a `.jco` migration.
