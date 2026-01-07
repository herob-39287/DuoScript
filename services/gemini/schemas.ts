
import { Type } from "@google/genai";

/**
 * 変更提案 (SyncOperation) 仕様
 * [RULE]: Type.OBJECT must contain properties.
 */
export const syncOperationSchema = {
  type: Type.OBJECT,
  description: `
    [CONSTRAINT]: opは'add','update','delete','set'のいずれか。valueはpathに応じた構造を維持せよ。
    [PATH GUIDANCE]:
      - 'grandArc': 物語全体の大筋 (String)
      - 'timeline': 時系列イベント (Object)
      - 'chapters': 章やプロットビート (Object)
      - 'entries': 用語集 (Object)
  `,
  properties: {
    op: { type: Type.STRING, description: "操作タイプ: 'add', 'update', 'delete', 'set'" },
    path: { type: Type.STRING, description: "対象パス: 'characters', 'laws', 'entries', 'timeline', 'foreshadowing', 'grandArc', 'volumes' 等" },
    targetId: { type: Type.STRING, description: "既存項目のUUID（不明な場合は省略可）" },
    targetName: { type: Type.STRING, description: "対象の固有名詞。項目特定のアンカーとなる (必ず日本語で記述すること)" },
    field: { type: Type.STRING, description: "特定のフィールドのみ更新する場合に指定 (例: 'profile.name')" },
    isHypothetical: { type: Type.BOOLEAN, description: "Trueの場合、これは正史ではなく「もしも」の可能性として扱う" },
    value: { 
      type: Type.OBJECT, 
      description: "pathに対応するデータ。フラットなキー構造を推奨。全ての値は日本語であること。",
      properties: {
        name: { type: Type.STRING, description: "名称/氏名 (日本語)" },
        title: { type: Type.STRING, description: "題名 (日本語)" },
        event: { type: Type.STRING, description: "イベント名 (日本語)" },
        concept: { type: Type.STRING, description: "概念/テーマ (日本語)" },
        description: { type: Type.STRING, description: "概要/説明文 (日本語)" },
        content: { type: Type.STRING, description: "本文/内容 (日本語)" },
        summary: { type: Type.STRING, description: "あらすじ/要約 (日本語)" },
        appearance: { type: Type.STRING, description: "キャラクターの外見描写 (日本語)" },
        personality: { type: Type.STRING, description: "キャラクターの性格/性質 (日本語)" },
        background: { type: Type.STRING, description: "キャラクターの過去/背景設定 (日本語)" },
        traits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "特徴タグのリスト (日本語)" },
        motivation: { type: Type.STRING, description: "動機/目的 (日本語)" },
        flaw: { type: Type.STRING, description: "欠点/弱点 (日本語)" },
        arc: { type: Type.STRING, description: "物語における変化/アーク (日本語)" },
        timeLabel: { type: Type.STRING, description: "時間表示（年号など）" },
        importance: { type: Type.STRING, description: "重要度 (Minor, Major, Climax)" },
        status: { type: Type.STRING, description: "状態/ステータス" },
        role: { type: Type.STRING, description: "役割 (Protagonist, Antagonist, Supporting)" },
        location: { type: Type.STRING, description: "現在の所在場所 (日本語)" },
        health: { type: Type.STRING, description: "健康状態 (日本語)" },
        relatedEntityIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "関連するエンティティ(登場人物,アイテム等)のIDリスト" },
        involvedCharacterIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "関与するキャラクターIDリスト" },
        // Expanded Foreshadowing fields
        clues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "読者に真実を暗示するための具体的な手がかり・伏線描写 (日本語)" },
        redHerrings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "読者を誤認させるためのミスリード要素 (日本語)" },
        // New Fields for expanded Bible types
        order: { type: Type.INTEGER, description: "順序/巻数" },
        habitat: { type: Type.STRING, description: "生息地 (日本語)" },
        dangerLevel: { type: Type.STRING, description: "危険度 (Safe, Caution, Deadly, Catastrophic)" },
        dropItems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "ドロップアイテム (日本語)" },
        lifespan: { type: Type.STRING, description: "寿命 (日本語)" },
        cost: { type: Type.STRING, description: "コスト/代償 (日本語)" },
        mechanics: { type: Type.STRING, description: "メカニクス/仕組み (日本語)" },
      }
    },
    rationale: { type: Type.STRING, description: "この変更が必要な論理的・文学的な理由 (必ず日本語で記述すること)" },
    evidence: { type: Type.STRING, description: "根拠となった発言や原稿の引用" },
    confidence: { type: Type.NUMBER, description: "確信度 (0.0-1.0)" }
  },
  required: ["op", "path", "targetName", "value", "rationale", "confidence"]
};

/**
 * 意図検出 仕様
 */
export const detectionSchema = {
  type: Type.OBJECT,
  description: "ユーザーの発言から、物語設定の変更意志やシミュレーションの要求を検出する。",
  properties: {
    hasChangeIntent: { type: Type.BOOLEAN, description: "設定変更の意志があるか" },
    isHypothetical: { type: Type.BOOLEAN, description: "仮定の話（もし〜なら）をしているか" },
    domains: { type: Type.ARRAY, items: { type: Type.STRING }, description: "対象領域 ('ENTITIES', 'FOUNDATION', 'NARRATIVE', 'FORESHADOWING')" },
    instructionSummary: { type: Type.STRING, description: "抽出タスクへの指示概要 (日本語)" }
  },
  required: ["hasChangeIntent", "isHypothetical", "domains", "instructionSummary"]
};

/**
 * 整合性スキャン 仕様
 */
export const integrityScanSchema = {
  type: Type.OBJECT,
  description: "物語設定と執筆内容の矛盾を検出する。",
  properties: {
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ruleId: { type: Type.STRING },
          type: { type: Type.STRING, description: "Contradiction, Duplicate, Incomplete" },
          description: { type: Type.STRING, description: "日本語で記述" },
          suggestion: { type: Type.STRING, description: "日本語で記述" },
          severity: { type: Type.STRING, description: "Low, Medium, High" },
          citations: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { 
                sourceId: { type: Type.STRING }, 
                textSnippet: { type: Type.STRING },
                label: { type: Type.STRING }
              },
              required: ["textSnippet", "label"]
            } 
          }
        },
        required: ["type", "description", "suggestion", "severity"]
      }
    }
  },
  required: ["issues"]
};

/**
 * Whisper 仕様
 */
export const whisperSchema = {
  type: Type.OBJECT,
  description: "執筆中の作家への短い助言。",
  properties: {
    ruleId: { type: Type.STRING },
    text: { type: Type.STRING, description: "助言内容 (日本語)" },
    type: { type: Type.STRING, description: "info, alert" },
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          textSnippet: { type: Type.STRING }
        }
      }
    }
  },
  required: ["text", "type", "ruleId"]
};

/**
 * AICopilot 次の一文提案 仕様
 */
export const suggestionsSchema = {
  type: Type.ARRAY,
  description: "次に続く文章の候補（3件）。必ず日本語で。",
  items: { type: Type.STRING }
};

/**
 * 章パッケージ生成 仕様
 */
export const chapterPackageSchema = {
  type: Type.OBJECT,
  properties: {
    strategy: {
      type: Type.OBJECT,
      properties: {
        milestones: { type: Type.ARRAY, items: { type: Type.STRING } },
        forbiddenResolutions: { type: Type.ARRAY, items: { type: Type.STRING } },
        characterArcProgress: { type: Type.STRING, description: "日本語で記述" },
        pacing: { type: Type.STRING }
      },
      required: ["milestones", "pacing"]
    },
    beats: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "日本語で記述" }
        },
        required: ["text"]
      }
    },
    draft: { type: Type.STRING, description: "日本語で記述" }
  },
  required: ["strategy", "beats", "draft"]
};

/**
 * Nexus シミュレーション 仕様
 */
export const nexusSchema = {
  type: Type.OBJECT,
  properties: {
    impactOnCanon: { type: Type.STRING, description: "日本語で記述" },
    impactOnState: { type: Type.STRING, description: "日本語で記述" },
    alternateTimeline: { type: Type.ARRAY, items: { type: Type.STRING }, description: "日本語で記述" }
  },
  required: ["impactOnCanon", "impactOnState", "alternateTimeline"]
};

/**
 * プロジェクト初期生成 仕様
 */
export const projectGenSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "日本語で記述" },
    genre: { type: Type.STRING, description: "日本語で記述" },
    bible: {
      type: Type.OBJECT,
      properties: {
        setting: { type: Type.STRING, description: "日本語で記述" },
        grandArc: { type: Type.STRING, description: "日本語で記述" }
      },
      required: ["setting", "grandArc"]
    }
  },
  required: ["title", "genre", "bible"]
};

/**
 * Default Responses for fallbacks
 */
export const DEFAULT_RESPONSES = {
  DETECTION: { hasChangeIntent: false, isHypothetical: false, domains: [], categories: [], instructionSummary: "" },
  SUGGESTIONS: ["...", "...", "..."],
  CHAPTER_PACKAGE: { strategy: { milestones: ["導入", "展開", "結末"], pacing: "Normal" }, beats: [{ text: "状況の提示" }], draft: "" },
  NEXUS: { impactOnCanon: "なし", impactOnState: "維持", alternateTimeline: ["変化なし"] },
  PROJECT_GEN: { title: "無題", genre: "ファンタジー", bible: { setting: "...", grandArc: "..." } }
};
