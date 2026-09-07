# Repository Status

Last governance refresh: 2026-08-31

## Current development baseline

- Repository: `emanuele-palumbo/JCO-GUI`
- Primary branch: `main`
- Historical governance branch: `governance/baseline`
- Application stack: Electron/React desktop GUI with Julia/JCO bridge and `.jco` project container.
- PR #20 (`fix/cost-history-vector-recording-2`) was squash-merged into `main` at `4f37fdc04c5b083198a1f659ea581bd202b68647` on 2026-08-31.
- Active follow-up: PR #21 from `fix/optimization-results-diagnostics` refines sparse Optimization Results presentation without changing optimizer mathematics or the original JCO density weighting.

## Governance state

Governance is intentionally lightweight and advisory. Start with `AGENTS.md` and this status file; consult work items/audits when relevant. Qualified audits record pending local verification without blocking integration.

## Current functional state

The run/storage pipeline and current Linear/Optimization Results slices are integrated into `main`:

- completed runs remain available in Results while setup values change or another run executes;
- inactive stored runs can be deleted from Results with confirmation;
- Results treats `currentRunId` as active only while the global run state is actually running;
- Results avoids continuous full Julia/HDF5 polling during active simulations and provides manual `Refresh results`;
- the Run screen distinguishes `Run remaining` (reuse valid earlier stages) from `Run all` (fresh Linear → Optimization → HB);
- Linear Results support masked 1D/2D views, resolved circuit parameters, point-addressable retained arrays, custom X vectors, persistent trace selections and CSV export;
- every GUI-created output folder updates `CURRENT_OUTPUT_PATH[]`;
- optimizer evaluations are persisted separately in `df_optimization_analysis.h5`, with `simulation_info/optimization_persistence.json` diagnostics;
- root cause of the previously missing optimizer history was identified from a supplied completed workspace: `cost_history["params_vecs"]` expects `Vector{Float64}` entries while tuple-like optimizer coordinates were recorded using `Float64.(vec)`, preserving the tuple container; the failed push was hidden by an empty catch and left all history arrays empty;
- the desktop bridge now records coordinates with `collect(Float64.(vec))` and warns on unexpected history-recording failures, without changing simulation or optimizer mathematics;
- Optimization Best sampled objective, Pearson parameter correlation and original JCO-style 1D density heatmaps consume BO-only evaluations when persistence succeeds.

On PR #21 / `fix/optimization-results-diagnostics`:

- Best sampled objective uses an explicit integer evaluation X axis;
- correlation and 1D density diagnostics are not rendered as meaningful plots when fewer than three optimizer evaluations are available;
- the original density transform remains count / mean(metric), normalized by maximum weight;
- implementation-oriented explanatory text requested for removal is no longer shown.

`AUD_20260831_004` and `AUD_20260831_008` remain `qualified`: static review is recorded, while build/runtime validation and one fresh local Windows/Julia `Run all` are still required for end-to-end confirmation.

## Recovery rule

For multi-session work, record only what is needed to resume safely: last verified commit, current state, next safe action, checks already run and important open findings.

## Next useful action

1. Validate PR #21 with `npm run build` if a build-capable checkout/CI becomes available.
2. Run a small fresh `Run all`. For the 2×2 Linear seed and optimizer settings of 2 iterations × 2 samples, `optimization_persistence.json` should report 4 initial evaluations, 8 total cost evaluations, 4 BO evaluations and `hdf5_written=true`.
3. Confirm that `df_optimization_analysis.h5` populates four BO rows, Best sampled objective shows evaluation numbers, and correlation/density plots are non-uniform when the underlying optimizer samples actually support that structure.
