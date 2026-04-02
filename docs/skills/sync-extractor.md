# Skill: sync-extractor

## 役割

Architect/Writer 対話ログから、`bible` / `chapters` / `scenePackages` に反映すべき差分候補を抽出する。

## Source prompt

- `EXTRACTOR_SOUL_*`
- `SYNC_EXTRACTOR_SOUL`
- `LIBRARIAN_SOUL`

## 入力

- 会話ログ（Neural Sync 対象）
- `workspace_bundle.json`
- `codex_schema_reference.md`

## 出力

- 抽出差分の一覧（エンティティ単位）
- 適用優先度（must/should/could）
- あいまい項目（要確認）

## 触ってよい範囲

- 差分提案のみ（自動破壊的適用はしない）
- 必要に応じて `codex_task.md` の objective/focus issue 草案へ反映

## 禁止事項

- ID の勝手な統合・削除
- 根拠のない正規化
- scope 外データの更新提案

## validator 観点

- 新規 state key の型定義漏れ
- route/reveal 参照整合
- chapter/scene スコープ逸脱

## 期待する成果物

- 取り込み判断しやすい構造化差分
- 競合リスクが高い項目の明示
- unresolved 抽出項目の理由付き保留
