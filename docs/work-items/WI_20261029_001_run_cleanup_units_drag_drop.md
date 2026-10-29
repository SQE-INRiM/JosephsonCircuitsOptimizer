# WI_20261029_001 — Run cleanup, HB display-unit retention and project drag/drop

- Date: 2026-10-29
- Status: implemented, pending CI/runtime review
- Tier: T2 user-visible GUI and file I/O, with destructive-data and saved-metadata safeguards
- Branch: `feat/empty-run-cleanup-stored-units-file-drop`
- ADR: `adr/ADR_008_run_output_retention_and_source_units.md`

## Goals and acceptance criteria

1. At the end of a newly launched run, keep the run if it has **any** numerical output, saved data, optimizer history or an unknown/unreadable file. Remove only a provably input/bookkeeping-only run. Do not delete ongoing runs or retrospectively touch old runs. Save the cleaned state into a durable `.jco` project and repair `outputs/LATEST.txt`.
2. HB Results uses per-source A/dBm display preferences and impedances recorded with the run, rather than the Setup currently open. The selector in Results disappears. Previously created runs without GUI snapshot metadata default to dBm at 50 Ω, per maintainer request.
3. Ensure Device parameter space Fixed/Range/List remains editable after mode switches, including List values in the primary field and explicit labels.
4. Accept a single `.jco` dropped over any screen. The same file import/validation is used by File > Open; reject invalid files and protect unsaved project edits. Active simulations block project replacement; dropping a file does not navigate Chromium to that file.

## Non-goals

No retroactive deletion of old empty runs, scientific unit change in files, numerical simulation changes, project-format migration or redesign of the underlying run-manager UI.

## Verification plan

- Node regression tests for empty vs partial run output, damaged metadata, arbitrary unknown outputs, optimizer cost history and latest-run pointer.
- Vitest for mixed source units and historical dBm display, plus direct interactive editing tests for Fixed/Range/List; existing Results tests and build.
- GitHub Actions PR build and governance checks.
- Manual Windows run test: completed/failed/cancelled with and without numerical artifacts; source mixed units, loaded older project; file-drop with dirty workspace and an active run.
