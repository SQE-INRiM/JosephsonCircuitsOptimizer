# WI 20261103 001 — Simplified Run and staged dependency safety

**Status:** implementation on `gui/run-refinements` (pending CI and Windows/Julia validation)
**Risk tier:** T2 GUI/run orchestration with scientific provenance checks

## Goal

Replace `Run remaining` and the arbitrary stage dropdown with a fresh `Run` and
one contextual next-stage action in Linear → Optimization → Nonlinear order.
Do not include nonlinear-feedback iterations.

## Rules

- Full Run always invokes the existing full JCO pipeline, independent of completed statuses.
- Contextual Run selects the earliest non-completed stage and skips Optimization for
  a single device configuration. The existing Julia modes remain authoritative.
- Device, circuit, cost, baseline drive and linear simulation changes invalidate Linear
  and downstream stages; optimizer-only changes invalidate Optimization/HB; nonlinear
  source amplitude or nonlinear solver changes invalidate HB.
- A stale stage cannot be marked completed simply by refreshing older Results.
- A partial Optimization or HB run is rejected unless the latest run has its required
  scientific files and matching source snapshots (device parameters, linear drives,
  linear simulator configuration, Julia source/calibration files; optimizer settings for
  an HB run requiring optimization).
- For fixed device configurations, the Linear-only output writes a matching
  `optimal_device_parameters.json` in the desktop bridge, not in the upstream engine.
- Every stage continues to produce its own output folder. Optimization-only and
  HB-only JCO modes copy their input Linear dataset into their new output.

## Verification

- Vitest: stage ordering, dependency invalidation and contextual Run buttons.
- Node: current-vs-saved input comparison, optimizer-only versus HB-only reuse,
  changed Linear inputs, missing data, single-point skip.
- CI: `npm test` and `npm run build` in `gui/` and governance check.
- Pending real desktop acceptance: full Run, Linear→Optimization→HB, single-point
  Linear→HB, changed optimizer configuration (reuse Linear), changed pump amplitude
  (reuse Linear/Optimization), changed device parameter (force Linear), cancel/restore
  and reopen saved `.jco` projects. No scientific Julia execution is claimed here.

## Limitations

The renderer's in-memory status is contextual; the desktop provenance guard is
authoritative. On reopening a project with older saved results, the visible next-stage
label may be optimistic until preflight checks saved inputs; the guard fails closed
with instructions to rerun Linear. Reconstructing stage validity across all prior
runs and modified/restored saved projects can be improved separately without
changing the engine.
