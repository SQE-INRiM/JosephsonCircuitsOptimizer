# WI_20261008_002: Julia dependency cleanup and Windows guidance

Tier: T2 (dependency/GUI scientific execution path); scientific output validation required before merge.

## Goal

Reduce nonessential direct Julia dependencies and keep legacy numerical/plotting
semantics. Prevent GUI nonlinear-feedback runs from constructing convergence
plots merely to discard them. Document independently observed Windows Smart App
Control restrictions on Julia's native package dependencies.

## Scope

- Remove only direct dependencies with no explicit references in tracked JCO
  scientific/runtime source: `ColorSchemes`, `HDF5_jll`, `LsqFit`, `Measures`,
  `Polynomials`, `Revise`, `Roots`. Their functionality remains available as
  transitives where needed; custom user scripts may need to add them explicitly.
- Preserve `HDF5`, `GLMakie`, `Makie`, `Plots` and other numerical or legacy
  plotting packages for now. The two generic aliases (`JCO.plot` and
  `JCO.mplot`) are intentionally removed; direct users call the upstream
  plotting packages explicitly instead.
- Keep the prior lazy-plotting refactor; skip convergence figure creation in GUI
  nonlinear-feedback cycles as for existing GUI plot suppression.
- Explain Smart App Control as a security compatibility issue, not a JCO error.

## Acceptance checks

1. On the already patched feature branch, apply patch `--check`, then apply.
2. Run `Pkg.resolve(); Pkg.instantiate()` to sync `Manifest.toml`.
3. Verify `using HDF5` and `using JosephsonCircuitsOptimizer`; verify `_jco_plotting_initialized[] == false` on import.
4. Validate lazy diagnostics through `_jco_plot_correction_convergence`, including world-age and plotting-loader state.
5. `npm test`, `npm run build`, `git diff --check`.
6. Manual GUI full run including Linear, Optimization, HB, and optionally a
   nonlinear-feedback iteration; inspect HDF5 results and compare numerical data
   to a known reference. Do not claim scientific equivalence based solely on tests.

## Known limits

- `HDF5` still needs its platform-native binaries and can be blocked by Windows
  Smart App Control. This change does not make those binaries trusted.
- Graphics remain direct dependencies for the existing Julia plotting API;
  trimming them further would require a separate optional package architecture.
- Julia `Pkg.resolve()` may rewrite `Manifest.toml`; inspect the diff before commit.
