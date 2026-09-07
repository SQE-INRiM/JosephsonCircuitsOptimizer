# AUD_20260831_003 — Optimization Results refinement

Status: qualified
Date: 2026-08-31
Related work item: `WI_20260831_003_optimization_results_refine.md`

## Scope reviewed

- `src/components/ConnectedResults.tsx`
- reference behavior in `runtime/jco/src/Analysis_plots.jl`

## Findings

- The existing GUI correlation formula is Pearson's product-moment correlation coefficient: centered pair products divided by the product of centered Euclidean norms.
- The original JCO correlation view removed `metric` and constant columns, but did not explicitly distinguish identifiers/derived columns. The GUI refinement restricts correlation to varying parameter columns only, thereby excluding `point_id`, constant parameters and metric outputs.
- The original 1D density plot groups samples by parameter value and uses both sample count and mean metric through a normalized `count / mean(metric)` weight. For negative objectives this quantity is not a transparent importance measure. The GUI therefore shows the underlying mean objective versus parameter value and discloses sample counts instead of reproducing the ambiguous weight literally.
- Resolved post-circuit parameter snapshots are used for Stored configurations display when available; canonical table metrics and sweep bookkeeping are not rewritten.
- Mask-sentinel objective values (`>= 1e8`) are excluded from the optimization history and objective profiles.

## Validation limitation

Static repository review only. The local TypeScript/Vite build and a real Windows/Julia optimization run are still required before this audit can be marked passed.
