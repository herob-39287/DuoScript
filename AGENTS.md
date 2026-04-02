# DuoScript Codex Operation Guide

## Priority Inputs

1. Always read `codex_task.md` first.
2. Then read `workspace_bundle.json`.
3. Use `validator_report.md` and `codex_schema_reference.md` as guardrails.

## Source of Truth

Treat the following as canonical VN structures:

- `bible.routes`
- `bible.revealPlans`
- `bible.stateAxes`
- `bible.branchPolicies`
- `chapter.scenePackages`

Treat `chapter.content` as cached/final-display text, not the canonical branch design source.

When editing, prioritize these targets:

- `bible`
- `chapters`
- `beats`
- `scenes`

## Required Validation

Before returning any edits, re-check:

- variant references
- convergence consistency
- condition type safety
- spoiler leakage
- weak choices and route reachability assumptions
- run validator checks after applying changes

## Safety

- Avoid destructive changes unless explicitly requested.

## Output Rules

When returning edits to DuoScript, output:

- `updated_workspace_bundle.json`
- `codex_change_summary.md`

Prefer scope-limited edits (`chapter` / `scene`) when the task brief requests it.
