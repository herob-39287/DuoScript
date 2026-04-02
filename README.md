# DuoScript - 物語のアトリエ

**DuoScript** は、Google Gemini API（Gemini 3 Pro/Flash）を核に据えた、長編小説執筆のための高度なシングルページ・アプリケーション（SPA）です。「物語の設計士（Architect）」と「物語の筆者（Writer）」という2つの異なる役割を持つAIエージェントと共に、設定の構築からプロットの細分化、そして本文の執筆までをシームレスに行うことができます。

![Version](https://img.shields.io/badge/version-1.0.0--alpha-orange)
![License](https://img.shields.io/badge/license-Apache_2.0-blue)
![Gemini API](https://img.shields.io/badge/AI-Google_Gemini_3-blue)

---

## 🔁 運用モード（Codex中心 / Gemini補助）

- **Codex中心運用（推奨）**
  - Writer で `Prepare for Codex` を実行して、`workspace_bundle.json` / `codex_task.md` / `validator_report.md` / `codex_schema_reference.md` を出力
  - Codex で route / scene package / branch logic を編集
  - DuoScript に `Import Workspace`（または `Import & Apply`）で戻し、validator と draft 再構築を実行
- **Gemini補助運用**
  - `generateThreeStageDraft` などの生成機能は補助として利用
  - 正本は scene package / VN構造を優先し、本文はキャッシュとして扱う

---

### Codex 実運用手順（project / chapter / scene）

1. Writer で `Prepare for Codex` を実行し、編集スコープを選択します。
   - `project`: 全体設計の更新
   - `chapter`: 章内 scenePackages の更新
   - `scene`: 単一 scenePackage の更新
2. 出力された 4 ファイルを Codex に渡します。
   - `workspace_bundle.json`
   - `codex_task.md`
   - `validator_report.md`
   - `codex_schema_reference.md`
3. Codex は `updated_workspace_bundle.json` と `codex_change_summary.md` を返します。
4. DuoScript 側で `Import Workspace`（または `Import & Apply`）を実行します。
5. Import 後に `validateBranches` で branch validator を再実行します。
6. 残存する validator issue があれば、`codex_change_summary.md` を参照して追加修正を行います。
7. scene package を更新した場合は `Build Draft` / `rebuildDraft` を実行して本文キャッシュを更新します。


### Codex 往復の受け渡しファイル

**DuoScript → Codex（渡す4ファイル）**

- `workspace_bundle.json`
- `codex_task.md`
- `validator_report.md`
- `codex_schema_reference.md`

**Codex → DuoScript（返す2ファイル）**

- `updated_workspace_bundle.json`
- `codex_change_summary.md`

### `codex_change_summary.md` の確認ポイント

Import 前後で、少なくとも次を確認してください。

- touched entities が task scope（project/chapter/scene）から逸脱していないか
- fixed issues が `validator_report.md` の対象 issue と対応しているか
- remaining issues に理由・影響・次アクションが明記されているか
- draft rebuild 要否が更新内容（scenePackages変更有無）と一致しているか
- ID の削除/再採番が行われていないか（明示依頼がない限り禁止）

---

## ⚠️ セキュリティに関する重要なお知らせ (API Key Safety)

本アプリケーションは、環境変数等で設定された **Google Gemini API Key** を使用して動作します。

1.  **Git管理の注意**: `.env` ファイルにはAPIキーが含まれるため、**絶対にGitリポジトリにコミットしないでください**（デフォルトで `.gitignore` に含まれていますが、設定を変更する際はご注意ください）。
2.  **デプロイ時の注意**: VercelやNetlifyなどでWeb上に公開する場合、ソースコードやビルド成果物にAPIキーが含まれる可能性があります。**Basic認証などのアクセス制限をかけずにデプロイすると、APIキーが第三者に不正利用されるリスクがあります。** 原則としてローカル環境での利用、または適切な認証下での運用を推奨します。
3.  **画面共有**: アプリケーションの使用画面をSNS等で共有する際は、APIキーが映り込まないよう十分注意してください。

---

## 📚 機能ガイド

詳細な機能解説は [**FEATURES.md**](./FEATURES.md) をご覧ください。

- **Architect**: 対話を通じた設定の自動抽出 (Neural Sync)
- **Writer**: 文脈を理解した執筆支援と手動トリガーの矛盾チェック
- **Bible**: キャラクター、世界観、伏線、年表の統合管理
- **Analysis**: "もしも"のシミュレーションと整合性チェック

---

## 🤝 コミュニティとサポート

DuoScriptは個人開発によるオープンソースプロジェクトです。
持続可能な運営のため、利用や貢献に関するガイドラインを定めています。

詳しくは [**COMMUNITY.md**](./COMMUNITY.md) をご一読ください。

- **サポート**: ベストエフォート（可能な範囲）での対応となります。
- **APIキー**: ユーザー自身のキーを使用するBYOKモデルです。利用料は自己負担となります。
- **貢献**: バグ報告やプルリクエストを歓迎します。

---

## 💻 開発とビルド

DuoScriptは **Vite + React** で構築されています。以下の手順でローカル環境をセットアップできます。

### 前提条件

- Node.js (v18以上推奨)
- Google Gemini API キー ([Google AI Studio](https://aistudio.google.com/)で取得)

### セットアップ手順

1. **リポジトリのクローンと依存関係のインストール**

   ```bash
   git clone https://github.com/yourusername/duoscript.git
   cd duoscript
   npm install
   ```

2. **環境変数の設定**
   プロジェクトルートに `.env` ファイルを作成し、APIキーを設定します。

   ```env
   # .env
   API_KEY=your_gemini_api_key_here
   ```

3. **ローカルサーバーの起動**

   ```bash
   npm run dev
   ```

   ブラウザで `http://localhost:5173` を開くとアプリが起動します。

4. **本番用ビルド**
   ```bash
   npm run build
   ```
   `dist` フォルダに静的ファイルが出力されます。これを任意のWebサーバー（Netlify, Vercel, Firebase Hostingなど）にデプロイできます。

---

## 🧩 ローカル運用（ユーザー自身でビルドする前提）

本アプリは**ユーザー自身がビルドして使う運用**を想定しています。基本フローは以下です。

1. **セットアップ（前章の手順でOK）**
   - `git clone` → `npm install` を実行します。
2. **APIキーをローカルで設定**
   ```env
   # .env
   API_KEY=your_gemini_api_key_here
   ```
3. **ビルドして `dist` を配布**
   ```bash
   npm run build
   ```
   `dist` を任意の静的サーバーに置けば、以降はユーザー環境で実行できます。

> **補足**: 現状の `index.html` には Tailwind CDN / Google Fonts など外部リソース参照が含まれています。完全なオフライン運用や閉域網運用が必要な場合は、フォント・画像・CSSをローカル化してください。

---

## 🎨 コンセプト：二人の対話者

DuoScriptは、単なるテキストエディタではありません。執筆者の「創作のパートナー」として機能するよう設計されています。

1.  **物語の設計士 (Architect)**: 世界の物理法則（Canon）、全体の構成（Plan）、キャラクターの状態（State）を管理し、作者と対話しながら設定を深めます。
2.  **物語の筆者 (Writer)**: 設計士が作った「ビート（展開案）」に基づき、文体やキャラクターの視点（POV）を考慮しながら、情緒豊かな本文を紡ぎ出します。

---

## ✨ 主な機能

### 🛠️ 構想（Architect & Bible）

- **Neural Sync (対話型同期)**: 設計士とのチャットから設定の変更を自動抽出し、ワンクリックで物語設定（聖書）を更新します。
- **Nexus シミュレーション**: 「もしもあの時、彼が死んでいたら？」といった仮説を入力し、世界の理やキャラクターへの影響をシミュレートします。
- **マルチレイヤー管理**:
  - **Canon (世界の理)**: 法則、文化、用語、歴史的背景。
  - **Plan (物語の計画)**: グランドアーク、各章の戦略、タイムライン、伏線。
  - **State (動的な状態)**: キャラクターの感情、関係性（好感度）、現在地、所持品。
- **AI Artist**: キャラクターの肖像画を生成して人格をより鮮明にイメージできます。

### ✍️ 執筆（Writer & Editor）

- **POV-Aware Drafting (予定)**: 特定のキャラクターの視点を設定すると、AIはその人物が知り得ない情報を伏せて執筆します。
- **自動プロット・ビート生成**: グランドアークから章構成案を、あらすじから具体的なシーン展開（ビート）を段階的に生成します。
- **AI Copilot**: 執筆中、次の一文に迷った際に3つの異なるアプローチで続きを提案します。
- **Zen Mode**: UIを極限まで排除し、暖かい石材を基調とした色調と原稿用紙のようなタイポグラフィで、執筆に深く没入できます。

### 📊 管理（Dashboard）

- **不整合分析 (Integrity Scan)**: 膨大な設定の中に矛盾がないか、AIが全資料を横断的にスキャンして指摘します。
- **統計**: 文字数、キャラクター数、トークン使用量を可視化。

---

## 🚀 テクニカルスタック

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **AI Engine**:
  - **Gemini 3 Pro / Flash**: 高度な推論、プロット生成、本文執筆。
- **Gemini 2.5 Flash Image**: キャラクターポートレート生成。
- **Architecture**:
  - Local-First Architecture (IndexedDB)
  - PWA Support

---

## 🗺️ ロードマップと提供モデル

DuoScriptは「作家のための自由なツール」として進化を続けます。

1.  **Local-First (Current)**:
    現在のバージョンです。データは全てユーザーのデバイス内にあり、APIキーもユーザー自身のものを使用します（BYOK）。完全なプライバシーと無料（API実費のみ）での利用が可能です。
2.  **Cloud Sync (Future)**:
    将来的に、複数デバイス間の同期や、大規模な物語データのサーバーサイド推論をサポートするクラウド版を提供する予定ですが、**Local-First版の機能制限や有料化は行いません。**

---

## ⚖️ ライセンスと利用規約

本ソフトウェアは **Apache License 2.0** の下で公開されています。

- **自由な利用**: 個人・法人を問わず、無償で利用・改変・再配布・商用利用が可能です。
- **特許条項**: 本ソフトウェアの使用に関して、コントリビューターからの特許使用許諾が含まれます。
- **免責事項**: 本ソフトウェアの使用によって生じたいかなる損害（AIによる不適切な生成物、データの消失を含む）についても、開発者は責任を負いません。重要なデータはこまめにバックアップ（エクスポート）を行ってください。

---

## 🕯️ クレジット

Designed with 🧡 for all storytellers.
**DuoScript - Where imagination meets intelligence.**

---

# DuoScript - Story Atelier

**DuoScript** is an advanced single-page application (SPA) for long-form novel writing, built around the Google Gemini API (Gemini 3 Pro/Flash). With two distinct AI agent roles—**Architect** and **Writer**—you can seamlessly move from worldbuilding to plot breakdowns and finally to full prose drafting.

![Version](https://img.shields.io/badge/version-1.0.0--alpha-orange)
![License](https://img.shields.io/badge/license-Apache_2.0-blue)
![Gemini API](https://img.shields.io/badge/AI-Google_Gemini_3-blue)

---

## ⚠️ Important Security Notice (API Key Safety)

This application runs using a **Google Gemini API Key** configured via environment variables.

1.  **Git safety**: Because `.env` files contain your API key, **never commit them to Git** (they are in `.gitignore` by default—be careful if you change settings).
2.  **Deployment caution**: When publishing to Vercel, Netlify, or any public host, your source or build artifacts may expose the key. **Do not deploy without access control (e.g., Basic Auth), or the key may be abused.** We recommend local use or protected deployments.
3.  **Screen sharing**: Be careful not to expose your API key when sharing screens or screenshots.

---

## 📚 Feature Guide

For detailed explanations, see [**FEATURES.md**](./FEATURES.md).

- **Architect**: Automatic extraction of story settings from dialogue (Neural Sync)
- **Writer**: Context-aware drafting with real-time contradiction detection
- **Bible**: Unified management of characters, worldbuilding, foreshadowing, and timelines
- **Analysis**: "What-if" simulations and consistency checks

---

## 🤝 Community & Support

DuoScript is an open-source project developed by an individual. To keep it sustainable, we provide guidelines on usage and contributions.

Please read [**COMMUNITY.md**](./COMMUNITY.md).

- **Support**: Best-effort support.
- **API keys**: Bring-your-own-key (BYOK). Usage fees are the user's responsibility.
- **Contributions**: Bug reports and pull requests are welcome.

---

## 💻 Development & Build

DuoScript is built with **Vite + React**. Follow the steps below to set up locally.

### Prerequisites

- Node.js (v18+ recommended)
- Google Gemini API Key (get one at [Google AI Studio](https://aistudio.google.com/))

### Setup

1. **Clone the repo and install dependencies**

   ```bash
   git clone https://github.com/yourusername/duoscript.git
   cd duoscript
   npm install
   ```

2. **Configure environment variables**
   Create a `.env` file in the project root and set your API key.

   ```env
   # .env
   API_KEY=your_gemini_api_key_here
   ```

3. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173` in your browser.

4. **Production build**
   ```bash
   npm run build
   ```
   Static files are output to the `dist` folder. Deploy to any static host (Netlify, Vercel, Firebase Hosting, etc.).

---

## 🧩 Local-First Usage (User-Build Model)

This app assumes **users build and run it locally**. The typical flow:

1. **Setup (same as above)**
   - Run `git clone` → `npm install`.
2. **Set your API key locally**
   ```env
   # .env
   API_KEY=your_gemini_api_key_here
   ```
3. **Build and distribute `dist`**
   ```bash
   npm run build
   ```
   Place `dist` on any static server, and it will run in the user environment.

> **Note**: The current `index.html` references external resources such as Tailwind CDN and Google Fonts. For fully offline or closed-network use, you must localize fonts, images, and CSS.

---

## 🎨 Concept: Two Conversational Partners

DuoScript is more than a text editor—it is designed as a creative partner.

1.  **Architect**: Manages world rules (Canon), overall structure (Plan), and character states (State), deepening settings through dialogue with the author.
2.  **Writer**: Generates rich prose based on the Architect's "beats," accounting for style and character POV.

---

## ✨ Key Features

### 🛠️ Ideation (Architect & Bible)

- **Neural Sync (dialogue-based sync)**: Automatically extracts and updates story settings in one click.
- **Nexus simulation**: Input "What if he had died then?" to simulate impacts on the world and characters.
- **Multi-layer management**:
  - **Canon**: Rules, culture, terminology, historical context.
  - **Plan**: Grand arcs, chapter strategies, timelines, foreshadowing.
  - **State**: Character emotions, relationships, locations, inventory.
- **AI Artist & Voice**: Generate character portraits and play dialogue with AI voice for vivid personality.

### ✍️ Writing (Writer & Editor)

- **POV-aware drafting**: The AI hides information a POV character wouldn't know.
- **Auto plot/beat generation**: Expand from grand arcs to chapter outlines and then to scene beats.
- **AI Copilot**: Offers three different continuations when you get stuck.
- **Zen Mode**: Minimal UI, warm stone-like palette, and manuscript-style typography for deep focus.

### 📊 Management (Dashboard)

- **Integrity scan**: Cross-checks all materials and flags contradictions.
- **Stats**: Visualizes word counts, character counts, and token usage.

---

## 🚀 Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **AI Engine**:
  - **Gemini 3 Pro / Flash**: Advanced reasoning, plot generation, prose drafting.
  - **Gemini 2.5 Flash Image**: Character portrait generation.
  - **Gemini 2.5 Flash Preview TTS**: Character voice playback.
- **Architecture**:
  - Local-First Architecture (IndexedDB)
  - PWA Support

---

## 🗺️ Roadmap & Delivery Model

DuoScript will continue evolving as a free tool for writers.

1.  **Local-First (Current)**:
    The current version. All data stays on the user's device, and users bring their own API keys (BYOK). This provides full privacy and free use (you only pay API costs).
2.  **Cloud Sync (Future)**:
    In the future, we plan to offer cross-device sync and server-side inference for large story data. **The Local-First version will not be restricted or paywalled.**

---

## ⚖️ License & Terms

This software is released under the **Apache License 2.0**.

- **Freedom to use**: Free for individuals and businesses to use, modify, redistribute, and use commercially.
- **Patent clause**: Includes patent grants from contributors.
- **Disclaimer**: The developers are not liable for any damages (including AI-generated inaccuracies or data loss). Please back up critical data frequently.

---

## 🕯️ Credits

Designed with 🧡 for all storytellers.
**DuoScript - Where imagination meets intelligence.**
