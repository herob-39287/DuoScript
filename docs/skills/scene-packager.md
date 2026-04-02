# Skill: scene-packager

## 役割

`chapter.scenePackages` を正本として、choice / reaction / convergence を含むシーン分岐構造を生成・修正する。

## 入力

- `workspace_bundle.json`
- `codex_task.md`（scope guard を含む）
- `validator_report.md`
- `codex_schema_reference.md`

## 出力

- `updated_workspace_bundle.json`
- `codex_change_summary.md`

## 触ってよい範囲

- 指定 scope 内の `project.chapters[].scenePackages`
- 整合維持に必要な最小限の `bible` 側参照

## 禁止事項

- project 全体 rewrite
- `chapter.content` を主成果物として扱うこと
- variant / choice / convergence ID の無断再採番

## validator 観点

- variant 参照整合
- convergence 一貫性
- entry/visibility/availability 条件の型整合
- weak choice の削減
- spoiler leakage の抑制

## 期待する成果物

- scenePackage 中心で再構築可能な分岐設計
- choice → reaction → convergence が追跡可能
- draft 再構築要否が summary に明記される
