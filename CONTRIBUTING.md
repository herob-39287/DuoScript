# Contributing to DuoScript

DuoScriptのコミュニティに関心をお寄せいただき、ありがとうございます！
このドキュメントでは、開発者としてプロジェクトに参加するための手順とガイドラインをまとめています。

なお、プロジェクトの全体的な理念や運営方針については [COMMUNITY.md](./COMMUNITY.md) をご一読ください。

## 🛠 開発環境のセットアップ (Getting Started)

DuoScriptは、React (Vite) + TypeScript で構築されたクライアントサイド・アプリケーションです。

### 前提条件

- Node.js (v18以上)
- npm
- Google Gemini API キー ([Google AI Studio](https://aistudio.google.com/)で取得)

### 手順

1. **リポジトリのフォークとクローン**

   ```bash
   git clone https://github.com/your-username/duoscript.git
   cd duoscript
   ```

2. **依存関係のインストール**

   ```bash
   npm install
   ```

3. **環境変数の設定**
   `.env` ファイルを作成し、APIキーを設定してください（開発サーバー起動に必要です）。

   ```env
   # .env
   API_KEY=your_gemini_api_key
   ```

4. **開発サーバーの起動**
   ```bash
   npm run dev
   ```
   `http://localhost:5173` でアプリが起動します。

## 📐 開発ガイドライン (Guidelines)

### アーキテクチャの方針

- **Local-First**: データは全てIndexedDBに保存されます。サーバーサイドのDBを追加するような変更は、プロジェクトのコアコンセプト（プライバシー重視・BYOK）と矛盾しないよう慎重に検討してください。
- **Modular Monolith**: コンポーネントやロジックは機能単位（Architect, Writer, Plotter）でモジュール化されています。循環参照を避けるため、`services/` や `hooks/` の責務を意識してください。

### Gemini API の使用について

`@google/genai` SDKを使用しています。

- **Safety Settings**: 安全性フィルタを無効化する変更は受け付けていません。
- **Model**: 原則として `gemini-3-pro-preview` (推論・構成) と `gemini-3-flash-preview` (執筆・タスク処理) を使い分けています。

### コードスタイル

- TypeScriptの型定義を厳守してください（`any` の使用は極力避ける）。
- UIコンポーネントは `src/components/ui/DesignSystem.tsx` (または `index.ts`) からインポートし、デザインの一貫性を保ってください。

## 🔄 プルリクエスト (Pull Requests)

1. **Issueの作成**: 大きな変更を加える前に、Issueで変更内容を提案してください。
2. **ブランチ**: `main` ブランチからトピックブランチを作成してください（例: `feature/nexus-improvement`）。
3. **コミットメッセージ**: 変更内容がわかるように記述してください。
4. **PRの作成**: PRテンプレートに従い、変更の目的と影響範囲を記述してください。

## 🧪 テスト

現在、自動テストスイートは準備中です。
PRを提出する際は、以下の動作確認を手動で行ってください。

- 新規プロジェクトの作成
- Neural Syncによる設定の抽出と反映
- Writerでの執筆とAI補完
- データの保存とリロード（永続化の確認）

---

Happy Coding! 🚀
