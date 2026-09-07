# Audit System

Audits convert “it seems to work” into a scoped statement tied to a particular change and evidence. They are evidence and memory aids, not automatic merge gates.

## Principle

An audit conclusion is valid only for its stated scope, commit, environment, criteria, and evidence. Older audits remain historical evidence after the code changes; they are not automatically current.

## Audit types

- `baseline`: establish what currently exists and which gaps matter for safe work.
- `change`: verify one coherent work item/PR.
- `release`: verify an integrated distributable version.
- `incident`: preserve facts and corrective action after a material failure.
- `migration`: verify format/schema/architecture migration and rollback.

## Change tiers

| Tier | Typical scope | Suggested verification |
|---|---|---|
| T0 | typo / non-semantic docs | diff review |
| T1 | low-risk internal change | targeted automated tests |
| T2 | user-visible GUI, file I/O, bridge, dependency, refactor | acceptance criteria + targeted automated/manual checks as practical |
| T3 | scientific output/meaning, persistent schema, numerical transforms, release-critical workflow | stronger reference/scientific validation + failure paths + retained evidence as practical |

Tiers determine how much evidence is desirable; they do not determine whether a change is allowed to merge.

## Required audit content

When an audit is useful, state:

- audit ID, date, type, tier, status;
- branch and commit/range;
- objective, scope, exclusions;
- verification actually performed and results;
- findings/risks and limitations.

Allowed statuses: `planned`, `in_progress`, `complete`, `qualified`, `failed`, `superseded`.

`qualified` means the conclusion is useful but has explicit limitations. It does **not** automatically mean “do not merge”. A qualified change may be integrated while its missing validation remains documented as follow-up work.

`failed` means one or more stated criteria failed. Whether that blocks integration is a maintainer decision based on consequence, not an automatic governance rule.

## Merge policy

Audits must not create procedural deadlocks.

- No audit status automatically blocks a commit, PR, or merge.
- Pending Windows/Julia/manual/system checks are normally follow-up findings, not merge blockers.
- If the maintainer explicitly instructs an agent to merge or proceed, retain unresolved findings and perform the requested integration unless an external repository protection or safety constraint prevents it.
- Only material known risks such as data corruption, destructive incompatibility, or an unvalidated scientific-meaning change require explicit acknowledgement before representing the result as safe or scientifically validated.

## Scientific audit rule

Review scientific meaning separately from visual behavior. In particular, inspect as applicable:

- units and scaling;
- parameter/source/sweep round trips;
- stage and metric semantics;
- Julia/JCO boundary values;
- HDF5/result transforms and missing-data behavior;
- convergence/error/cancellation interpretation;
- reference cases and numerical tolerances.

A screenshot can verify presentation but cannot by itself verify numerical correctness. Missing numerical validation should be stated plainly rather than converted into a generic merge prohibition.

## Evidence

Evidence must make clear what was actually run/observed, against which commit/environment, with which input, and what expected versus actual result occurred. Never claim unperformed checks. Small text/JSON/CSV evidence may live in Git; large datasets may be referenced by stable location/checksum when appropriate.

## Supersession

Completed audits are historical records. A later audit may supersede their conclusion but should reference the earlier audit rather than deleting or rewriting it.

## Completion rule

Before calling a change fully verified, reconcile acceptance criteria with checks actually run and record remaining limitations. Repository integration can happen before full verification when the maintainer accepts that state; the audit should simply remain `qualified` until the missing evidence is obtained.
