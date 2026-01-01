
import { Type } from "@google/genai";

/**
 * 変更提案 (SyncOperation) 仕様
 * [RULE]: Type.OBJECT must contain properties.
 */
export const syncOperationSchema = {
  type: Type.OBJECT,
  description: `
    [CONSTRAINT]: opは'add','update','delete','set'のいずれか。valueはpathに応じた構造を維持せよ。
    [MAPPING_GUIDE]: Characters等、内部でネストされている項目についても、可能な限りフラットなキー（例: 'name' や 'location'）で提供せよ。システムが自動で'profile.name'や'state.location'にマッピングする。
  `,
  properties: {
    op: { type: Type.STRING, description: "操作タイプ: 'add', 'update', 'delete', 'set'" },
    path: { type: Type.STRING, description: "対象パス: 'characters', 'laws', 'entries', 'timeline', 'foreshadowing'等" },
    targetId: { type: Type.STRING, description: "既存項目のUUID（不明な場合は省略可）" },
    targetName: { type: Type.STRING, description: "対象の固有名詞。項目特定のアンカーとなる" },
    field: { type: Type.STRING, description: "特定のフィールドのみ更新する場合に指定 (例: 'profile.name')" },
    isHypothetical: { type: Type.BOOLEAN, description: "Trueの場合、これは正史ではなく「もしも」の可能性として扱う" },
    value: { 
      type: Type.OBJECT, 
      description: "pathに対応するデータ。フラットなキー構造を推奨。",
      properties: {
        name: { type: Type.STRING },
        title: { type: Type.STRING },
        event: { type: Type.STRING },
        concept: { type: Type.STRING },
        description: { type: Type.STRING },
        content: { type: Type.STRING },
        summary: { type: Type.STRING },
        timeLabel: { type: Type.STRING },
        importance: { type: Type.STRING },
        status: { type: Type.STRING },
        role: { type: Type.STRING },
        motivation: { type: Type.STRING },
        location: { type: Type.STRING },
        health: { type: Type.STRING }
      }
    },
    rationale: { type: Type.STRING, description: "この変更が必要な論理的・文学的な理由" },
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
    domains: { type: Type.ARRAY, items: { type: Type.STRING }, description: "対象領域 ('ENTITIES', 'FOUNDATION', 'NARRATIVE')" },
    instructionSummary: { type: Type.STRING, description: "抽出タスクへの指示概要" }
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
          description: { type: Type.STRING },
          suggestion: { type: Type.STRING },
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
    text: { type: Type.STRING },
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
  description: "次に続く文章の候補（3件）",
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
        characterArcProgress: { type: Type.STRING },
        pacing: { type: Type.STRING }
      },
      required: ["milestones", "pacing"]
    },
    beats: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING }
        },
        required: ["text"]
      }
    },
    draft: { type: Type.STRING }
  },
  required: ["strategy", "beats", "draft"]
};

/**
 * Nexus シミュレーション 仕様
 */
export const nexusSchema = {
  type: Type.OBJECT,
  properties: {
    impactOnCanon: { type: Type.STRING },
    impactOnState: { type: Type.STRING },
    alternateTimeline: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["impactOnCanon", "impactOnState", "alternateTimeline"]
};

/**
 * プロジェクト初期生成 仕様
 */
export const projectGenSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    genre: { type: Type.STRING },
    bible: {
      type: Type.OBJECT,
      properties: {
        setting: { type: Type.STRING },
        grandArc: { type: Type.STRING }
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
