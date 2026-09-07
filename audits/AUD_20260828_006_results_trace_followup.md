# AUD_20260828_006 — Results trace and resolved-parameter follow-up

Status: **qualified**

## Scope reviewed

- removal of synthetic Results fallback states;
- Linear heatmap axis rendering;
- resolved post-`create_circuit(...)` parameter persistence;
- selected-array naming follow-up;
- on-demand HDF5 saved-trace reader and Electron bridge;
- retained-array plotting in the selected-point inspector.

## Checks actually performed

- Reviewed the repository operating contract and current recovery status before editing.
- Compared the feature branch against `main` and reduced unrelated formatting churn in `desktop/main.cjs`.
- Verified that existing Optimization and Harmonic Balance Results code remains in `ConnectedResults.tsx` rather than being intentionally redesigned.
- Verified from `CostModule.jl` that user metric code is included inside the `JosephsonCircuitsOptimizer` module, so the GUI-defined `@save_datas` macro is in the same module scope before user metrics are loaded.
- Verified the new resolved-parameter snapshot is captured after `create_circuit(...)` and stored separately from the sweep-coordinate table.
- Verified the on-demand trace reader chooses `frequency_hz` only when its length exactly matches the requested saved array, otherwise returning a generic integer index axis.

## Limitations / follow-up validation

- Julia is not available in the agent execution environment, so no new HDF5 file was generated or read end to end.
- No GitHub Actions workflow is available for this repository, and the private repository cannot be cloned into the execution container here, so `npm run build` / TypeScript compilation was not executed.
- The new `@save_datas S21` syntax and resolved-parameter HDF5 group therefore require one local GUI run before being considered runtime-validated.

These limitations are follow-up evidence requirements, not a repository merge blocker under the current governance contract.
