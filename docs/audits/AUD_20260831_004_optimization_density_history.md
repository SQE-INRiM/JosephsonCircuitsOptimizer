# AUD_20260831_004 — Optimizer history and density Results

Status: qualified
Date: 2026-08-31
Type: change
Tier: T2
Branch: `fix/optimization-results-diagnostics`

## Scope reviewed

- BO-only evaluation persistence from `cost_history`.
- Results bridge/type exposure as `run.optimization`.
- Optimization tab routing to the optimization table instead of the Linear table.
- Pearson parameter-correlation selection and sparse-sample behavior.
- Original JCO 1D density weighting and visualization.
- Best sampled objective evaluation-axis presentation.

## Static findings

- `cost_history` contains the completed Linear evaluations before BO starts; the implementation snapshots that history length and persists only later evaluations.
- Persisted columns are `evaluation`, optimization parameter columns, and `metric`.
- The Optimization view excludes `evaluation` and `metric` from parameter correlation and removes constant parameters.
- Pearson r implementation remains the centered-product numerator divided by the product of centered Euclidean norms.
- Two varying points necessarily produce an apparent |r| = 1; the branch therefore withholds the correlation matrix until at least three optimizer evaluations are available instead of rendering a statistically underdetermined full-looking matrix.
- Density weighting remains the established JCO transform: value count divided by mean metric, then normalized by the maximum weight. No smoothing or binning was introduced merely to create visual variation.
- The density view is withheld below three optimizer evaluations because a two-point result is visually uninformative and was the source of the reported uniform display.
- The requested implementation-oriented prose was removed from both optimization diagnostic cards.
- Best sampled objective now explicitly uses a linear integer evaluation axis, requests one-evaluation minimum tick spacing, and reserves bottom margin for the axis label/ticks.
- Old runs cannot reconstruct BO evaluations because this history was not previously persisted; they continue to report that limitation rather than using Linear data.

## Verification performed

- Reviewed the branch diff against `main`: only `src/components/ConnectedResults.tsx` plus this work-item/audit documentation are changed.
- Static review confirms the original density weighting formula remains intact and that sparse-sample guards do not alter persisted numerical data or optimizer mathematics.

## Pending validation

- `npm run build` / TypeScript-Vite build in CI or a local checkout.
- Fresh Windows/Julia optimization run confirming `df_optimization_analysis.h5` is written/read with the expected number of BO evaluations.
- Visual confirmation that Best sampled objective displays integer X-axis evaluation numbers in the packaged GUI.
- Visual comparison of density strips against original JCO/Makie output for the same sufficiently populated optimizer dataset.

The audit remains `qualified` because those runtime/build checks have not yet been observed for this branch.
