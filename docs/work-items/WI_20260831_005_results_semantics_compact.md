# WI_20260831_005 — Compact Results semantics split

## Goal
Separate circuit-analysis semantics from optimizer diagnostics while making the Results UI substantially more compact.

## Requirements
- Linear Results must derive correlation and 1D parameter-response analyses from the persisted uniform linear dataset (`run.linear`).
- Linear correlation should include the objective metric alongside varying parameters when available.
- Replace optimizer-derived `1D density heatmaps` with uniform-dataset `1D metric profiles` that summarize the metric over each parameter value.
- Optimization Results must use only persisted optimizer evaluations (`run.optimization`).
- Keep `Best sampled objective` in Optimization.
- Add a per-parameter history plot versus evaluation number, selected from a dropdown, without metric-weighting the parameter values.
- Reduce vertical scrolling by presenting one main analysis view at a time within each stage.
- Preserve Point Inspector / saved traces for Linear.
- Add tests for the data-reduction helpers and document the semantic change.

## Acceptance criteria
- No Linear diagnostic described as circuit/parameter analysis depends on optimizer sample density.
- Optimization parameter plots show raw sampled parameter values versus evaluation index.
- Results can switch between analyses without rendering every large plot in one vertical stack.
- Existing numerical storage schema remains compatible.
- Changelog and audit trail record the change.

## Tracking
GitHub issue: #22
