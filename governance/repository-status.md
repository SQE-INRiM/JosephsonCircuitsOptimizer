# Repository Status

Last governance refresh: 2026-10-30

## Current development baseline

- Repository: `SQE-INRiM/JosephsonCircuitsOptimizer`
- Primary branch: `main`
- Application stack: Julia/JCO package at repository root with the Electron/React GUI under `gui/`.
- Unified-repository migration was merged by PR #1 on 2026-09-07 at `8e148a2`.
- Preliminary Linux launcher was merged by PR #2 at `75dfe0b`.
- Release `v0.3.0` was merged by PR #3 at `497ceb1` on 2026-09-08, followed by README/image refinements through `6e9ab98`.
- Circuit Preview / fresh-install runtime hardening is integrated through `399873f`.
- Example-project lifecycle and background Circuit Preview work is integrated through implementation `aac3931` plus governance follow-up through `9ac91fd`.
- Installable desktop packaging from PR #6 is integrated in `main` (historical packaging recovery point `659d2ee`).
- October GUI usability PRs #15–18 are integrated; latest documented `main` reference before this governance follow-up is `1f627845592f822fafa7fa402b1ad1e88ad77c2d` (PR #18, 2026-10-29).

## Integrated functional state

The unified GUI provides:
- Setup for circuit code, device parameters, sources, computation settings and metric code;
- explicit JCO-resolved Circuit Preview with stale-state tracking and background generation;
- neutral `New project` startup and dynamically discovered bundled `.jco` examples;
- direct execution of bundled examples in isolated temporary sessions while ordinary unsaved projects retain the Save As guard;
- Linear, Optimization and Harmonic Balance execution through the Julia bridge;
- persistent `.jco` project/result storage and Results exploration.

Desktop distribution now provides:
- Windows x64 NSIS installer;
- Windows x64 portable executable;
- Linux x64 AppImage;
- build-time staging of the authoritative root JCO Julia package into packaged Electron resources;
- GitHub Actions generation of Windows/Linux artifacts on pull requests and `main`;
- tag-driven release workflow for publishing desktop artifacts to GitHub Releases;
- Julia remains an external runtime requirement.

No packaging change intentionally modifies JCO numerical algorithms, scientific metric semantics, source units, persistent `.jco` schema, or the renderer/Julia scientific contract.

## October 2026 GUI baseline

- PR #15: improved AC/DC selection, transient AC-frequency editing history and corrected duplicate desktop scrollbar.
- PR #16: Linear-stage harmonic and shared intermodulation-order guidance, without automatic numerical changes.
- PR #17: A/B selection and retained-trace overlays for Linear/HB Results, with explicit X-axis compatibility checks.
- PR #18: desktop zoom 50–150%, bounded Y dimension for colormaps and Light/Dark/System appearance.
- GitHub Actions on the final heads of PRs #15–18 passed the PR test/build, governance, Windows packaging and Linux packaging workflows.
- A retrospective T2 audit is recorded at `docs/audits/AUD_20261029_001_october_gui_prs.md`; status remains **qualified** because no new independent scientific reference or reproducible full OS/runtime test is claimed.
- New code PRs use `.github/PULL_REQUEST_TEMPLATE.md`; the GitHub Governance check verifies five explicit documentation review decisions, rather than only file existence. ADR and audit documents remain conditional on impact.

## Integrated October run and Results improvements

Conservative just-finished empty-run cleanup, saved per-run source display units and `.jco` drag/drop were merged before the v0.4.2 preparation. See `docs/work-items/WI_20261029_001_run_cleanup_units_drag_drop.md` and the **qualified** `docs/audits/AUD_20261029_002_run_cleanup_units_file_drop.md`. The work is included in `main`, not a pending baseline.

## October GUI release candidate: v0.4.2

- The release preparation PR #25, final visual polish PR #26, simplified Run-controls PR #27 and full plotted CSV exports PR #28 have **all merged into `main`**, through the last code merge `c066cb4` (2026-10-30).
- The existing release branch `release/v0.4.2-october-gui` was **fast-forwarded to `main`** after PR #28, then used for the final documentation/notes changes. See `docs/releases/v0.4.2.md` and `CHANGELOG.md`.
- Both root Julia `Project.toml` and Electron GUI `package.json` (plus npm lockfile) declare `0.4.2`.
- Previous published GitHub release is **v0.4.1**. Publication of v0.4.2 is triggered by creating and pushing a `v0.4.2` tag on the **final merged `main` commit**; the existing `.github/workflows/release-desktop.yml` will build Windows Setup/Portable and Linux AppImage and publish the GitHub Release.
- The new nonlinear feedback GUI remains isolated in **draft PR #24** and is **excluded** from v0.4.2; update it for **v0.4.3** after publication.
- The final plot CSV PR #28 had **four successful PR-level checks**: governance, tests/renderer build, Windows package build and Linux AppImage. Separate installed-desktop scientific/HB reference validation is not claimed.

## v0.4.2 final visual polish (2026-10-30)

- PR #26 merged the README/logo positioning, Workspace icon alignment, and initial Setup footer changes. PR #27 subsequently removed the floating Run control and restored a navigation-only Setup footer.
- Final decision: remove Run remaining from Setup footer and all floating page overlays; keep primary Run/Stop controls solely on the Run screen. A five-second notification reports completed, failed or cancelled runs from desktop run-finished events, with no persistent status indicator.
- PR #24 nonlinear feedback remains separate and excluded from v0.4.2. No Julia numerical or .jco schema changes are part of the polish.
- GUI regression tests and GitHub Actions CI are the intended verification; visual desktop zoom checks remain desirable before distribution.

## Integrated Results CSV consistency (2026-10-30)

- Merged PR #28 adds plotted-data CSV for the Linear/HB single-point and A/B overlays, plus Linear 1D and HB amplitude response charts.
- Uses shared CSV formatting with unmodified frequency samples in Hz for retained arrays and distinct labeled A/B series; mismatched physical X grids remain non-comparable and cannot be exported as an overlay.
- Focused unit/integration tests for CSV precision, escaping, incompatible axes and HB trace/response output passed in PR #28; numerical Julia simulation and persisted `.jco` inputs remain unchanged.
- `v0.4.2` was still untagged at the time these release notes were prepared. Do not use an earlier SHA (such as `b4bb509` or `50f2df6`) for the release tag; choose the final merged `main` after the release-notes PR.

## Packaging validation state

PR #6 final CI evidence:
- governance check: passed;
- PR test/build check: passed;
- Linux AppImage build: passed and artifact produced;
- Windows desktop package build: passed and artifact produced.

Windows manual evidence:
- GitHub-built Windows artifact downloaded successfully;
- packaged Windows application tested successfully;
- installed application remained operational after renaming the local repository directory.

The packaging audit remains **qualified**, not complete, because Linux runtime launch and tag-driven release publication have not yet been recorded, and no installed-package scientific run is claimed unless separately documented.

See `docs/audits/AUD_20260911_002_installable_desktop_packages.md`.

## Governance state

Governance remains lightweight and advisory:
- `AGENTS.md` is the coding-agent entry point;
- ADR 007 remains authoritative for Circuit Preview execution/topology boundaries;
- `WI_20260911_001_example_project_workflow.md` / `AUD_20260911_001_example_project_workflow.md` retain the example/background-preview record;
- `WI_20260911_002_installable_desktop_packages.md` / `AUD_20260911_002_installable_desktop_packages.md` track the T3 packaging change;
- `CHANGELOG.md` now records the October GUI and desktop improvements under `0.4.2 - 2026-10-30`; the release remains a candidate until the matching tag is published.
- PR documentation decisions are checked automatically for code/configuration changes; repository branch-protection settings control whether the status is mandatory for merging.

## Recovery rule

For multi-session work, record only what is needed to resume safely: last verified commit, current state, next safe action, checks already run and important open findings.

## Next safe action

1. Merge the v0.4.2 release-note documentation branch after checking its diff.
2. Create and push the annotated `v0.4.2` tag on the final `main` merge commit; do not tag a stale release-preparation commit.
3. Verify that the **Publish desktop release** tag-driven GitHub Actions workflow completes and the GitHub Release contains Windows Setup, Windows Portable and Linux AppImage assets.
4. After publication, retarget the draft nonlinear feedback PR #24 toward v0.4.3. Keep real-data/installed-desktop scientific validation qualifications explicit.
