# WI_20260831_004 — Optimizer history and JCO density Results

Status: in progress
Risk tier: T2

## Goal

Make Optimization Results use actual surrogate-optimizer evaluations and reproduce the original JCO `plot_1d_density_heatmap` diagnostic without presenting statistically underdetermined diagnostics as meaningful results.

## Findings

- The previous Optimization tab reused `run.linear`; no separate BO evaluation table was persisted.
- `CostModule.cost_history` already records parameter vectors and metrics for every evaluated point.
- After the Linear sweep, new entries appended during `surrogate_optimize!` are the BO-only evaluation history.
- A balanced Cartesian Linear grid naturally gives Pearson correlation near/exactly zero between independently swept coordinates; this is not a measure of parameter importance.
- With only two optimizer evaluations, Pearson correlation between two varying parameters is necessarily ±1 when both vary, so a full-looking heatmap is mathematically valid but visually misleading.
- The original JCO density weighting is retained; the GUI should not invent additional smoothing/binning merely to make sparse optimizer data look more structured.

## Acceptance criteria

1. New optimized runs persist BO-only evaluations to `df_optimization_analysis.h5`.
2. Results exposes that table as `run.optimization` and the Optimization tab does not fall back to Linear data.
3. Best sampled objective uses optimizer evaluation number and BO metrics only.
4. Best sampled objective visibly renders integer evaluation values on the X axis.
5. Parameter correlation is Pearson r between varying optimizer parameters only.
6. Parameter correlation is withheld with an explicit sparse-data message when fewer than three optimizer evaluations are available.
7. The previous Objective profile curves are removed.
8. 1D density heatmaps implement the original JCO weighting: count / mean(metric), normalized by maximum weight, with 0–1 display color range.
9. 1D density heatmaps are withheld with an explicit sparse-data message when fewer than three optimizer evaluations are available.
10. Explanatory implementation commentary such as `Faithful to JCO plot_1d_density_heatmap` and the correlation co-sampling disclaimer is removed from the normal Results UI.
11. Older runs without persisted optimization history show an explicit compatibility message rather than misleading Linear diagnostics.

## Current implementation branch

`fix/optimization-results-diagnostics`

The branch preserves the original JCO density transform, adds sparse-sample guards, removes the requested explanatory prose, and configures the Best sampled objective X axis as an integer evaluation axis.
