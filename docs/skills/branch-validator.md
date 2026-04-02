# Skill: branch-validator

## 役割

validator issue を起点に、branch 設計の破綻点を特定し、最小差分で修復する。

## 入力

- `validator_report.md`
- `workspace_bundle.json`
- `codex_task.md`
- `codex_schema_reference.md`

## 出力

- `updated_workspace_bundle.json`
- `codex_change_summary.md`

## 触ってよい範囲

- issue に直接関係する `bible` / `scenePackages` のみ
- scope guard 内の章/シーンのみ

## 禁止事項

- issue 非関連の広域リファクタ
- unresolved issue の黙殺
- validator を通すためだけの情報欠落（構造破壊）

## validator 観点

- variant 未解決参照
- convergence 欠落/衝突
- condition 型不一致
- route reachability 破綻
- unlock/reveal/state carryover の矛盾

## 期待する成果物

- issue の再現点と修正点が 1 対 1 で説明可能
- 未解決 issue は「理由・影響・次アクション」を明示
- 追加で draft rebuild が必要か判定が付く
