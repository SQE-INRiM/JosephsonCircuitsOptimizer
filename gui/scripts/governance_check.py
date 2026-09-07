#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]

REQUIRED = [
    "AGENTS.md",
    "CHANGELOG.md",
    "governance/agent-handbook.md",
    "governance/audit-system.md",
    "governance/scientific-integrity.md",
    "governance/repository-status.md",
    "adr/ADR_001_repository_native_governance.md",
    "docs/work-items/WI_20260827_001_governance_integration.md",
    "audits/AUD_20260827_001_governance_integration.md",
]

errors = []

for rel in REQUIRED:
    if not (ROOT / rel).is_file():
        errors.append(f"missing required file: {rel}")

agents = ROOT / "AGENTS.md"
if agents.is_file():
    text = agents.read_text(encoding="utf-8")
    refs = re.findall(r"`([^`]+\.(?:md|py))`", text)
    for ref in refs:
        if any(ch in ref for ch in "*<>"):
            continue
        if ref.startswith(("python ", "git ")):
            continue
        candidate = ROOT / ref
        # Only validate explicit repository-relative paths, not generic examples.
        if "/" in ref or ref in {"CHANGELOG.md", "AGENTS.md"}:
            if not candidate.exists():
                errors.append(f"AGENTS.md references missing path: {ref}")

if errors:
    print("Governance check: FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Governance check: PASS")
print(f"Verified {len(REQUIRED)} required files.")
