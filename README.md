# DuoScript - 物語のアトリエ

**DuoScript** は、Google Gemini API（Gemini 3 Pro/Flash）を核に据えた、長編小説執筆のための高度なシングルページ・アプリケーション（SPA）です。「物語の設計士（Architect）」と「物語の筆者（Writer）」という2つの異なる役割を持つAIエージェントと共に、設定の構築からプロットの細分化、そして本文の執筆までをシームレスに行うことができます。

![Version](https://img.shields.io/badge/version-1.0.0--alpha-orange)
![License](https://img.shields.io/badge/license-MIT-stone)
![Gemini API](https://img.shields.io/badge/AI-Google_Gemini_3-blue)

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
- **AI Artist & Voice**: キャラクターの肖像画を生成し、AIボイスでセリフを再生。人格をより鮮明にイメージできます。

### ✍️ 執筆（Writer & Editor）
- **POV-Aware Drafting**: 特定のキャラクターの視点を設定すると、AIはその人物が知り得ない情報を伏せて執筆します。
- **自動プロット・ビート生成**: グランドアークから章構成案を、あらすじから具体的なシーン展開（ビート）を段階的に生成します。
- **AI Copilot**: 執筆中、次の一文に迷った際に3つの異なるアプローチで続きを提案します。
- **Zen Mode**: UIを極限まで排除し、暖かい石材を基調とした色調と原稿用紙のようなタイポグラフィで、執筆に深く没入できます。

### 📊 管理（Dashboard）
- **不整合分析 (Integrity Scan)**: 膨大な設定の中に矛盾がないか、AIが全資料を横断的にスキャンして指摘します。
- **統計**: 文字数、キャラクター数、トークン使用量を可視化。

---

## 🚀 テクニカルスタック

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS
- **AI Engine**: 
  - **Gemini 3 Pro / Flash**: 高度な推論、プロット生成、本文執筆。
  - **Gemini 2.5 Flash Image**: キャラクターポートレート生成。
  - **Gemini 2.5 Flash Preview TTS**: キャラクターボイス再生。
- **Architecture**: 
  - ESM (Import Map) によるゼロ・ビルド環境。
  - ローカルストレージによるオフライン・自動保存対応。

---

## 🛠️ セットアップと実行

本アプリは、Google Gemini APIキーを環境変数 `process.env.API_KEY` から読み込む構成になっています。

1.  プロジェクトルートに `index.html` と `index.tsx` を配置します。
2.  適切な環境でAPIキーを設定し、ウェブサーバーで実行します。

※ データの保存はすべてブラウザの `localStorage` で行われるため、サーバーサイドのデータベース設定は不要です。

---

## ⚖️ 安全性とポリシー

DuoScriptはGoogleの安全性ガイドラインに準拠しています。性的、暴力、ヘイトスピーチなど、ポリシーに抵触する表現を含む生成要求は、AIの安全フィルターによって拒否される場合があります。創作の自由を尊重しつつ、AIの適切な利用をお願いいたします。

---

## 🕯️ クレジット

Designed with 🧡 for all storytellers.
**DuoScript - Where imagination meets intelligence.**