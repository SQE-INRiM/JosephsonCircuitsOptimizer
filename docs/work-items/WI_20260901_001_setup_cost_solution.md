# WI_20260901_001 — Expose JC solution to linear cost

## Goal

Change the linear `user_cost` contract so new GUI/JCO projects receive the JosephsonCircuits harmonic-balance solution object (`sol`) rather than only the reduced zero-mode S-parameter dictionary.

Keep the existing `linear_simulation(...)` / `extract_S_parameters(...)` behavior available for code that still needs the legacy dictionary representation. Do not run a second simulation merely to expose `sol`.

## Classification

T3 — scientific/user-code interface change. The numerical solver and objective mathematics must remain unchanged; only the object exposed to `user_cost` changes.

## Acceptance criteria

- `user_cost(sol, device_params_set, nonlinear_correction)` receives a JC solution exposing `sol.linearized` / other JC solution functionality.
- The linear cost path performs one HB solve per evaluation.
- Existing `linear_simulation(...)` remains available and continues returning the legacy S dictionary.
- Shipped default/example cost files use the new `sol` contract.
- GUI bridge overrides use the same solution-based contract and retain legacy S trace capture by extracting S from the already-computed solution.
- Metric extraction/history behavior is unchanged.
- Static/tests are run where available; Windows/Julia end-to-end validation is recorded separately if not executable here.

## Compatibility note

Existing external `.jco` projects whose `user_cost` body indexes its first argument as `S[(i,j)]` need migration to `sol.linearized.S(...)` (or may explicitly derive legacy S data where appropriate). This intentional contract change is documented rather than hidden behind runtime exception fallback.
