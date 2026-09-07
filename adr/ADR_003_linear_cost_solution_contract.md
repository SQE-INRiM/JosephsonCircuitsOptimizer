# ADR_003 — Linear cost receives the JosephsonCircuits solution

- Status: accepted
- Date: 2026-09-01
- Scope: JCO engine integration / user cost API

## Context

Historically the linear optimization path called `linear_simulation(...)`, reduced the JosephsonCircuits harmonic-balance solution to a zero-mode `Dict{(i,j)=>Sij}`, and passed only that dictionary to `user_cost`. The nonlinear `user_performance` hook already receives the full JC solution object.

The reduced dictionary is convenient for ordinary two-port metrics but prevents a cost function from using other solution information exposed by JosephsonCircuits. Extending a GUI-specific S abstraction for every future JC quantity would unnecessarily narrow the engine API.

## Decision

New linear cost code receives the full JosephsonCircuits solution object:

```julia
function user_cost(sol, device_params_set, nonlinear_correction)
    S21 = sol.linearized.S((0,), 2, (0,), 1, :)
    # ...
end
```

The linear evaluation performs one harmonic-balance solve. The solution is passed directly to `user_cost`.

The existing `linear_simulation(...)` and `extract_S_parameters(...)` functions are retained. They remain the explicit legacy/convenience path for callers that want the reduced zero-mode S-parameter dictionary.

GUI-only trace persistence may call `extract_S_parameters(sol, port_count)` on the already-computed solution. It must not launch an additional simulation.

## Consequences

- `user_cost` can use the same JC solution surface as `user_performance`, including non-zero mixing modes and other solution data supported by JC.
- Existing user cost files that index the first argument as `S[(i,j)]` require migration. This is an intentional user-code contract change and is not hidden by exception-driven fallback.
- The numerical solver settings and objective mathematics are unchanged by this decision.
- Shipped examples should migrate to `sol`; legacy S extraction remains available when useful.

## Validation requirement

Because this is a T3 scientific/interface change, validation must confirm that a migrated cost reproduces the previous zero-mode metric values for the same circuit/settings and that each evaluation still performs a single HB solve.
