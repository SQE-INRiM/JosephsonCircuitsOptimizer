# AUD_20261029_001 — October GUI PRs: retrospective traceability

- Date: 2026-10-29
- Type: baseline / retrospective change review
- Tier: T2 (user-visible GUI behavior)
- Status: **qualified**
- Scope: merged PRs #15, #16, #17, #18 on `main` (2026-10-29)
- Reference commit after integration: `1f627845592f822fafa7fa402b1ad1e88ad77c2d`
- Documentation reconciliation: `governance/automatic-pr-documentation-review` branch

## Purpose

These four GUI PRs were merged with green automated checks but without synchronized changelog, status, ADR or audit review. This is a retrospective record of their real scope and available evidence, **not a claim that a new scientific or end-to-end validation was executed**.

## Changes reviewed

| PR / merge commit | Change | Scientific or persistence impact |
| --- | --- | --- |
| [#15](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer/pull/15) / `beacedbe42f5f216c5ea901fec22e21eca74a903` | AC/DC source toggle, transient AC-frequency restoration, desktop scrollbar correction | DC remains physically zero-frequency; no new AC-history field in persisted `.jco` |
| [#16](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer/pull/16) / `ed9b9731dd0f41f8b836cde6f1e79f2173fcedc0` | First-order linear harmonic and intermodulation guidance; warns when shared HB setting differs | Documentation in GUI only; no solver setting changed automatically |
| [#17](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer/pull/17) / `8d646cf08134d9d0ef2a480827ab40e976b498e5` | A/B point selection and on-demand overlay of retained traces in Linear and HB | GUI presentation/read-only saved data; avoids overlay when stored X grids differ |
| [#18](https://github.com/SQE-INRiM/JosephsonCircuitsOptimizer/pull/18) / `1f627845592f822fafa7fa402b1ad1e88ad77c2d` | Desktop zoom 50–150%, bounded Y colormap, Light/Dark/System theme | App display preferences outside `.jco`, no Julia solver changes |

## Evidence checked

The final PR-head GitHub Actions statuses were checked on 2026-10-29:

| PR | PR build check run | Governance check | Windows desktop packages | Linux AppImage |
| --- | --- | --- | --- | --- |
| #15 | `40844307988`: success | success | success | success |
| #16 | `40848541362`: success | success | success | success |
| #17 | `40862281052`: success | success | success | success |
| #18 | `40869177811`: success | success | success | success |

The PR build workflow contains automated tests, desktop syntax checking and a TypeScript/Vite build. The Windows/Linux jobs show packaging success; they are **not evidence of a launched application on both target OSes**. The governance check for these historical PRs checked the existence of baseline documents; it did **not** verify PR-level documentation decisions.

## Limitations and follow-up

- No fresh controlled end-to-end Julia simulation, numerical equivalence comparison, or scientific reference-data validation was performed as part of this retrospective audit.
- The maintainer provided interactive approval of the results/visual changes during development, but detailed reproducible manual test inputs, screenshots and environment logs are not retained in this audit.
- The A/B overlay with real large retained HDF5 arrays, dense colormaps at minimum zoom and system-theme transitions are suitable targeted regression checks before the next release.
- Existing older packaging audits remain historical and retain their qualifications; this audit does not supersede them.

## Conclusion

**Qualified.** The four changes are merged with green PR CI, and the missing user-visible change log and recovery context are reconciled retrospectively. No claim of independent scientific validation or complete platform-runtime testing is made.
