# WI_20260903_003 — Project file safety

## Classification

T2 — desktop project loading/saving safety.

## Goal

Prevent malformed required project files from being silently treated as defaults and prevent cleared optional Julia hook editors from leaving stale executable files in the workspace.

## Scope

- Parse required project JSON strictly during load.
- Fail clearly when required circuit/metric source files cannot be read.
- Refuse to overwrite existing malformed drive/simulation/optimizer JSON during Save.
- Allow missing editable JSON files to continue being initialized where current behavior permits it.
- Delete `user_metric_utils.jl` and `user_parametric_sources.jl` when their editor contents are empty or whitespace-only.
- Add focused Node regression coverage.

## Recovery policy

This selectively restores only the project-model safety behavior from historical PR #50 on top of recovery baseline `dc67eb32e7ed1fb004ef1d1ec3f4c1c7c18324f6`.

No Julia runtime/bridge, solver, optimizer, circuit, source, sweep, Results, HDF5, or `.jco` schema logic is changed.

## Validation

- Full repository tests/build and governance checks.
- Open/save a normal `.jco` project on Windows.
- Run the known small simulation and confirm the Linear timing remains near the validated ~2 s baseline.
