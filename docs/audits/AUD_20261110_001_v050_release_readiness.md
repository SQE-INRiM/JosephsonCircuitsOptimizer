# AUD_20261110_001 — v0.5.0 release readiness

- **Date:** 2026-11-10
- **Type / tier:** release / T3
- **Status:** in_progress
- **Branch:** `release/v0.5.0-prep` (final tag and commit not yet assigned)
- **Baseline:** `main`, after PR #50 (`1c7e67f`)

## Objective and scope

Assess readiness of JosephsonCircuitsOptimizer.jl and its Windows installer, portable executable, Linux AppImage, and user manual for publication as v0.5.0. Scope includes nonlinear feedback, surrogate optimization selection and reproducibility, existing `.jco` compatibility, version alignment, documentation/ADR consistency and tagged release workflow.

No new numerical model is introduced by the release preparation. The sole GUI test change aligns the expected optimizer History graphs with the existing intended behavior: **do not show constant parameters**.

## Evidence available as of this audit

- The maintainer previously executed `julia --project=. test/optimizer_missing_result.jl` (7/7) and `julia --project=. test/feedback_linear_cache.jl` (11/11) on Windows for the feedback-cache implementation; the subsequently updated optimizer regression test was also reported passing, and a GUI run appeared to work. Those observations were against preceding feature branches, **not the final v0.5.0 release commit**.
- PR #50's governance check succeeded but its GUI test job failed in `OptimizationResultsView.test.tsx`: the test incorrectly expected a parameter chart for constant `Ladd`. The test on the release branch now explicitly expects three plots (objective, I0, Cg) and absence of Ladd; the application component remains untouched. This **requires CI rerun**.
- Static file review: `Project.toml`, `gui/package.json` and `gui/package-lock.json` target 0.5.0; source-only launch wrappers have been removed while installed application packaging remains independent; release workflow compiles the canonical LaTeX manual and can publish version-specific notes.
- ADR 009 reflects the integrated full-HB-solution correction API; existing projects whose custom correction hook expects the older dictionary input require a user edit.

## Pending checks before publication

- [ ] PR GUI `npm test`, TypeScript build and syntax checks pass on the final release commit.
- [ ] Julia optimizer/feedback regression tests pass on that commit with recorded versions/environment.
- [ ] One feedback-on/off or zero-correction equivalence check and cycle-specific Results review using a representative existing project (or explicitly document the limitation).
- [ ] Open an existing v0.4.3 `.jco`, save a separate copy and confirm scientific inputs/results survive.
- [ ] Manual source successfully compiles to PDF with no missing images, clipped content, or unexpected layout changes.
- [ ] Windows installer and portable executable, and Linux AppImage, build and upload successfully.
- [ ] Release workflow names, tag `v0.5.0` and versioned assets/notes match; ensure final integration is on `main` before tagging.

## Remaining limitations and decision boundary

The release is **not yet validated for publication** by this audit. In particular, maintainer GUI testing and automated regressions are not independent numerical/Josephson HB reference validation, and Linux AppImage runtime testing remains comparatively limited. Before tagging, record actual evidence or retain these limitations explicitly in the release notes. Any publication decision is made by the maintainer after reviewing this record.
