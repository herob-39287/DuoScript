
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
    path: { type: Type.STRING, description: "対象パス: characters, timeline, foreshadowing, entries, setting, tone, laws, grandArc, volumes, chapters, themes, keyItems, storyThreads, organizations, locations, races, bestiary, abilities" },
    targetId: { type: Type.STRING, description: "既存ID" },
    targetName: { type: Type.STRING, description: "対象名称" },
    field: { type: Type.STRING, description: "更新フィールド" },
    isHypothetical: { type: Type.BOOLEAN, description: "IF世界線(仮説)としての変更かどうか" },
    value: { 
      type: Type.OBJECT,
      description: "更新データ。Characterの場合は profile または state オブジェクトを含めること。",
      properties: {
        content: { type: Type.STRING },
        isSecret: { type: Type.BOOLEAN, description: "これが秘密情報（Writerに隠蔽される）かどうか" },
        
        // Character Profile
        profile: {
          type: Type.OBJECT,
          properties: {
             name: { type: Type.STRING },
             role: { type: Type.STRING },
             description: { type: Type.STRING },
             appearance: { type: Type.STRING },
             personality: { type: Type.STRING },
             background: { type: Type.STRING },
             motivation: { type: Type.STRING },
             flaw: { type: Type.STRING },
             arc: { type: Type.STRING }
          }
        },
        // Character State
        state: {
          type: Type.OBJECT,
          properties: {
             location: { type: Type.STRING },
             internalState: { type: Type.STRING },
             currentGoal: { type: Type.STRING },
             health: { type: Type.STRING },
             socialStanding: { type: Type.STRING }
          }
        },
        // Voice
        voice: {
          type: Type.OBJECT,
          properties: {
             firstPerson: { type: Type.STRING },
             secondPerson: { type: Type.STRING },
             speechStyle: { type: Type.STRING },
             catchphrases: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        },
        // Relationships
        relationships: { 
          type: Type.ARRAY, 
          items: { 
            type: Type.OBJECT, 
            properties: { 
               targetId: { type: Type.STRING }, 
               type: { type: Type.STRING },
               strength: { type: Type.NUMBER },
               description: { type: Type.STRING }
            } 
          } 
        },

        // Legacy/Direct Fields
        name: { type: Type.STRING },
        title: { type: Type.STRING },
        summary: { type: Type.STRING },
        event: { type: Type.STRING },
        concept: { type: Type.STRING },
        
        // Foreshadowing Links (for Chapters/Timeline)
        foreshadowingLinks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              foreshadowingId: { type: Type.STRING },
              action: { type: Type.STRING, description: 'Plant, Progress, Payoff, Twist, RedHerring' },
              note: { type: Type.STRING }
            }
          }
        },
        
        // World Entities
        relations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { targetOrganizationId: { type: Type.STRING }, stance: { type: Type.STRING } } } },
        connections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { targetLocationId: { type: Type.STRING }, travelTime: { type: Type.STRING } } } },
        
        // KeyItem specific fields
        currentOwnerId: { type: Type.STRING },
        currentLocationId: { type: Type.STRING },
        mechanics: { type: Type.STRING },
        history: { type: Type.ARRAY, items: { type: Type.STRING } },
        type: { type: Type.STRING },
        
        motifs: { type: Type.ARRAY, items: { type: Type.STRING } },
        associatedCharacterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        
        traits: { type: Type.ARRAY, items: { type: Type.STRING } },
        lifespan: { type: Type.STRING },
        locations: { type: Type.ARRAY, items: { type: Type.STRING } },
        habitat: { type: Type.STRING },
        dangerLevel: { type: Type.STRING },
        dropItems: { type: Type.ARRAY, items: { type: Type.STRING } },
        cost: { type: Type.STRING }
      }
    },
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
    strategy: { 
      type: Type.OBJECT,
      properties: {
        milestones: { type: Type.ARRAY, items: { type: Type.STRING } },
        pacing: { type: Type.STRING },
        forbiddenResolutions: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    beats: { 
      type: Type.ARRAY, 
      items: { 
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          type: { type: Type.STRING }
        },
        required: ["text"]
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
        grandArc: { type: Type.STRING },
        tone: { type: Type.STRING }
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

export const DEFAULT_RESPONSES = {
  DETECTION: { hasChangeIntent: false, isHypothetical: false, domains: [], categories: [], instructionSummary: "" },
  SYNC_OPS: [],
  INTEGRITY: { issues: [] },
  NEXUS: { hypothesis: "", impactOnCanon: "観測不能", impactOnState: "変化なし", alternateTimeline: [] },
  CHAPTER_PACKAGE: { strategy: {}, beats: [], draft: "" },
  PROJECT_GEN: { title: "名もなき物語", genre: "未分類", bible: { setting: "", grandArc: "" } },
  SUGGESTIONS: ["...", "...", "..."]
};
