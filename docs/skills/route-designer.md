# Skill: route-designer

## 役割

`bible.routes` / `bible.revealPlans` / `bible.stateAxes` / `bible.branchPolicies` の設計・更新を担当する。

## Source prompt

- `ARCHITECT_MTP`
- `PROJECT_GEN_BIBLE_PROMPT`
- `INITIAL_CHAPTERS_PROMPT`
- `INITIAL_FORESHADOWING_PROMPT`

## 入力

- `workspace_bundle.json`
- `codex_task.md`
- `validator_report.md`
- `codex_schema_reference.md`

## 出力

- `updated_workspace_bundle.json`
- `codex_change_summary.md`

## 触ってよい範囲

- `project.bible.routes`
- `project.bible.revealPlans`
- `project.bible.stateAxes`
- `project.bible.branchPolicies`
- 必要最小限の `chapter.scenePackages` 参照更新（ID整合のため）

## 禁止事項

- scope 外の章/シーン更新
- `chapter.content` の大規模書き換え
- ID の無断振り直し・削除

## validator 観点

- ルート到達可能性
- reveal 漏洩/過剰公開
- state axis 型整合
- branch policy と convergence の整合

## 期待する成果物

- ルート設計意図が明確
- route/state/reveal の参照切れがない
- unresolved issue があれば理由と次アクションが明示される
