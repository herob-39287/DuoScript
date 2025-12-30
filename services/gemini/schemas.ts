
import { Type } from "@google/genai";

/**
 * 引用スキーマ
 */
const citationSchema = {
  type: Type.OBJECT,
  properties: {
    sourceType: { type: Type.STRING, description: "Bible または Manuscript" },
    sourceId: { type: Type.STRING },
    textSnippet: { type: Type.STRING, description: "該当する記述の抜粋" },
    label: { type: Type.STRING, description: "項目名や章名" }
  },
  required: ["sourceType", "textSnippet", "label"]
};

/**
 * 変更提案の単一操作スキーマ
 */
export const syncOperationSchema = {
  type: Type.OBJECT,
  properties: {
    op: { type: Type.STRING, description: "操作種別: add, update, delete, set, addAlias" },
    path: { type: Type.STRING, description: "対象パス: characters, timeline, foreshadowing, entries, setting, tone, laws, grandArc, volumes, chapters" },
    targetId: { type: Type.STRING, description: "既存ID" },
    targetName: { type: Type.STRING, description: "対象名称" },
    field: { type: Type.STRING, description: "更新フィールド" },
    isHypothetical: { type: Type.BOOLEAN, description: "IF世界線(仮説)としての変更かどうか" },
    value: { type: Type.OBJECT },
    rationale: { type: Type.STRING },
    evidence: { type: Type.STRING },
    confidence: { type: Type.NUMBER }
  },
  required: ["op", "path", "targetName", "value", "rationale", "confidence"]
};

/**
 * 意図検出スキーマ
 */
export const detectionSchema = {
  type: Type.OBJECT,
  properties: {
    hasChangeIntent: { type: Type.BOOLEAN },
    isHypothetical: { type: Type.BOOLEAN },
    domains: { type: Type.ARRAY, items: { type: Type.STRING } },
    categories: { type: Type.ARRAY, items: { type: Type.STRING } },
    instructionSummary: { type: Type.STRING }
  },
  required: ["hasChangeIntent", "isHypothetical", "domains", "categories", "instructionSummary"]
};

/**
 * 整合性スキャンスキーマ
 */
export const integrityScanSchema = {
  type: Type.OBJECT,
  properties: {
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          ruleId: { type: Type.STRING },
          type: { type: Type.STRING },
          targetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          description: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          severity: { type: Type.STRING },
          citations: { type: Type.ARRAY, items: citationSchema as any }
        },
        required: ["type", "description", "suggestion", "citations"]
      }
    }
  },
  required: ["issues"]
};

/**
 * Whisperスキーマ
 */
export const whisperSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    ruleId: { type: Type.STRING },
    text: { type: Type.STRING },
    type: { type: Type.STRING, description: "info または alert" },
    citations: { type: Type.ARRAY, items: citationSchema as any }
  },
  required: ["text", "type", "ruleId", "citations"]
};

/**
 * Nexusシミュレーションスキーマ
 */
export const nexusSchema = {
  type: Type.OBJECT,
  properties: {
    hypothesis: { type: Type.STRING },
    impactOnCanon: { type: Type.STRING },
    impactOnState: { type: Type.STRING },
    alternateTimeline: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["hypothesis", "impactOnCanon", "impactOnState"]
};

/**
 * 章パッケージスキーマ
 */
export const chapterPackageSchema = {
  type: Type.OBJECT,
  properties: {
    strategy: { type: Type.OBJECT },
    beats: { type: Type.ARRAY, items: { type: Type.OBJECT } },
    draft: { type: Type.STRING }
  },
  required: ["strategy", "beats", "draft"]
};

/**
 * 新規プロジェクト生成スキーマ
 */
export const projectGenSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    genre: { type: Type.STRING },
    bible: { type: Type.OBJECT }
  },
  required: ["title", "genre", "bible"]
};

/**
 * AICopilot 次の一文提案スキーマ
 */
export const suggestionsSchema = {
  type: Type.ARRAY,
  items: { type: Type.STRING }
};

export const DEFAULT_RESPONSES = {
  DETECTION: { hasChangeIntent: false, isHypothetical: false, domains: [], categories: [], instructionSummary: "" },
  SYNC_OPS: [],
  INTEGRITY: { issues: [] },
  NEXUS: { hypothesis: "", impactOnCanon: "観測不能", impactOnState: "変化なし", alternateTimeline: [] },
  CHAPTER_PACKAGE: { strategy: {}, beats: [], draft: "" },
  PROJECT_GEN: { title: "名もなき物語", genre: "未分類", bible: { setting: "", grandArc: "" } },
  SUGGESTIONS: ["...", "...", "..."]
};
