import { Type } from '@google/genai';
import { AppLanguage } from '../../types';
import {
  SyncOperationZodSchema,
  DetectionZodSchema,
  IntegrityScanZodSchema,
  WhisperZodSchema,
  ChapterPackageZodSchema,
  NexusSimulationZodSchema,
} from '../validation/schemas';
import { zodToGeminiSchema } from './schemaConverter';

/**
 * 変更提案 (SyncOperation) 仕様
 * Zodスキーマから自動生成
 */
export const getSyncOperationSchema = (lang: AppLanguage) => {
  return zodToGeminiSchema(SyncOperationZodSchema);
};

export const getDetectionSchema = (lang: AppLanguage) => {
  return zodToGeminiSchema(DetectionZodSchema);
};

export const getIntegrityScanSchema = (lang: AppLanguage) => {
  return zodToGeminiSchema(IntegrityScanZodSchema);
};

export const getWhisperSchema = (lang: AppLanguage) => {
  return zodToGeminiSchema(WhisperZodSchema);
};

export const suggestionsSchema = {
  type: Type.ARRAY,
  items: { type: Type.STRING },
};

export const getChapterPackageSchema = (lang: AppLanguage) => {
  return zodToGeminiSchema(ChapterPackageZodSchema);
};

export const getNexusSchema = (lang: AppLanguage) => {
  return zodToGeminiSchema(NexusSimulationZodSchema);
};

/**
 * プロジェクト生成 (Bible) スキーマ
 * (複雑かつ独自の構造のため、現状は手動定義を維持または別途Zod化を検討)
 * ※ 今回のスコープでは既存の手動定義を維持しつつ、必要に応じてZod化する方針だが、
 *    Consistencyのために手動定義部分も残しておく。
 */
export const getGenesisBibleSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    genre: { type: Type.STRING },
    bible: {
      type: Type.OBJECT,
      properties: {
        setting: { type: Type.STRING },
        grandArc: { type: Type.STRING },
        tone: { type: Type.STRING },
        laws: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING },
              importance: { type: Type.STRING },
            },
          },
        },
        characters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING },
              description: { type: Type.STRING },
              personality: { type: Type.STRING },
              motivation: { type: Type.STRING },
              appearance: { type: Type.STRING },
              traits: { type: Type.ARRAY, items: { type: Type.STRING } },
              relationships: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    targetId: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
        locations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING },
              description: { type: Type.STRING },
            },
          },
        },
        organizations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING },
              description: { type: Type.STRING },
            },
          },
        },
        keyItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING },
              description: { type: Type.STRING },
            },
          },
        },
        themes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              concept: { type: Type.STRING },
              description: { type: Type.STRING },
            },
          },
        },
        entries: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              definition: { type: Type.STRING },
            },
          },
        },
        races: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
            },
          },
        },
        bestiary: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              dangerLevel: { type: Type.STRING },
            },
          },
        },
        abilities: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING },
            },
          },
        },
      },
      required: ['setting', 'grandArc', 'characters', 'laws', 'locations'],
    },
  },
  required: ['title', 'genre', 'bible'],
});

/**
 * プロジェクト生成 (Chapters) スキーマ
 */
export const getInitialChaptersSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  properties: {
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ['title', 'summary'],
      },
    },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          timeLabel: { type: Type.STRING },
          event: { type: Type.STRING },
          importance: { type: Type.STRING },
        },
      },
    },
    storyStructure: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          summary: { type: Type.STRING },
          goal: { type: Type.STRING },
        },
      },
    },
    volumes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          order: { type: Type.INTEGER },
          summary: { type: Type.STRING },
        },
      },
    },
  },
  required: ['chapters'],
});

/**
 * プロジェクト生成 (Foreshadowing) スキーマ
 */
export const getInitialForeshadowingSchema = (lang: AppLanguage) => ({
  type: Type.OBJECT,
  properties: {
    foreshadowing: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          clues: { type: Type.ARRAY, items: { type: Type.STRING } },
          redHerrings: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['title', 'description', 'clues', 'redHerrings'],
      },
    },
    storyThreads: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          shortSummary: { type: Type.STRING },
          status: { type: Type.STRING },
        },
      },
    },
  },
  required: ['foreshadowing'],
});

export const DEFAULT_RESPONSES = {
  DETECTION: {
    hasChangeIntent: false,
    isHypothetical: false,
    domains: [],
    categories: [],
    instructionSummary: '',
  },
  SUGGESTIONS: ['...', '...', '...'],
  CHAPTER_PACKAGE: {
    strategy: {
      milestones: ['Intro', 'Development', 'Climax'],
      forbiddenResolutions: [],
      characterArcProgress: '',
      pacing: 'Normal',
    },
    beats: [{ text: 'Situation' }],
    draft: '',
  },
  NEXUS: { impactOnCanon: 'None', impactOnState: 'Maintained', alternateTimeline: ['No Change'] },
  PROJECT_GEN: {
    title: 'Untitled',
    genre: 'Fantasy',
    bible: { setting: '...', grandArc: '...', characters: [], laws: [], locations: [] },
    chapters: [],
  },
};
