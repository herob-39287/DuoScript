# DuoScript ノベルゲーム向け設計変更要件書: 実装可能性検討

## 結論（要約）

**実装可能です。**
ただし、現状の `StoryScene` 中心モデルは「章本文の単線生成」に最適化されているため、
要件を満たすには **データモデル拡張 + 生成パイプライン分離 + 分岐検証レイヤー追加** が必要です。

特に以下の3点を先に実装すると、要求仕様に対してリスクを抑えつつ段階移行できます。

1. `Scene Package` / `Choice` / `Reaction Variant` / `Convergence` の新スキーマ追加
2. 条件式（機械評価）と状態スコープを扱う `ConditionEvaluator` の追加
3. 本文3段階生成を「共通骨格・局所差分・再合流整文」に分離

---

## 現状とのギャップ

### 1) 分岐レベルの表現

現状 `StoryScene` は `content` + `beats` 構造であり、
「演出差分 / 感情差分 / 局所会話分岐 / 構造分岐」の4階層を直接表現できません。

**必要対応:**
- `branchLevel`（A/B/C/D相当）を Choice 単位に持たせる
- C（局所会話分岐）は `scene` 内部ノードとして表現し `merge` を必須化
- D（構造分岐）のみ Route Graph を更新

### 2) ルート/情報開示/状態軸

現状の Bible/Plan は世界観・章設計に強い一方で、
`Route`, `RevealPlan`, `StateAxis`, `BranchPolicy` を機械処理前提で保持する構造が不足しています。

**必要対応:**
- Bible 拡張に `routes[]`, `revealPlans[]`, `stateAxes[]`, `branchPolicies[]` を追加
- `unlockConditions` などを自然文ではなく式AST or DSL文字列で保持

### 3) 生成ワークフロー

現状は本文生成が章・シーン本文中心で、
局所差分だけ再生成する運用に弱いです。

**必要対応:**
- Stage1: `sharedSpine` だけ生成
- Stage2: `reactionVariants` だけ生成
- Stage3: `convergencePoint` を踏まえて統合整文

### 4) 検証レイヤー

要件の受け入れ条件（再合流必須、条件評価可能、構造分岐のみグラフ影響）を満たすには、
保存前/生成前のバリデーションが必要です。

**必要対応:**
- グラフ整合チェック（到達不能ノード、merge欠落、ループ検知）
- 条件式型チェック（未知 stateKey / 型不一致）
- 分岐昇格ルールチェック（BranchPolicy準拠）

---

## 推奨アーキテクチャ変更

## A. データモデル（Zodスキーマ）

`services/validation/schemas.ts` に以下を追加する方針が妥当です。

- `BranchLevel`: `performative | emotional | local_branch | structural`
- `NodeType`: `scene | choice | gate | merge | jump | ending`
- `ConditionExpression`（文字列DSL、将来的にASTに移行可能）
- `RouteSchema`, `RevealPlanSchema`, `StateAxisSchema`, `BranchPolicySchema`
- `ScenePackageSchema`
  - `sharedSpine`
  - `choicePoints[]`
  - `reactionVariants[]`
  - `convergencePoint`

**互換戦略:**
- 既存 `StoryScene` は残し、`ScenePackage` を optional で共存
- マイグレーションで旧 `StoryScene` から最小 `ScenePackage` を自動生成

## B. 条件評価エンジン

`services/conditions/` を新設して次を実装します。

- Tokenizer / Parser（`AND OR NOT` + 比較演算子）
- Evaluator（state storeを入力に真偽を返す）
- Type checker（`knowledge` に数値比較していないか等を検知）

**実装優先:**
- v1は文字列DSL + 安全な独自パーサ（`eval`不使用）
- v2でUI式ビルダー導入（非エンジニア向け）

## C. 分岐グラフ管理

`scene/choice/gate/merge/jump/ending` を有向グラフとして管理し、
`structural` 分岐のみ Route Graph に反映します。

- `local_branch` は `ScenePackage` 内で閉じる
- `merge` ノードへの到達を必須化
- `convergencePolicy` で state統合規則を明示

## D. 3段階生成パイプライン

既存Writer系フックを次の責務に分離します。

1. Shared Spine Drafting
2. Reaction Variant Drafting
3. Convergence & Polish

各段階の入出力を保存し、段階単位で再実行可能にします。

---

## 実装ステップ（現実的な導入順）

### Phase 1: モデル拡張（後方互換あり）

- スキーマ追加（Route/Reveal/StateAxis/BranchPolicy/ScenePackage）
- 旧データの読込互換
- 保存時バリデーション（必須項目、branchLevel）

**完了条件:** 既存プロジェクトが壊れず新項目を保持できる。

### Phase 2: 条件式・状態評価

- 条件DSLパーサ/評価器
- state scope実装（global/route/chapter/scene/transient/knowledge/affinity）
- availability/visibility/unlock の機械判定

**完了条件:** 自然文条件に依存せず選択肢可視・可用判定できる。

### Phase 3: シーン分岐編集

- Scene Package編集UI
- Choice / Variant / Convergence 編集
- 分岐可視化（ミニグラフ）

**完了条件:** 1シーン内局所分岐と再合流をUIで管理できる。

### Phase 4: 3段階生成移行

- Stage1/2/3 を個別実行可能にする
- 差分ブロックのみ再生成
- 統合整文で口調統一

**完了条件:** 「第2段階だけ差し替え」が可能。

### Phase 5: 整合性検証

- merge欠落検知
- 構造分岐のルート影響チェック
- RevealPlan整合（allowedRoutes / spoilerLevel）

**完了条件:** 受け入れ条件を自動テスト可能。

---

## 主なリスクと対策

1. **データ複雑化によるUI肥大化**
   - 対策: 初期は「簡易モード（A/Bのみ）」と「詳細モード（C/D含む）」を分離

2. **分岐爆発**
   - 対策: BranchPolicyで `local_branch` 優先、昇格条件を明文化

3. **再合流の不自然さ**
   - 対策: convergencePolicy + Stage3専用プロンプト + 重複抑制ルール

4. **既存資産との互換性**
   - 対策: マイグレーションとフォールバック表示（旧 `StoryScene` 維持）

---

## 工数感（目安）

- Phase 1: 1〜2週間
- Phase 2: 1週間
- Phase 3: 2〜3週間
- Phase 4: 1〜2週間
- Phase 5: 1週間

**合計:** 約6〜9週間（1〜2名体制、既存AIサービス再利用前提）

---

## 最終判断

- 本要件は、DuoScriptの現行思想（構造化→生成→検証）と整合しており、**実装適合性は高い**。
- 最大のポイントは、本文中心モデルから「Scene Package中心モデル」へ責務を移すこと。
- 後方互換を維持した段階導入を取れば、既存機能を壊さず移行可能。

## 9. AI責務再編要件

### 9.1 Architect

**担当:**
- 物語骨格
- 章構成
- ルート大枠
- 情報開示計画
- Branch Policy 初期案

### 9.2 Route Planner

**担当:**
- 分岐点設計
- エンド条件設計
- `unlockConditions` 設計
- 構造分岐への昇格判定

### 9.3 Scene Designer

**担当:**
- beat → scene package 変換
- `purpose` 定義
- `mandatoryInfo` 定義
- `sharedSpine` 設計

### 9.4 Scene Reaction Designer

**担当:**
- `choicePoints` 設計
- `intentTag` 設計
- `reactionVariants` 設計
- `convergencePoint` 設計

### 9.5 Writer

**担当:**
- Shared Spine 本文化
- Reaction Variant 本文化
- 最終整文

### 9.6 Analysis / Validator

**担当:**
- 設定整合性
- 口調整合性
- 情報開示過多/不足
- scene purpose 逸脱検知

### 9.7 Branch Validator

**担当:**
- 到達不能分岐検出
- 条件衝突検出
- 未使用状態検出
- 参照されるが更新されない状態検出
- 再合流不能分岐検出
- spoiler leakage 検出

### 9.8 要件

- 分岐専用責務が、本文生成責務から独立していること
- 局所分岐と大域分岐の責務を分離できること
- AI任せの部分とルールベース検証の部分を切り分けること

---

## 10. 検証要件

### 10.1 構造検証

- 到達不能 `scene/gate/ending` の検出
- 再合流点なし局所分岐の検出
- 実現不能な `unlockConditions` の検出
- dead branch の検出

### 10.2 状態検証

- 未参照状態の検出
- 未更新状態の検出
- 常に真/常に偽の条件検出
- 状態爆発の警告

### 10.3 情報検証

- 1シーン内情報量過多の検出
- `revealPolicy` 違反の検出
- 他ルートのサプライズ破壊検出
- `mandatoryInfo` 未反映の検出

### 10.4 選択肢検証

- 各選択肢の意味タグ存在確認
- 即時効果または遅延効果の存在確認
- 差が薄すぎる選択肢の警告
- 不要に重すぎる選択肢の警告

### 10.5 文体検証

- 口調ブレ検出
- `sharedSpine` と `variant` の接続不自然性検出
- 再合流部断絶検出

### 10.6 受け入れ条件

- 作品全体検証とシーン単位検証を分離実行できること
- AIによるレビューとルールベース検証を併用できること

---

## 11. UI要件

### 11.1 Writer画面再編

中央編集対象を「章本文」単独から、以下のモードへ拡張する。

- Shared Spine 編集
- Choice / Variant 編集
- Convergence 編集
- Final Draft 表示

### 11.2 右パネル表示対象

切替可能対象:

- beats
- scenePackages
- route notes
- reveal notes
- state axes
- branch issues

### 11.3 分岐可視化

最低限、以下を可視化する。

- 局所分岐と構造分岐の区別
- 各選択肢の影響
- 再合流点
- routeImpact
- unlockImpact

### 11.4 受け入れ条件

- シーン単位で「骨格・差分・再合流」が見渡せること
- 本文編集時に choice と variant を参照可能であること

---

## 12. データモデル変更要件

### 12.1 ChapterPackage 拡張

現行の `strategy / beats / draft` 中心から、主成果物を `scenePackages` 中心へ移行する。

**必須追加:**

- `scenePackages`
- `routeNotes`
- `revealNotes`
- `statePolicies`
- `branchPolicies`

`draft` は主成果物ではなく補助成果物とする。

### 12.2 StoryScene の位置づけ変更

`content` を正本にしない。

**正本:**

- `sharedSpine`
- `reactionVariants`
- `convergencePoint`
- `state changes`
- `conditions`

**`content` の扱い:**

- 最終統合表示用
- キャッシュ
- エクスポート用

### 12.3 選択肢モデル

最低限、以下を持つ。

- `id`
- `text`
- `branchLevel`
- `intentTag`
- `immediateReactionVariantId`
- `immediateEffects`
- `delayedEffects`
- `convergenceTarget`
- `routeImpact`
- `unlockImpact`
- `visibilityCondition`
- `availabilityCondition`

---

## 13. 移行要件

### 段階1

- ChapterPackage に `scenePackages` を追加
- beat から scenePackage を生成
- Writer 第1段階を Shared Spine ベースへ変更

### 段階2

- `choicePoints / reactionVariants / convergencePoint` を導入
- Writer 第2段階を差分生成へ変更

### 段階3

- `Route / Reveal Plan / State Axes / 条件式` を導入
- Branch Validator を導入

### 段階4

- `content` 中心の章本文依存を薄める
- Scene Package を正本へ移行
- ルールベース検証を強化

---

## 14. 非機能要件

### 14.1 分岐爆発抑制

- 数行差分は枝にしない
- 局所差分は再合流前提とする
- 構造分岐は限定条件でのみ許可する

### 14.2 追跡可能性

- 各差分がどの choice 由来か追えること
- 各条件がどの状態に依存するか追えること
- 各scenePackageの生成根拠が残ること

### 14.3 部分再生成

- Shared Spine だけ再生成可能
- Reaction Variant だけ再生成可能
- 整文だけ再実行可能
- ルート構造を壊さず差分だけ差し替え可能

---

## 15. 優先度

### Must

- Scene Package 導入
- Choice Point 導入
- Reaction Variant 導入
- Convergence Point 導入
- 条件式の形式化
- State Scope 導入
- 本文3段階の再定義
- Branch Validator 導入

### Should

- Route / Reveal Plan / Branch Policy 導入
- UIでの分岐可視化
- 部分再生成
- 合流規則の明示

### Could

- 演出命令の構造化
- エクスポート用中間フォーマット
- ルートグラフ可視化強化

---

## 16. 完了条件

以下を満たした時点で、本設計変更は完了とみなす。

- 章の主成果物が scenePackages になっている
- 1シーン内の選択肢差分を、全文分岐ではなく局所差分として管理できる
- 局所分岐に再合流点が必須化されている
- 構造分岐だけがルートグラフへ影響する
- 本文3段階が以下に再定義されている
  - Shared Spine
  - Reaction Variants
  - Convergence & Polish
- 条件式と状態スコープが機械評価可能な形で定義されている
- Branch Validator により、到達不能分岐・条件矛盾・ネタバレ漏洩を検出できる
- UI上でシーン骨格・差分・再合流が確認できる

---

## 要約

この設計変更の核心は、
「章本文を直接書く仕組み」から、「シーン骨格を作り、局所差分を載せ、再合流させ、その上で本文化する仕組み」へ変えることです。

さらに、複雑なノベルゲーム分岐へ耐えるためには、
条件・状態・合流を自然文ではなく機械的に定義することが必須です。

---

## 17. AIミューズ適用方針（本仕様への具体適用）

現行のAIミューズは「世界設定 → 章構成 → 伏線」の3段階初期生成に強みがある。
本仕様へ適用する際は、**既存3段階を残したまま、Scene Package系の中間生成を後段追加**する。

### 17.1 適用の基本戦略

- 既存ミューズの役割（世界・章・伏線の初期化）は維持
- 章生成の直後に、`chapter -> scenePackages` 変換フェーズを追加
- 既存 Writer の本文生成を「Shared Spine / Variant / Convergence」に責務分割
- 分岐整合性はミューズ任せにせず Branch Validator でルール検証

### 17.2 役割マッピング（既存AI + 新規AI）

- 既存 `Analysis/MuseBibleGen`:
  - 世界観・登場人物・法則の初期種を生成
- 既存 `Analysis/MuseChapterGen`:
  - 章構成を生成（今後は Scene Package 展開の入力元）
- 既存 `Analysis/MuseForeshadowingGen`:
  - 伏線・スレッド生成（Reveal Plan と整合させる）
- 新規 `RoutePlannerAgent`:
  - ルート骨格 / エンド条件 / unlock条件の設計
- 新規 `SceneDesignerAgent`:
  - beats から sharedSpine / purpose / mandatoryInfo 生成
- 新規 `SceneReactionDesignerAgent`:
  - choicePoints / reactionVariants / convergencePoint 生成
- 既存 Writer:
  - Stage1/2/3 の本文化に専念
- 既存 Analysis + 新規 BranchValidator:
  - 情報過不足・口調整合 + 分岐整合（到達不能/矛盾/漏洩）

### 17.3 最小実装ステップ（AIミューズ拡張版）

1. **Muse後処理でScene Packageを生成**
   - `MuseChapterGen` の結果に対し、各章で `scenePackages[]` を自動作成
   - 最初は `sharedSpine` のみ埋める（choiceは空配列で開始）

2. **Route/Reavel/State の下書きをミューズ出力に追加**
   - 章生成時に `routeNotes`, `revealNotes`, `statePolicies` の草案を出す
   - 厳密な条件式は後段（Route Planner）で機械化する

3. **Writer呼び出しを3ジョブに分割**
   - Job A: Shared Spine Drafting
   - Job B: Reaction Variant Drafting
   - Job C: Convergence & Polish

4. **Branch Validatorを保存前に必須実行**
   - `local_branch` に merge がない場合は保存拒否
   - `unlockConditions` の未定義状態参照をエラー化

5. **UIで編集導線を分離**
   - Writer画面で「骨格」「差分」「再合流」「最終稿」をタブ分離
   - 右パネルで branch issues を常時参照可能にする

### 17.4 プロンプト設計の指針

- ミューズ系プロンプトでは「全文生成」ではなく「中間構造(JSON)生成」を優先
- choice生成時は必ず `intentTag` と `convergenceTarget` を要求
- variant生成時は「sharedSpineを改変しない」制約を固定句として入れる
- polish生成時は「再合流の自然化」「口調統一」「情報過多抑制」を評価軸にする

### 17.5 運用上の重要ルール

- AIの提案は下書きであり、採用前にルール検証を通す
- 構造分岐への昇格は Branch Policy と Route Planner の承認制にする
- 作品全体検証（重い）とシーン単位検証（軽い）を分けて実行する

### 17.6 期待効果

- 既存ミューズ資産を活かしつつ、ノベルゲーム向け分岐設計へ段階移行できる
- 本文生成と分岐設計を分業化し、品質管理をルールベースで安定化できる
- 部分再生成（Spine/Variant/Polish）によりリライトコストを抑制できる
