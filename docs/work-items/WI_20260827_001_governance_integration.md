# WI_20260827_001 — Lightweight governance integration

- Status: complete
- Audit tier: T1
- Related ADR: `ADR_001`
- Started: 2026-08-27
- Completed: 2026-08-27

## Objective

Introduce a repository-native agent/audit/changelog workflow on top of the current `main` without changing application behavior, project data, or the Julia/JCO numerical engine.

## Scope

- add `AGENTS.md`;
- add lightweight agent, audit, scientific-integrity and repository-status documentation;
- record the repository-native governance decision as an ADR;
- add a changelog;
- add a minimal automated governance consistency check;
- preserve the prior `governance/baseline` branch as historical evidence rather than merging it blindly.

## Non-goals

- no GUI behavior changes;
- no Julia/JCO scientific algorithm changes;
- no resolution-by-assumption of historical audit findings;
- no release certification.

## Acceptance criteria

1. A new agent can find the working rules from repository root. — met
2. The process distinguishes low-risk GUI/internal work from scientific/high-consequence work. — met
3. Prior governance is explicitly marked historical rather than silently discarded. — met
4. The repository contains a recovery/status entry point and changelog. — met
5. A lightweight script checks that mandatory governance files exist and reference valid local paths. — met; CI passed
6. Integration is reviewed through a PR before changing `main`. — met; PR #7

## Recovery

Last verified integration head before closure: `bd66b035e0fbf3cca1e826a50d92fae7fb08ab01` (followed only by this audit/work-item closure update before merge).

Current state: lightweight governance introduced on `governance/integration`; integration diff reviewed against `main`.

Next safe action: use `AGENTS.md` and create a new bounded work item for the next GUI/JCO change.

Checks already run and results:
- branch comparison against `main`: 12 intended governance/documentation/CI files, no application/runtime/scientific code changes;
- GitHub Actions `Governance check`, run 33059723706: success;
- application/scientific simulation tests not run because this work item changes no application or numerical behavior.

Open assumptions/findings: historical findings on `governance/baseline` require re-evaluation against current code before being called current defects.

Files intentionally not changed: application source, Electron/React runtime, Julia bridge behavior, vendored JCO numerical code.
