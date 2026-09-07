# Agent Handbook

This handbook turns `AGENTS.md` into a lightweight development workflow. Use only the parts that help the current task.

## Standard workflow

### 1. Recover context
- Inspect current code/history and `governance/repository-status.md` when resuming prior work.
- Read only the ADR/work item/audit material relevant to the change.

### 2. Implement
- Define expected behavior for non-trivial changes.
- Preserve unrelated work and scientific conventions.
- Prefer the smallest coherent change.

### 3. Verify
- Run targeted automated tests when available.
- Run manual/system/scientific checks when practical and consequential.
- Record only checks that actually ran.
- If an environment-dependent check cannot run, record it as a limitation or follow-up instead of stopping routine integration.

### 4. Reconcile only what matters
- Update changelog/status/audit/ADR only when the change makes those records materially stale or when the information will help future recovery.
- Do not create paperwork merely to satisfy process.

### 5. Hand off
For multi-session work, record the last verified commit, current state, next safe action and important open findings.

## Human decisions

Escalate to the maintainer when a decision changes scientific interpretation/tolerance, knowingly accepts a material data-integrity or compatibility risk, or authorizes a destructive/irreversible operation.

This is a decision point, not an automatic merge lock. If the maintainer explicitly instructs the agent to proceed, preserve the limitation/risk in the record and continue unless an external safety or repository protection prevents the action.

## Practical rule

The governance system exists to make development faster to resume and safer to understand. It should consume less effort than the engineering work it supports.

- A routine bug fix should normally need code + tests, not a new ADR and audit package.
- A `qualified` audit is a useful warning, not a prohibition.
- Missing platform-specific validation is normally follow-up work.
- Prefer one concise recovery record over duplicating the same state across many files.
- Never invent a governance requirement solely because a previous task used one.
