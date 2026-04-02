# Skill: draft-polisher

## 役割

`chapter.scenePackages` を正本として、再構築済み draft（`chapter.content`）の体裁・接続・読みやすさを改善する。

## Source prompt

- `DRAFT_PROMPT`
- `COPILOT_SOUL`
- `AUTO_FILL_ITEM_PROMPT`

## 入力

- `workspace_bundle.json`
- 対象 chapter/scene scope
- `codex_task.md`（必要なら）

## 出力

- 更新済み `chapter.content`（キャッシュ）
- 修正方針メモ（どの scenePackage 由来か）

## 触ってよい範囲

- 指定 scope の `chapter.content` 表示調整
- scenePackage 由来情報との整合確認

## 禁止事項

- scenePackages と矛盾する内容の追加
- 分岐ロジック本体（route/choice/convergence）の無断変更
- 未解禁情報の本文先出し

## validator 観点

- spoiler leakage を起こす記述の混入回避
- scenePackage 設計意図との整合
- 章内接続の不自然な欠落回避

## 期待する成果物

- scenePackage に忠実な読みやすい本文キャッシュ
- Draft rebuild 後の手直し範囲が明確
- branch 設計と本文表現の責務分離が維持される
