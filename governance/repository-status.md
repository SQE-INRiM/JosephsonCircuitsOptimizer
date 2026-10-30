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

## Next candidate GUI changes (pending PR integration, 2026-10-29)

Branch: `feat/empty-run-cleanup-stored-units-file-drop`. The branch adds conservative just-finished empty-run cleanup, saved per-run source display units, and `.jco` drag/drop. See `docs/work-items/WI_20261029_001_run_cleanup_units_drag_drop.md` and the **qualified** `docs/audits/AUD_20261029_002_run_cleanup_units_file_drop.md`. These are candidate changes, **not the verified main baseline** until merged and checked.

## October GUI release candidate: v0.4.2

- Release preparation branch: `release/v0.4.2-october-gui`, based on `main` at `7ad1f41`; this release contains only October improvements already integrated in `main`, with no nonlinear feedback changes.
- Previous published release: `v0.4.1`. Version metadata and dated changelog are prepared on the release branch for `v0.4.2`; tag creation, release packaging and publication are pending until merge and tag push.
- New nonlinear feedback UI work is isolated in **draft PR #24** (`feat/nonlinear-feedback-v0.4.2`), not merged into the release; that work must be retargeted to **v0.4.3** after this release.
- Relative to `v0.4.1`, the current `main` is 27 commits ahead (GitHub compare at preparation time). No separate Julia/HB scientific reference validation is claimed.

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
- `CHANGELOG.md` keeps desktop-packaging and October GUI changes under `Unreleased` until a new version is published.
- PR documentation decisions are checked automatically for code/configuration changes; repository branch-protection settings control whether the status is mandatory for merging.

## Recovery rule

For multi-session work, record only what is needed to resume safely: last verified commit, current state, next safe action, checks already run and important open findings.

## Next safe action

1. Confirm the new PR documentation-review workflow on a PR changing code and by editing the PR description; enable the **Governance check / governance** required status in GitHub branch protection/rulesets if unconditional blocking is desired.
2. Perform targeted real-data GUI checks for A/B retained-trace overlays, dense heatmaps at 50% zoom and theme switching, recording actual platform/input evidence if performed.
3. Update the user manual source/PDF with the installer-first workflow once the manual source is available; optionally validate Linux AppImage launch on Linux.
4. Select the next release version, update version/changelog files as needed, then create the matching `v*` tag. Preserve pending qualifications until independently verified.
