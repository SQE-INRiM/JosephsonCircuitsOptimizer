# ADR 002 — Separate uniform-space analysis from optimizer diagnostics

## Status
Accepted

## Context
JCO-GUI previously displayed a Pearson parameter-correlation matrix and JCO-style 1D density heatmaps inside Optimization Results. Those views were computed from `run.optimization`, so their structure depended on where the optimizer chose to sample. That makes them unsuitable as neutral diagnostics of the underlying circuit parameter space.

The intended scientific interpretation is different:

- the uniform Linear sweep describes the sampled circuit landscape and should be the source for parameter/metric analysis;
- optimizer evaluations describe the search process and should be used only for optimizer diagnostics.

A first compact Results implementation replaced the JCO 1D density view with mean-metric line profiles. Local review clarified that the desired Linear diagnostic is instead the existing JCO `plot_1d_density_heatmap` semantics, but evaluated on the uniform Linear dataset rather than optimizer samples.

Higher-dimensional uniform sweeps also require an explicit way to inspect a two-dimensional section without averaging over the remaining coordinates.

## Decision
1. Linear Results is the source of circuit-space analysis.
2. Pearson correlation is computed from the persisted uniform Linear table. Its default `None` mode displays varying parameters only. The optional `Metrics` mode adds every stored scalar metric column to the same matrix. Correlation remains a descriptive Pearson diagnostic, not a causal importance measure.
3. Linear Landscape supports any uniform sweep with at least two varying parameters by selecting two parameters as X and Y and fixing every other varying parameter to an explicitly selected stored value. The displayed heatmap is an exact slice of stored rows; JCO-GUI does not average, interpolate, project, or otherwise collapse the fixed dimensions.
4. When the Landscape slice changes, Point data follows a point contained in the active slice so the inspector remains consistent with the visible heatmap.
5. Linear 1D density analysis preserves the JCO weighting definition for each parameter value: `weighted_count = sample_count / mean(metric)`. The displayed weight is normalized to `[0, 1]` with min-max normalization across the finite weighted counts for that parameter. This replaces division by the maximum alone, which can produce sign/clamping artefacts for negative objectives while preserving the ordering of the original weighted-count quantity.
6. The 1D density view uses only the uniform Linear table. It therefore does not encode optimizer sampling behavior even though it retains JCO's count contribution.
7. Optimization Results contains optimizer diagnostics only: best sampled objective and raw sampled parameter history versus evaluation number.
8. Parameter-history values are never metric-weighted or normalized.
9. Results presents one principal analysis view at a time to reduce vertical scrolling. The selected Point data is colocated directly below the Linear Landscape because it is the immediate detail view of the clicked landscape cell.

## Consequences
- Correlation/density views no longer encode optimizer sampling density.
- High-dimensional Linear landscapes remain inspectable as explicit 2D slices while preserving the meaning of the other parameter coordinates.
- Correlation starts with a compact parameter-only matrix; users can deliberately include all metrics when they need parameter–metric and metric–metric correlations.
- Linear density plots remain directly comparable in meaning to JCO's existing `plot_1d_density_heatmap`, with bounded display normalization that works for negative metrics.
- Optimizer-specific sampling-density diagnostics may be added later, but must be explicitly labeled as optimizer behavior.
- Optimization chart formatting may use scientific notation for very small or large stored values; this changes presentation only, never the stored parameter or metric values.
- No `.jco` schema or numerical engine change is required; these are presentation/analysis-semantics changes over already persisted tables.

## Validation expectations
- Automated helper tests should verify exact fixed-coordinate slicing, JCO `count / mean(metric)` weighting, bounded normalization for negative metrics, and both correlation dimension modes.
- Formatting tests should verify that small non-zero optimizer values remain visibly non-zero.
- GUI build/runtime validation should confirm X/Y selection, fixed-coordinate selectors, landscape-to-point consistency, correlation `None`/`Metrics` switching, retained Point data behavior, optimizer chart tooltips, and view switching.
- Scientific validation must not claim that Pearson correlation or weighted-count density is a causal or complete parameter-importance measure.
