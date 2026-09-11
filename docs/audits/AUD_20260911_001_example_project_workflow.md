# AUD_20260911_001 — Example project workflow and background circuit preview

Date: 2026-09-11
Type: change
Tier: T2
Status: qualified
Work item: `WI_20260911_001_example_project_workflow.md`
Related ADR: `ADR_007_resolved_circuit_preview`
Implementation commit: `aac3931`

## Objective
Review the GUI/example lifecycle and circuit-preview concurrency changes without changing scientific simulation semantics or persistent project format.

## Scope
- neutral New project startup state and guidance;
- directory-driven bundled example discovery;
- direct execution of bundled examples in their temporary session;
- continued Save As protection for ordinary unsaved projects;
- background circuit-preview state and stale-result handling;
- user-facing preview duration guidance.

## Exclusions
- JCO numerical engine behavior;
- scientific metric definitions;
- `.jco` schema changes;
- release packaging beyond the existing inclusion of `runtime/examples`.

## Review performed
- Reviewed the current project lifecycle and example discovery path in the Electron main process.
- Confirmed that examples are enumerated from `.jco` files under the runtime examples directory and named from their manifests rather than a hard-coded example list.
- Reviewed the durable-project guard and limited the exception to sessions explicitly marked as bundled examples; normal unsaved sessions retain Save As protection.
- Reviewed the circuit-preview change against ADR 007: preview generation remains explicit, continues to resolve through JCO, and does not execute automatically on open.
- Reviewed the renderer-side preview state design so an in-flight request can survive Setup navigation and a result generated from an older fingerprint is represented as stale.
- No `.jco` schema, numerical algorithm, source units, metric semantics, HDF5 transform, or simulation-stage mathematics are intentionally changed.

## Validation status
Qualified. The assistant did not execute the user's local Electron/Julia checkout.

Pending / to record before calling fully verified:
- `npm test`
- `npm run build`
- manual fresh-launch check;
- manual dynamic-example discovery check;
- direct bundled-example run;
- ordinary New project Save As rejection;
- background preview navigation;
- stale-state check after changing a relevant parameter during generation.

Any checks actually run by the maintainer should be recorded here before or after integration; governance status does not itself block the maintainer-requested merge.

## Findings and limitations
- Bundled-example runs intentionally have no durable `.jco` destination until the user chooses Save As; this prevents modifications from overwriting the shipped example.
- The temporary example workspace is an execution/session copy, not a promise of persistent user storage.
- Packaged builds only see examples bundled at build time; adding a repository example requires rebuilding/repackaging the application for distribution.
- Existing ADR 007 remains sufficient for the circuit-preview execution boundary; this change does not introduce a new circuit source of truth or architecture direction, so no new ADR is required.
