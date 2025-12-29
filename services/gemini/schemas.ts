
import { Type } from "@google/genai";
import { 
  DetectionResult, IntegrityScanResponse, NexusSimulationResponse, 
  ChapterPackageResponse, ProjectGenerationResponse 
} from "../../types";

/**
 * 変更提案の単一操作スキーマ
 */
export const syncOperationSchema = {
  type: Type.OBJECT,
  properties: {
    op: { type: Type.STRING, description: "操作種別: add, update, delete, set" },
    path: { type: Type.STRING, description: "対象パス: characters, timeline, foreshadowing, entries, setting, tone, laws, grandArc" },
    targetId: { type: Type.STRING, description: "既存ID" },
    targetName: { type: Type.STRING, description: "対象名称" },
    field: { type: Type.STRING, description: "更新フィールド" },
    value: { 
      type: Type.OBJECT, 
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        title: { type: Type.STRING },
        priority: { type: Type.STRING },
        status: { type: Type.STRING },
        text: { type: Type.STRING },
        content: { type: Type.STRING },
        location: { type: Type.STRING },
        health: { type: Type.STRING },
        internalState: { type: Type.STRING },
        currentGoal: { type: Type.STRING }
      }
    },
    rationale: { type: Type.STRING, description: "変更理由" },
    evidence: { type: Type.STRING, description: "対話のどの部分に基づいているか" },
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
    domains: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING, description: "ENTITIES, NARRATIVE, FOUNDATION" } 
    },
    categories: { type: Type.ARRAY, items: { type: Type.STRING } },
    instructionSummary: { type: Type.STRING }
  },
  required: ["hasChangeIntent", "domains", "categories", "instructionSummary"]
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
          type: { type: Type.STRING },
          targetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          description: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          severity: { type: Type.STRING }
        },
        required: ["type", "description", "suggestion"]
      }
    }
  },
  required: ["issues"]
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
    strategy: { 
      type: Type.OBJECT, 
      properties: { 
        pacing: { type: Type.STRING }, 
        characterArcProgress: { type: Type.STRING } 
      } 
    },
    beats: { 
      type: Type.ARRAY, 
      items: { 
        type: Type.OBJECT, 
        properties: { 
          id: { type: Type.STRING }, 
          text: { type: Type.STRING } 
        } 
      } 
    },
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
    bible: { 
      type: Type.OBJECT, 
      properties: { 
        setting: { type: Type.STRING }, 
        grandArc: { type: Type.STRING } 
      } 
    }
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

/**
 * 各レスポンスのデフォルト値定義
 */
export const DEFAULT_RESPONSES = {
  DETECTION: { 
    hasChangeIntent: false, 
    domains: [],
    categories: [], 
    instructionSummary: "" 
  } as DetectionResult,
  
  SYNC_OPS: [] as any[],
  
  INTEGRITY: { 
    issues: [] 
  } as IntegrityScanResponse,
  
  NEXUS: { 
    hypothesis: "", 
    impactOnCanon: "観測不能", 
    impactOnState: "変化なし", 
    alternateTimeline: [] 
  } as NexusSimulationResponse,
  
  CHAPTER_PACKAGE: {
    strategy: { pacing: "標準", characterArcProgress: "停滞" },
    beats: [],
    draft: ""
  } as ChapterPackageResponse,
  
  PROJECT_GEN: {
    title: "名もなき物語",
    genre: "未分類",
    bible: { setting: "", grandArc: "" }
  } as ProjectGenerationResponse,
  
  SUGGESTIONS: ["...", "...", "..."] as string[]
};
