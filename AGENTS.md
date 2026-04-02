# DuoScript Codex Operation Guide

## Priority inputs

1. Read `codex_task.md` first.
2. Then read `workspace_bundle.json`.
3. Use `validator_report.md` and `codex_schema_reference.md` as guardrails.

## Permanent rules (repo-wide)

- Canonical structures: `bible.routes`, `bible.revealPlans`, `bible.stateAxes`, `bible.branchPolicies`, `chapter.scenePackages`.
- `chapter.content` is cache/display text, not branch-design source of truth.
- Prefer scope-limited edits (`scene`/`chapter`) over project-wide rewrites.
- Do not edit outside `scope guard` boundaries in `codex_task.md`.
- Do not silently renumber, normalize, or delete IDs.
- Avoid destructive changes unless explicitly requested.
- Re-run validator checks after edits.

## Required output

Always return:

- `updated_workspace_bundle.json`
- `codex_change_summary.md`

`codex_change_summary.md` must include:

- touched entities (route/chapter/scene/choice/variant IDs)
- validator issues fixed
- validator issues still remaining
- whether draft rebuild is required after import
- unresolved issues and why they remain

## Prompt placement policy

- Keep this file short; do not paste long model prompts here.
- Put task-specific instructions in `codex_task.md`.
- Put role/process guidance in docs (e.g., `docs/skills/*`).
