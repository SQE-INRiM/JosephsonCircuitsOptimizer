# AUD_20260901_001 — Linear cost solution contract

Status: **qualified**

## Scope

Review and partial Windows/Julia validation of `WI_20260901_001` / `ADR_003` on branch `feat/setup-cost-sol` (PR #36).

## Findings

- The historical `linear_simulation(...)` implementation remains unchanged and continues to return the reduced zero-mode S-parameter dictionary.
- The new `linear_solution(...)` cost helper uses the same source construction and `hbsolve(...)` arguments as the current linear simulator and returns the resulting JC solution object directly.
- `sim_sys(...)` now returns that solution and `cost(...)` passes it to `user_cost(sol, ...)`.
- GUI Results trace retention extracts legacy S data from the already-computed solution only when full trace retention is enabled; this does not launch a second HB solve.
- The GUI cost-history override also passes `sol`, while retaining the existing `collect(Float64.(vec))` persistence fix.
- The default runtime template and active `chalmers_3wm` example are migrated to direct `sol.linearized.S(...)` access.
- A Windows/Julia GUI run on 2026-09-01 reached `user_cost(sol::JosephsonCircuits.HB, ...)`, confirming that the runtime now passes the full JC harmonic-balance solution object into the linear cost hook.
- The same run then failed on a stale active-project reference to the old variable `S`; this is a project-code migration issue, not a failure of the new runtime contract.
- No PR-triggered GitHub Actions workflow was available for the PR head at review time.

## Qualification / remaining validation

The central runtime interface is validated: `user_cost` receives `JosephsonCircuits.HB` rather than the legacy S dictionary.

Still recommended after integration:

1. run a complete migrated Chalmers Linear sweep and compare objective values with the pre-change implementation for identical inputs;
2. migrate the remaining bundled legacy examples (`carthago`, `carthago_loss_spread`, `carthago_impedance`) before presenting all bundled examples as compatible with the new cost contract;
3. update changelog/repository status as subsequent Setup work is integrated.

PR #36 may be merged with these limitations explicitly retained in this audit.
