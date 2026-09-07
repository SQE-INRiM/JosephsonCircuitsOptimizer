# ADR_001 — Repository-native lightweight governance

- Status: accepted
- Date: 2026-08-27
- Scope: JCO-GUI development process

## Context

JCO-GUI combines a user-facing desktop application with a scientific Julia/JCO execution path. Future work may be performed across many human/agent sessions, so the project needs durable context about intent, decisions, scientific constraints and verification.

A separate governance repository was considered, but it would allow working instructions to drift independently from the code version they describe and would make a repository checkout incomplete for recovery.

The earlier `governance/baseline` branch demonstrated a comprehensive repository-native governance kit, but its full process is heavier than needed for routine JCO-GUI maintenance.

## Decision

Keep the operational governance rules **inside JCO-GUI** and version them with the code.

Use a deliberately lightweight core:

- `AGENTS.md` as the mandatory agent entry point;
- risk-tiered audit rules;
- scientific-integrity rules;
- ADRs only for consequential decisions;
- one coherent work item for non-trivial changes;
- repository status/recovery notes;
- changelog for completed user-relevant changes;
- a small automated consistency check.

The historical `governance/baseline` branch remains preserved as provenance and may be consulted for richer templates, but it is not the current source of truth.

## Consequences

### Positive
- instructions remain coupled to the code they govern;
- future sessions can recover without relying on chat history;
- scientific changes receive stronger review than visual-only changes;
- routine fixes can use T0/T1 rather than heavyweight ceremony;
- historical decisions/audits remain inspectable in Git.

### Trade-offs
- contributors must maintain a small amount of repository metadata;
- outdated status/audit records are possible if completion rules are ignored;
- a future generic governance-template repository may be useful, but JCO-GUI must still retain its own versioned working copy.

## Supersession

A future ADR may move shared templates elsewhere, but the repository must remain self-contained enough for an agent/maintainer to understand the active rules and project state from a checkout alone.
