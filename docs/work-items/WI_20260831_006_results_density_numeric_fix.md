# WI_20260831_006 — Results density and numeric-format fix

## Trigger
Local validation after PR #24 / commit `7b40c3c` exposed three Results issues:

1. Linear Point data was separated from the Landscape even though it is the direct detail view of the selected landscape point.
2. The requested Linear 1D view was JCO's `plot_1d_density_heatmap`, not a mean-metric line profile.
3. Optimization charts rendered small stored values (for example SI-scale capacitances) as visually zero on axes/tooltips.

Tracked by GitHub issue #25.

## Scope
- Keep Results compact while placing selected Point data directly below Linear Landscape.
- Replace Linear mean-metric line profiles with uniform-data JCO weighted-count density heatmaps.
- Preserve `count / mean(metric)` weighting but use bounded min-max display normalization so negative metrics do not create values above 1 or sign/clamping artefacts.
- Format Optimization metric and parameter chart axes/tooltips with adaptive scientific notation where needed.
- Preserve raw stored values and optimizer mathematics.

## Acceptance criteria
- Clicking a Linear 2D landscape cell updates the Point data shown immediately below it.
- 1D density displays all varying parameters side by side and tooltips expose raw parameter value, sample count, mean metric, raw weighted count and normalized display value.
- Negative-metric density normalization is always within `[0, 1]`.
- Non-zero small Optimization values are not displayed as `0` on the y-axis or tooltip.
- Best objective and Parameter history retain raw numerical data and an integer evaluation x-axis.
- Tests, ADR 002, audit and changelog are updated.

## Risk classification
T3: the weighting/display normalization is a scientific-analysis semantic refinement. No engine, optimizer, persistent schema or stored numerical data is modified.
