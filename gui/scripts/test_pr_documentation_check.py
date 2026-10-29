"""Tests for the PR governance declaration check, runnable without GitHub."""
import unittest

from pr_documentation_check import validate_documentation

GOOD_BODY = """## Summary
A new feature.

## Documentation & governance
- [x] Changelog: updated — CHANGELOG.md
- [x] ADR: not needed — No engine integration or architectural contract changed.
- [x] Audit/work item: updated — docs/audits/AUD_20261029_001_gui_followup.md
- [x] Repository status: updated — governance/repository-status.md
- [x] Agent instructions: updated — AGENTS.md and governance/agent-handbook.md

## Testing
Green PR CI.
"""
CODE_WITH_DOCS = [
    "gui/src/App.tsx", "CHANGELOG.md", "docs/audits/AUD_20261029_001_gui_followup.md",
    "governance/repository-status.md", "AGENTS.md",
]
NO_DOCS_BODY = """## Documentation & governance
- [x] Changelog: not needed — Internal change without user-visible behavior.
- [x] ADR: not needed — No architecture or scientific semantics changed.
- [x] Audit/work item: not needed — Low-risk refactor with focused regression tests.
- [x] Repository status: not needed — Does not affect the development recovery state.
- [x] Agent instructions: not needed — The established coding workflow is unchanged.
"""


class GovernanceDeclarationTests(unittest.TestCase):
    def test_complete_review_with_matching_changed_files(self):
        self.assertEqual(validate_documentation(GOOD_BODY, CODE_WITH_DOCS), [])

    def test_reasoned_no_documentation_change(self):
        self.assertEqual(validate_documentation(NO_DOCS_BODY, ["gui/src/App.tsx"]), [])

    def test_docs_only_pr_does_not_require_checklist(self):
        self.assertEqual(validate_documentation("", ["README.md", "docs/guide.md"]), [])

    def test_missing_section_or_all_unchecked_fail(self):
        self.assertIn("Documentation & governance", validate_documentation("", ["src/main.jl"])[0])
        unchecked = GOOD_BODY.replace("[x]", "[ ]")
        self.assertEqual(len(validate_documentation(unchecked, CODE_WITH_DOCS)), 5)

    def test_updated_without_matching_changed_document_fails(self):
        paths = ["gui/src/App.tsx", "CHANGELOG.md"]
        errors = validate_documentation(GOOD_BODY, paths)
        self.assertTrue(any("Audit/work item" in error for error in errors))
        self.assertTrue(any("Repository status" in error for error in errors))
        self.assertTrue(any("Agent instructions" in error for error in errors))

    def test_not_needed_cannot_conceal_changed_documentation(self):
        errors = validate_documentation(NO_DOCS_BODY, ["gui/src/App.tsx", "CHANGELOG.md"])
        self.assertTrue(any("Changelog" in error for error in errors))

    def test_placeholder_and_missing_reason_fail(self):
        bad = NO_DOCS_BODY.replace(
            "Internal change without user-visible behavior.", "TODO"
        )
        self.assertTrue(any("Changelog" in e for e in validate_documentation(bad, ["src/app.ts"])))

    def test_only_one_checked_declaration_per_category(self):
        bad = GOOD_BODY.replace(
            "- [x] Changelog: updated — CHANGELOG.md",
            "- [x] Changelog: updated — CHANGELOG.md\n"
            "- [x] Changelog: not needed — A very detailed conflicting justification.",
        )
        self.assertTrue(any("Changelog" in e for e in validate_documentation(bad, CODE_WITH_DOCS)))

    def test_adr_updates_are_detected(self):
        body = NO_DOCS_BODY.replace(
            "- [x] ADR: not needed — No architecture or scientific semantics changed.",
            "- [x] ADR: updated — adr/ADR_008_example.md",
        )
        self.assertEqual(validate_documentation(body, ["src/main.jl", "adr/ADR_008_example.md"]), [])

    def test_github_workflow_is_code(self):
        self.assertTrue(validate_documentation("", [".github/workflows/governance-check.yml"]))


if __name__ == "__main__":
    unittest.main()
