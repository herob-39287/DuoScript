
import { Type } from "@google/genai";
import { AppLanguage } from "../../types";

const getLangLabel = (lang: AppLanguage) => lang === 'ja' ? '(Japanese)' : '(English)';

/**
 * 変更提案 (SyncOperation) 仕様
 */
export const getSyncOperationSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  properties: {
    op: { type: Type.STRING, description: "Operation: 'add', 'update', 'delete', 'set'" },
    path: { type: Type.STRING, description: "Target path: 'characters', 'laws', 'entries', 'timeline', 'foreshadowing', 'grandArc', 'volumes', etc." },
    targetId: { type: Type.STRING, description: "Existing Item UUID (Optional)" },
    targetName: { type: Type.STRING, description: `Target Name anchor. MUST be in ${getLangLabel(lang)}.` },
    field: { type: Type.STRING, description: "Specific field to update (e.g., 'profile.name')" },
    isHypothetical: { type: Type.BOOLEAN, description: "True if this is a 'What IF' scenario" },
    value: { 
      type: Type.OBJECT, 
      description: `Data object corresponding to path. All string values must be in ${getLangLabel(lang)}.`,
      properties: {
        name: { type: Type.STRING },
        title: { type: Type.STRING },
        event: { type: Type.STRING },
        concept: { type: Type.STRING },
        description: { type: Type.STRING },
        content: { type: Type.STRING },
        summary: { type: Type.STRING },
        appearance: { type: Type.STRING },
        personality: { type: Type.STRING },
        background: { type: Type.STRING },
        traits: { type: Type.ARRAY, items: { type: Type.STRING } },
        motivation: { type: Type.STRING },
        flaw: { type: Type.STRING },
        arc: { type: Type.STRING },
        timeLabel: { type: Type.STRING },
        importance: { type: Type.STRING },
        status: { type: Type.STRING },
        role: { type: Type.STRING },
        location: { type: Type.STRING },
        health: { type: Type.STRING },
        relatedEntityIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        involvedCharacterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        clues: { type: Type.ARRAY, items: { type: Type.STRING } },
        redHerrings: { type: Type.ARRAY, items: { type: Type.STRING } },
        order: { type: Type.INTEGER },
        habitat: { type: Type.STRING },
        dangerLevel: { type: Type.STRING },
        dropItems: { type: Type.ARRAY, items: { type: Type.STRING } },
        lifespan: { type: Type.STRING },
        cost: { type: Type.STRING },
        mechanics: { type: Type.STRING },
      }
    },
    rationale: { type: Type.STRING, description: `Reason for this change. MUST be in ${getLangLabel(lang)}.` },
    evidence: { type: Type.STRING },
    confidence: { type: Type.NUMBER }
  },
  required: ["op", "path", "targetName", "value", "rationale", "confidence"]
});

export const getDetectionSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  description: "Detect intent to change story settings or request simulation.",
  properties: {
    hasChangeIntent: { type: Type.BOOLEAN },
    isHypothetical: { type: Type.BOOLEAN },
    domains: { type: Type.ARRAY, items: { type: Type.STRING }, description: "'ENTITIES', 'FOUNDATION', 'NARRATIVE', 'FORESHADOWING'" },
    instructionSummary: { type: Type.STRING, description: `Summary of instruction in ${getLangLabel(lang)}.` }
  },
  required: ["hasChangeIntent", "isHypothetical", "domains", "instructionSummary"]
});

export const getIntegrityScanSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  properties: {
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ruleId: { type: Type.STRING },
          type: { type: Type.STRING },
          description: { type: Type.STRING, description: `In ${getLangLabel(lang)}` },
          suggestion: { type: Type.STRING, description: `In ${getLangLabel(lang)}` },
          severity: { type: Type.STRING },
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
});

export const getWhisperSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  description: "Short advice for the writer.",
  properties: {
    ruleId: { type: Type.STRING },
    text: { type: Type.STRING, description: `Advice content in ${getLangLabel(lang)}` },
    type: { type: Type.STRING },
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
});

export const suggestionsSchema = {
  type: Type.ARRAY,
  items: { type: Type.STRING }
};

export const getChapterPackageSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  properties: {
    strategy: {
      type: Type.OBJECT,
      properties: {
        milestones: { type: Type.ARRAY, items: { type: Type.STRING } },
        forbiddenResolutions: { type: Type.ARRAY, items: { type: Type.STRING } },
        characterArcProgress: { type: Type.STRING, description: `In ${getLangLabel(lang)}` },
        pacing: { type: Type.STRING }
      },
      required: ["milestones", "pacing"]
    },
    beats: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: `In ${getLangLabel(lang)}` }
        },
        required: ["text"]
      }
    },
    draft: { type: Type.STRING, description: `In ${getLangLabel(lang)}` }
  },
  required: ["strategy", "beats", "draft"]
});

export const getNexusSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  properties: {
    impactOnCanon: { type: Type.STRING, description: `In ${getLangLabel(lang)}` },
    impactOnState: { type: Type.STRING, description: `In ${getLangLabel(lang)}` },
    alternateTimeline: { type: Type.ARRAY, items: { type: Type.STRING }, description: `In ${getLangLabel(lang)}` }
  },
  required: ["impactOnCanon", "impactOnState", "alternateTimeline"]
});

export const getProjectGenSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: `In ${getLangLabel(lang)}` },
    genre: { type: Type.STRING, description: `In ${getLangLabel(lang)}` },
    bible: {
      type: Type.OBJECT,
      properties: {
        setting: { type: Type.STRING, description: `In ${getLangLabel(lang)}` },
        grandArc: { type: Type.STRING, description: `In ${getLangLabel(lang)}` }
      },
      required: ["setting", "grandArc"]
    }
  },
  required: ["title", "genre", "bible"]
});

export const DEFAULT_RESPONSES = {
  DETECTION: { hasChangeIntent: false, isHypothetical: false, domains: [], categories: [], instructionSummary: "" },
  SUGGESTIONS: ["...", "...", "..."],
  CHAPTER_PACKAGE: { strategy: { milestones: ["Intro", "Development", "Climax"], pacing: "Normal" }, beats: [{ text: "Situation" }], draft: "" },
  NEXUS: { impactOnCanon: "None", impactOnState: "Maintained", alternateTimeline: ["No Change"] },
  PROJECT_GEN: { title: "Untitled", genre: "Fantasy", bible: { setting: "...", grandArc: "..." } }
};
