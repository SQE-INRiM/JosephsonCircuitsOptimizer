# AUD_20260831_006 — Results stage output and performance

Status: **qualified**

## Scope

Reviewed the GUI output-path initialization, Optimization Results recovery, and Results refresh behavior.

## Findings

Stage-only runs created output folders without updating `CURRENT_OUTPUT_PATH[]`, so GUI optimizer-history persistence could have no destination. Optimization-only bookkeeping also contains BO-only cost history, while the previous recovery assumed Linear + BO history. Results additionally re-indexed all runs every four seconds during simulations by launching a fresh Julia reader.

## Changes

- GUI output creation now updates `CURRENT_OUTPUT_PATH[]` for every desktop mode.
- Optimization recovery distinguishes full-run and BO-only bookkeeping histories.
- Results refreshes on entry and run-state changes instead of polling every four seconds.

## Validation

Static diff/contract review. Repository governance CI is required before integration.

## Qualification

Local Windows/Electron + Julia/HDF5 execution remains required for end-to-end verification.
