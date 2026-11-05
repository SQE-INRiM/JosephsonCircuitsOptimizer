# Repository Status

Last governance refresh: 2026-11-04

## Draft nonlinear feedback PR #24 — reconciled with 2026-11-04 main

- Branch `feat/nonlinear-feedback-v0.4.2` is intentionally a **Draft** PR targeting v0.4.3, independent of the current Optimizer visualization changes.
- This update incorporates current `main` while preserving Julia and GUI changes to nonlinear feedback: optional correction settings, three Julia editor entry points, and the full `user_nonlinear_correction(sol_linear, sol_nonlinear, device_params_set)` contract.
- Legacy user Julia correction functions relying on reduced linear S dictionaries require manual migration (see `adr/ADR_009_nonlinear_feedback_solution_contract.md`).
- No scientific reference HB run has validated correction cycles or numerical equivalence. Do not claim the feedback algorithm validated. No merge into `main` or v0.4.3 release as part of this work.

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

## Published October GUI release: v0.4.2

- The release preparation PR #25, final visual polish PR #26, simplified Run-controls PR #27 and full plotted CSV exports PR #28 have **all merged into `main`**, through the last code merge `c066cb4` (2026-10-30).
- The existing release branch `release/v0.4.2-october-gui` was **fast-forwarded to `main`** after PR #28, then used for the final documentation/notes changes. See `docs/releases/v0.4.2.md` and `CHANGELOG.md`.
- Both root Julia `Project.toml` and Electron GUI `package.json` (plus npm lockfile) declare `0.4.2`.
- **v0.4.2** was published on 2026-10-30. Its tag-triggered workflow produced Windows Setup/Portable and Linux AppImage release assets.
- The nonlinear-feedback GUI remains isolated from published v0.4.x releases. Target a subsequent feature release (tentatively v0.5.0) after independent review and validation.
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
- The v0.4.2 tag was created after the release-notes merge; earlier candidate SHAs (such as `b4bb509` or `50f2df6`) were not release targets.

## v0.4.3 GUI and Results release preparation (2026-11-04)

- The already merged **PR #34** adds a shared historical-run selector, consistent Run toolbar, and persistent selected-run navigation across Linear / Optimization / Harmonic Balance. **PR #35** adds Optimization Landscape (chronological trajectory, exact Linear slice versus sample projection), a separate compact History view, and a clearly distinguished Linear minimum marker. The recent top-menu, Setup and stage-aware Run usability work is also integrated in `main`.
- Release preparation is isolated on `release/v0.4.3-gui-results` to preserve current `main` while updating the root Julia version, Electron package version, npm lockfile, changelog and release notes.
- `docs/releases/v0.4.3.md` describes the compatible GUI/Results baseline; **no numerical solver or `.jco` schema changes** are part of this release preparation.
- The v0.4.3 GitHub Release has **not yet been published**: its final merged `main` commit must pass checks and receive an annotated `v0.4.3` tag.
- Nonlinear-feedback GUI work remains outside this baseline, reserved for a subsequent feature version.

## Windows desktop shortcut icon refresh — separate packaging fix

- A dedicated packaging PR changes the NSIS setting `createDesktopShortcut` from `true` to `always` so a reinstall replaces a desktop shortcut made by earlier Electron-based JCO versions; `win.icon: build/icon.ico` continues to point to the existing JCO icon.
- The update affects **future Windows installers** (not the published v0.4.2 files), and it does not alter Julia/GUI runtime behavior or the nonlinear feedback draft PR #24.
- The packaging regression test checks the NSIS configuration and that the committed ICO is a structurally valid multi-image Windows icon. A real Windows upgrade/Explorer icon-cache check remains desirable.

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
- `CHANGELOG.md` records the published v0.4.2 changes and the upcoming v0.4.3 GUI/Results baseline. The v0.4.3 release remains a candidate until its matching tag is published.
- PR documentation decisions are checked automatically for code/configuration changes; repository branch-protection settings control whether the status is mandatory for merging.

## Recovery rule

For multi-session work, record only what is needed to resume safely: last verified commit, current state, next safe action, checks already run and important open findings.

## Next safe action

1. Review and merge `release/v0.4.3-gui-results` after the versioned GUI build/tests, governance and Windows/Linux package checks pass.
2. Verify `Project.toml`, `gui/package.json` and `gui/package-lock.json` all declare `0.4.3` on the **final merged main commit**.
3. Create and push the annotated `v0.4.3` tag on that exact `main` commit. The existing `.github/workflows/release-desktop.yml` will build and publish Windows Setup, Windows Portable and Linux AppImage artifacts.
4. Verify the GitHub Release assets and keep the nonlinear feedback GUI on a separate branch for a later feature release (tentatively v0.5.0). Independent scientific/HB and installed-desktop validation remain separate from CI.
