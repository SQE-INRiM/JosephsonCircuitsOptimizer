# AUD_20261008_002: Julia dependency cleanup (qualified)

## Basis

- Windows Smart App Control enforcement was verified by Code Integrity event
  3077 for Julia DLL loads; the affected user subsequently confirmed native
  HDF5/JCO imports and a GUI simulation worked with Smart App Control disabled.
- Before this second-stage patch, the user reported 49 Vitest tests, 21 Node
  desktop tests and a successful `npm run build` on the lazy-plotting branch.

## Changes prepared

- Remove seven unused direct dependencies, preserving HDF5, numerical solver and
  optional legacy Julia plotting packages.
- Remove `JCO.plot`/`JCO.mplot` aliases, fix world-age/name collisions,
  and use explicit Plots/GLMakie entry points for standalone Julia scripts.
- Avoid allocating nonlinear-feedback convergence plots in GUI headless runs.
- Add a README security/compatibility troubleshooting note.

## Verification still required (not claimed)

- `Pkg.resolve()`/manifest review, imports and Julia plotting smoke test.
- `npm test` and `npm run build` following this second-stage change.
- GUI full-run and nonlinear-feedback-run validation after the changes.
- No numerical-equivalence claim until results are compared to a reference.

Status: **qualified / candidate** until above checks are recorded.
