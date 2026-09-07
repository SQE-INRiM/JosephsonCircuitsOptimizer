# AUD_20260831_006 — Results density and numeric-format fix

## Scope
Follow-up implementation for WI_20260831_006 / issue #25 after local validation of the compact Results redesign.

## Classification
T3 because the Linear 1D visualization carries scientific-analysis semantics. The optimizer, simulator, persisted `.jco` schema and stored numerical values are unchanged.

## Findings from local validation
- Point inspection was too far from the Linear Landscape interaction that selects the point.
- The implemented mean-metric line profile did not match the intended JCO `plot_1d_density_heatmap` diagnostic.
- MUI default number formatting rounded SI-scale optimizer parameters to visual zero on y-axis ticks and hover tooltips.

## Implemented changes
- Linear selector now exposes `Landscape`, `Correlation`, and `1D density`; Point data is rendered directly under Landscape.
- The stored-configuration table is hidden by default behind an explicit show/hide control to limit vertical scrolling.
- Linear density uses the persisted uniform Linear table and JCO's `sample_count / mean(metric)` raw weight.
- Per-parameter display normalization is `(weight - min(weight)) / (max(weight) - min(weight))`, clamped to `[0, 1]`; a constant finite weight set displays as 1. This preserves raw-weight ordering and avoids the negative-metric failure of dividing negative weights by their maximum.
- Density tooltips retain parameter value, raw count, mean metric, raw weighted count and normalized display value.
- Optimization Best objective and Parameter history use adaptive numerical formatting: ordinary decimal values remain readable while very small/large values use scientific notation.
- Optimization tooltips use the same formatter, so non-zero values are not presented as zero.
- Parameter-history values remain raw; only their textual formatting changed.

## Automated evidence added
`ConnectedResultsCompact.test.ts` now checks:
- raw JCO `count / mean(metric)` weights;
- negative-metric normalization remains bounded in `[0, 1]` and preserves expected ordering;
- repeated-value sample-count contribution;
- metric-inclusive correlation dimensions;
- scientific formatting of tiny non-zero values.

## Validation status
**Qualified.** Code and governance changes are recorded, but this environment has not executed `npm test`, `npm run build`, or a local Electron/Windows GUI session. The maintainer should perform those checks after merge or on the branch before treating runtime behavior as fully verified.

## Manual checks requested
1. Linear Landscape: click several cells and confirm Selected configuration/metrics update immediately below.
2. Linear 1D density: compare color ordering/tooltips with the corresponding uniform data and with legacy JCO expectations for a negative metric.
3. Optimization Best objective: verify y-axis ticks and hover show the actual metric values.
4. Optimization Parameter history: verify SI-scale values such as `Cg` display in scientific notation on y-axis and hover rather than `0`.
5. Run `npm test` and `npm run build`.
