
# DuoScript - 物語のアトリエ

**DuoScript** は、Google Gemini API（Gemini 3 Pro/Flash）を核に据えた、長編小説執筆のための高度なシングルページ・アプリケーション（SPA）です。「物語の設計士（Architect）」と「物語の筆者（Writer）」という2つの異なる役割を持つAIエージェントと共に、設定の構築からプロットの細分化、そして本文の執筆までをシームレスに行うことができます。

![Version](https://img.shields.io/badge/version-1.0.0--alpha-orange)
![License](https://img.shields.io/badge/license-Apache_2.0-blue)
![Gemini API](https://img.shields.io/badge/AI-Google_Gemini_3-blue)

<!-- スクリーンショット (リポジトリに画像をアップロード後、パスを修正してください) -->
<p align="center">
  <img src="docs/screenshot_dashboard.png" alt="DuoScript Dashboard" width="100%" style="border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
</p>

---

## ⚠️ セキュリティに関する重要なお知らせ (API Key Safety)

本アプリケーションは、環境変数等で設定された **Google Gemini API Key** を使用して動作します。

1.  **Git管理の注意**: `.env` ファイルにはAPIキーが含まれるため、**絶対にGitリポジトリにコミットしないでください**（デフォルトで `.gitignore` に含まれています）。
2.  **デプロイ時の注意**: VercelやNetlifyなどでWeb上に公開する場合、ソースコードやビルド成果物にAPIキーが含まれる可能性があります。**Basic認証などのアクセス制限をかけずにデプロイすると、APIキーが第三者に不正利用されるリスクがあります。** 原則としてローカル環境での利用、または適切な認証下での運用を推奨します。
3.  **画面共有**: アプリケーションの使用画面をSNS等で共有する際は、APIキーが映り込まないよう十分注意してください。

---

## 📚 機能ガイド

詳細な機能解説は [**FEATURES.md**](./FEATURES.md) をご覧ください。

- **Architect**: 対話を通じた設定の自動抽出 (Neural Sync)
- **Writer**: 文脈を理解した執筆支援とリアルタイム矛盾検知
- **Bible**: キャラクター、世界観、伏線、年表の統合管理
- **Analysis**: "もしも"のシミュレーションと整合性チェック

---

## 💻 開発とビルド

DuoScriptは **Vite + React** で構築されています。以下の手順でローカル環境をセットアップできます。

### 前提条件
- Node.js (v18以上推奨)
- Google Gemini API キー ([Google AI Studio](https://aistudio.google.com/)で取得)
  > **注意**: 本アプリは `gemini-3-pro-preview` や `gemini-2.5-flash-image` などの最新モデルを使用します。これらが利用可能なAPIキーをご用意ください。

### セットアップ手順

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/yourusername/duoscript.git
   cd duoscript
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **環境変数の設定**
   プロジェクトルートに `.env` ファイルを作成し、APIキーを設定します。
   ```env
   # .env
   API_KEY=your_gemini_api_key_here
   ```

4. **ローカルサーバーの起動**
   ```bash
   npm run dev
   ```
   ブラウザで `http://localhost:5173` を開くとアプリが起動します。

---

## 📂 プロジェクト構造

```text
src/
├── components/        # UIコンポーネント (Plotter, Writer, Dashboard等)
├── contexts/          # React Context (状態管理)
├── hooks/             # カスタムフック (ビジネスロジック)
├── services/          # 外部サービス連携
│   ├── gemini/        # AIエージェント (Architect, Writer等) の実装
│   ├── repositories/  # IndexedDBへのデータアクセス
│   ├── sync/          # Neural Sync (設定抽出・適用) エンジン
│   └── schema/        # データスキーマ定義 (Zod)
├── store/             # Reducer定義
├── types/             # 型定義
└── utils/             # ユーティリティ関数
```

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
- **マルチレイヤー管理**: Canon (世界の理)、Plan (物語の計画)、State (動的な状態) を多層的に管理。
- **AI Artist & Voice**: キャラクターの肖像画を生成し、AIボイスでセリフを再生。

### ✍️ 執筆（Writer & Editor）
- **POV-Aware Drafting**: 特定のキャラクターの視点を設定すると、AIはその人物が知り得ない情報を伏せて執筆します。
- **自動プロット・ビート生成**: グランドアークから章構成案を、あらすじから具体的なシーン展開（ビート）を段階的に生成します。
- **AI Copilot & Zen Mode**: 次の一文を提案するCopilotや、没入感を高めるZen Modeを搭載。

### 📊 管理（Dashboard）
- **不整合分析 (Integrity Scan)**: 膨大な設定の中に矛盾がないか、AIが全資料を横断的にスキャンして指摘します。
- **Local-First & PWA**: データは全てローカル(IndexedDB)に保存され、オフラインでも動作します。

---

## 🤝 コミュニティとサポート

DuoScriptは個人開発によるオープンソースプロジェクトです。
持続可能な運営のため、利用や貢献に関するガイドラインを定めています。

詳しくは [**COMMUNITY.md**](./COMMUNITY.md) をご一読ください。

- **サポート**: ベストエフォート（可能な範囲）での対応となります。
- **APIキー**: ユーザー自身のキーを使用するBYOKモデルです。利用料は自己負担となります。
- **貢献**: バグ報告やプルリクエストを歓迎します。

---

## ⚖️ ライセンスと利用規約

本ソフトウェアは **Apache License 2.0** の下で公開されています。

*   **自由な利用**: 個人・法人を問わず、無償で利用・改変・再配布・商用利用が可能です。
*   **特許条項**: 本ソフトウェアの使用に関して、コントリビューターからの特許使用許諾が含まれます。
*   **免責事項**: 本ソフトウェアの使用によって生じたいかなる損害（AIによる不適切な生成物、データの消失を含む）についても、開発者は責任を負いません。重要なデータはこまめにバックアップ（エクスポート）を行ってください。

---

## 🕯️ クレジット

Designed with 🧡 for all storytellers.
**DuoScript - Where imagination meets intelligence.**
