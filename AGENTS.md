# JCO-GUI Agent Operating Contract

This file is the entry point for any coding agent working in this repository.

## Mission

Develop and maintain JCO-GUI while preserving scientific meaning, reproducibility, compatibility, traceability, and recoverability, without turning governance into development overhead.

## Read first

Before a non-trivial change, read the material that is relevant to the task:

1. `governance/repository-status.md` for the current recovery point;
2. relevant ADRs when the task touches an architectural/scientific decision;
3. the active work item/audit only when one exists for the change.

The agent does not need to reread every governance document for every routine change.

## Source of truth

- Code and tests define executable behavior.
- ADRs record consequential architectural/scientific decisions.
- Work items record intent when useful for non-trivial work.
- Audits record what was actually verified for a specific commit/scope.
- `CHANGELOG.md` records user-relevant completed changes.
- `governance/repository-status.md` is the recovery entry point, not a substitute for Git history.

If these layers conflict, preserve the conflict explicitly and fix the stale record when practical. Do not let stale governance metadata block otherwise safe development.

## Governance is advisory, not a merge gate

Governance documents provide context, evidence and warnings. They do **not** independently block commits, pull requests or merges.

- `qualified` means some verification is still pending; it does not mean “do not merge”.
- Missing manual/system validation should normally be recorded as follow-up work.
- When the maintainer explicitly instructs an agent to merge or proceed, the agent should do so and retain any unresolved limitations in the audit/status record.
- Do not invent procedural blockers that are not enforced by GitHub, CI, or an explicit maintainer decision.

The only situations that require an explicit human decision before claiming the change safe are material scientific-meaning changes, known data-corruption/incompatibility risks, or destructive/irreversible actions. Even there, the governance system records the risk; it is not an automatic repository lock.

## Change classification

Use the lightest process that is useful:

- **T0** — typo/non-semantic documentation: diff review only.
- **T1** — low-risk internal implementation: targeted tests as appropriate.
- **T2** — user-visible GUI behavior, file I/O, engine bridge, dependency or substantial refactor: acceptance criteria + targeted automated/manual checks as practical.
- **T3** — scientific meaning/output, persistent project format/schema, numerical transformations, release-critical workflow: stronger reference/scientific validation and retained evidence as practical.

Classify by consequence, not line count. Tier selection controls verification depth, not permission to merge.

## ADR rule

Create or update an ADR only for a consequential decision that changes:

- GUI/engine architecture or dependency direction;
- `.jco` persistent format or compatibility promise;
- JCO engine integration strategy;
- scientific interpretation, numerical algorithm, metric semantics or units;
- a previously accepted architectural decision.

Small bug fixes that restore already-defined behavior do not need a new ADR.

## Scientific integrity

A visually correct GUI is not scientific validation.

For changes touching parameters, sources, units, sweeps, metrics, result transforms, JCO inputs/outputs, or simulation stages, preserve scientific meaning and record the checks that were actually performed. Never describe a test, audit, simulation, or numerical validation as performed unless it was actually executed.

Pending scientific/system validation may be retained as an explicit limitation instead of blocking integration, unless the change would otherwise be represented as scientifically validated when it is not.

## Implementation rules

1. Preserve unrelated user changes.
2. Prefer the smallest coherent change.
3. Keep GUI/presentation logic separate from scientific/domain and engine-adapter logic.
4. Long-running Julia/I/O work must not block the UI thread.
5. Cancellation, timeout, error and partial-result behavior must be explicit.
6. Persistent format changes require migration/backward-compatibility consideration.
7. Do not modify the upstream/vendored JCO numerical engine merely to make the GUI easier unless the task explicitly requires it.

## Recovery note

For work that spans sessions, retain only the information needed to resume safely:

```text
Last verified commit:
Current state:
Next safe action:
Checks already run and results:
Open assumptions/findings:
```

## Completion report

For a non-trivial completed change, report the outcome, checks actually run, remaining limitations, and commit/PR reference. Add ADR/audit/work-item detail only when it materially helps future recovery.

The repository must remain understandable without relying on a previous chat transcript, but governance should never become more cumbersome than the development it is meant to support.
