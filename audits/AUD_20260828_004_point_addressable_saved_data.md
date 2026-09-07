# AUD_20260828_004 — Point-addressable selective saved data

**Status:** qualified

## Scope

Review the storage-contract change that replaces default full S-parameter capture with point-addressed user-selected arrays while preserving compact summary tables.

## Evidence reviewed

- User-provided August 28 `.jco` run previously validated that point-group HDF5 storage can preserve 1800-point complex S-parameter traces and reproduce Linear metrics.
- Current `runtime/bridge/gui_runtime_overrides.jl` implementation.
- Current `runtime/jco/src/utils.jl` legacy `save_datas(...)` behavior and bundled Chalmers use sites.
- `docs/PROJECT_FORMAT.md` and `WI_20260828_004_point_addressable_saved_data.md`.

## Findings

### Pass — scalable default

The default runtime mode is now `selected`. Full S matrices are not copied into per-sweep in-memory trace records unless `trace_storage_mode = "all"` is explicitly configured. This addresses both archive-size and RAM-scaling concerns for large design sweeps.

### Pass — canonical point relationship

Linear rows are assigned `point_id = 1:N` in the same loop that establishes the active `user_cost` context. Nonlinear IDs are assigned from the stored-results order immediately before `user_performance`; the summary saver adds the same 1:N IDs to `df_nonlinear_analysis.h5`. This avoids floating-point equality matching in future Results code.

### Pass — selected-array consolidation

The GUI override replaces timestamp-per-call `save_datas` persistence with stage-level HDF5 files under `saved_data/`. Each active point gets a stable group and metadata. Multiple quantities may be stored under the same point; duplicate requested quantity names receive deterministic numeric suffixes rather than overwriting earlier arrays.

### Pass — complex-array representation

Complex selected arrays are stored as split real/imaginary datasets; real arrays use a values dataset. A common standard JCO frequency axis is retained at the HDF5 root when available.

### Pass — optimizer separation

Calls requesting Linear/nonlinear categories outside an active summary-point context are ignored. Therefore optimizer evaluations cannot silently acquire a `point_id` that would collide with or masquerade as a uniform Linear row.

### Qualified — runtime execution unavailable here

Julia is not installed in the agent environment. HDF5 opening modes, group creation, dataset writing, and exact summary-to-selected-data correspondence have therefore not been executed end-to-end after this change. A local desktop run is required before the storage contract should be treated as fully validated.

## Required local acceptance test

Use a small run with multiple Linear and HB points and explicit `save_datas` calls. Confirm:

1. `df_uniform_analysis.h5` contains a `point_id` column with unique IDs matching its row count.
2. `df_nonlinear_analysis.h5` contains the equivalent `point_id` column.
3. default mode produces no `linear_traces.h5` / `nonlinear_traces.h5`.
4. only requested quantities appear in `saved_data/linear.h5` / `saved_data/nonlinear.h5`.
5. each `point_XXXXXX` group corresponds to the same summary-table row and contains correct parameter/source metadata.
6. complex arrays reconstruct correctly from real/imag datasets.
7. masked Linear points without a `save_datas` call remain valid summary rows with no detailed-data group.
8. a deliberately configured `trace_storage_mode = "all"` still produces the diagnostic full-trace files.

## Conclusion

The architecture matches the intended JCO workflow and is appropriate to integrate, but the audit remains **qualified** until a real Julia-generated `.jco` confirms the new schema end to end.
