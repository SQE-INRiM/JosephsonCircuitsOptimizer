# WI_20260831_003 — Optimization Results refinement

Status: implemented, validation qualified
Risk tier: T2

## Goal

Refine Optimization Results using the scientific intent of the original `Analysis_plots.jl` while keeping the GUI interpretation explicit.

## Requested behavior

- Stored-configuration parameter cells should show post-`create_circuit(...)` resolved values when available, matching the selected-point inspector.
- Best sampled objective should be a simple running-minimum line with evaluation number on X and no filled area/legend clutter.
- Correlation matrix should contain changing design parameters only: no `point_id`, metrics or constant parameters.
- Correlation label must match the coefficient actually computed.
- Reintroduce the original JCO one-dimensional parameter analysis in a clearer GUI form.

## Implementation

- `TablePreview` overlays `resolvedParameters[point_id]` onto parameter columns while leaving stored metrics and `point_id` unchanged.
- Optimization varying parameters are inferred from columns between `point_id` and `metric`, then constant columns are removed.
- Parameter correlation uses the Pearson product-moment coefficient directly from paired finite samples; the colorbar is labelled `Pearson r`.
- Best sampled objective is the cumulative minimum over finite, unmasked objective evaluations, shown as a line against 1-based evaluation number.
- The original `Analysis_plots.jl` 1D density routine was reviewed. It grouped samples by parameter value, computed sample count and mean metric, then visualized a normalized `count / mean(metric)` weight. Because that weighting becomes difficult to interpret for negative objectives, the GUI instead exposes the underlying scientifically useful quantities directly: mean objective versus each sampled parameter value, with per-value sample-count information.

## Acceptance criteria

1. Stored configuration parameter values match the resolved selected-point values for new runs.
2. Best objective has no filled area and X is labelled `Evaluation number`.
3. Correlation contains only varying parameter names and is labelled `Pearson r`.
4. Constant parameters, `point_id`, `metric` and other scalar metric columns do not appear in the parameter-correlation matrix.
5. Each varying parameter gets a 1D mean-objective profile.
6. Mask-sentinel objective values are excluded from optimization histories/profiles.
