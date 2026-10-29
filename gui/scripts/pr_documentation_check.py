#!/usr/bin/env python3
"""Validate documentation decisions for code-changing pull requests.

Run on pull_request using the checked-out merge commit and the PR event file.
This gate checks that changes were *reviewed*, not that prose or audit evidence
is scientifically accurate. ADRs/audits remain conditional on actual impact.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

CATEGORIES = {
    "Changelog": ("CHANGELOG.md",),
    "ADR": ("adr/",),
    "Audit/work item": ("audits/", "docs/audits/", "docs/work-items/"),
    "Repository status": ("governance/repository-status.md",),
    "Agent instructions": ("AGENTS.md", "governance/agent-handbook.md"),
}
CODE_EXTENSIONS = {
    ".py", ".jl", ".js", ".jsx", ".ts", ".tsx", ".cjs", ".mjs",
    ".css", ".scss", ".html", ".json", ".toml", ".yml", ".yaml",
    ".sh", ".ps1", ".bat", ".cmd", ".c", ".cpp", ".h", ".rs", ".lock",
}
PLACEHOLDERS = ("todo", "tbd", "n/a", "none", "path(s)", "explain why",
                "short reason", "add reason", "not applicable")
DECLARATION = re.compile(
    r"^\s*[-*]\s*\[\s*([xX ])\s*\]\s*"
    r"(Changelog|ADR|Audit/work item|Repository status|Agent instructions)"
    r"\s*:\s*(updated|not needed)\s*[—–:-]\s*(.*?)\s*$",
    re.IGNORECASE,
)


def touches_code(path: str) -> bool:
    """A code/configuration change needs a documented review decision."""
    path = path.replace("\\", "/")
    return Path(path).suffix.lower() in CODE_EXTENSIONS


def matches_category(path: str, prefixes: tuple[str, ...]) -> bool:
    return any(path == prefix or (
        prefix.endswith("/") and path.startswith(prefix)
    ) for prefix in prefixes)


def meaningful(reason: str, *, updated: bool) -> bool:
    value = reason.strip().strip(chr(96)).strip()
    if len(value) < (4 if updated else 16):
        return False
    lower = value.lower()
    return not any(placeholder in lower for placeholder in PLACEHOLDERS) and "<" not in value and ">" not in value


def validate_documentation(body: str, changed_paths: list[str]) -> list[str]:
    """Return actionable issues; no mandatory checklist for docs-only PRs."""
    if not any(touches_code(path) for path in changed_paths):
        return []

    section = re.search(
        r"^##\s+Documentation\s*&\s*governance\s*$([\s\S]*?)(?=^##\s|\Z)",
        body or "", re.IGNORECASE | re.MULTILINE,
    )
    if section is None:
        return ["Add the '## Documentation & governance' PR section and complete its checklist."]

    completed: dict[str, list[tuple[str, str]]] = {name: [] for name in CATEGORIES}
    for line in section.group(1).splitlines():
        match = DECLARATION.match(line)
        if not match or match.group(1).lower() != "x":
            continue
        name = next(key for key in CATEGORIES if key.casefold() == match.group(2).casefold())
        completed[name].append((match.group(3).lower(), match.group(4).strip()))

    errors = []
    for category, prefixes in CATEGORIES.items():
        decisions = completed[category]
        if len(decisions) != 1:
            errors.append(f"{category}: check exactly one decision (updated / not needed).")
            continue
        decision, explanation = decisions[0]
        if not meaningful(explanation, updated=decision == "updated"):
            errors.append(f"{category}: replace the placeholder with a meaningful file reference or explanation.")
            continue
        has_relevant_diff = any(matches_category(path, prefixes) for path in changed_paths)
        if decision == "updated" and not has_relevant_diff:
            errors.append(f"{category}: marked updated, but no corresponding documentation file changed.")
        elif decision == "not needed" and has_relevant_diff:
            errors.append(f"{category}: documentation changed; select 'updated' instead of 'not needed'.")
    return errors


def main() -> int:
    try:
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
        pr = event["pull_request"]
        base = pr["base"]["sha"]
        body = pr.get("body") or ""
        changed_paths = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"],
            check=True, capture_output=True, text=True,
        ).stdout.splitlines()
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Documentation review: could not evaluate PR: {error}", file=sys.stderr)
        return 1

    issues = validate_documentation(body, changed_paths)
    if issues:
        print("Documentation review: FAILED")
        for issue in issues:
            print(f"- {issue}")
        print("A 'not needed' decision with an explanation is accepted; creating an ADR or audit is not automatically required.")
        return 1
    print("Documentation review: PASS")
    print(f"Reviewed {len(changed_paths)} changed files (code/config present: {any(touches_code(p) for p in changed_paths)}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
