# Codex Prompt Mapping

既存 Gemini プロンプト資産を、Codex 中心運用に合わせて配置し直すためのマップ。

## 1) AGENTS.md へ圧縮転記（恒久ルールのみ）

- 構造化成果物を優先する
- scope guard を守る
- validator 整合性を壊さない
- 本文（`chapter.content`）を主成果物にしない
- unresolved issue は明示して返す

> 方針: AGENTS.md には長いプロンプト本文を置かない。

## 2) codex_task.md に載せる（依頼ごとに変動）

- `GENESIS_FILL_PROMPT`
- `AUTO_FILL_ITEM_PROMPT`
- `BRAINSTORM_PROMPT`
- `CHAPTER_PACKAGE_PROMPT`
- `DRAFT_PROMPT`
- `INTEGRITY_SCAN_PROMPT`
- `NEXUS_SIM_PROMPT`

> そのまま移植せず、タスクに必要な短い brief に再構成する。

## 3) Skills 用ドキュメントに載せる（役割別ノウハウ）

- Route designer 系
  - `ARCHITECT_MTP`
  - `PROJECT_GEN_BIBLE_PROMPT`
  - `INITIAL_CHAPTERS_PROMPT`
  - `INITIAL_FORESHADOWING_PROMPT`
- Scene packager 系
  - `WRITER_MTP`
  - `CHAPTER_PACKAGE_PROMPT`
- Branch validator 系
  - `ANALYST_SOUL`
  - `WHISPER_SOUL`
  - `INTEGRITY_SCAN_PROMPT`
  - `NEXUS_SIM_PROMPT`
- 追加候補（Should）
  - `EXTRACTOR_SOUL_*`
  - `SYNC_EXTRACTOR_SOUL`
  - `LIBRARIAN_SOUL`
  - `COPILOT_SOUL`
- 運用補助 Skill docs（追加）
  - `docs/skills/sync-extractor.md`
  - `docs/skills/draft-polisher.md`

## 4) 移さない / Gemini 専用として維持

- `visual.ts`
- portrait / visual description 系
- 一部 safety / summarization 補助

## 運用メモ

- DuoScript は「材料作成・戻り確認・検証」のワークベンチ。
- Codex は route / scenePackages / choice/reaction/convergence / validator修正を担当。
- 返却成果物は `updated_workspace_bundle.json` と `codex_change_summary.md` を固定。
