import {
  StoryProjectMetadata,
  AppPreferences,
  AppLanguage,
  TokenUsageEntry,
  SafetyViolation,
  AssetMetadata,
  ChapterLog,
  PlotBeat,
  StoryScene,
  ChapterStrategy,
  StoryVolume,
  ForeshadowingLink,
  EditorSettings,
} from '../services/validation/schemas';
import { WorldBible } from './bible';
import { SyncState } from './sync';

// Enums - defined as const objects to align with Zod string unions
export const TransmissionScope = {
  FULL: 'FULL',
  SUMMARY: 'SUMMARY',
  CHAPTER: 'CHAPTER',
  MINIMAL: 'MINIMAL',
} as const;
export type TransmissionScope = (typeof TransmissionScope)[keyof typeof TransmissionScope];

export const SafetyPreset = {
  STRICT: 'STRICT',
  MATURE: 'MATURE',
  CREATIVE: 'CREATIVE',
} as const;
export type SafetyPreset = (typeof SafetyPreset)[keyof typeof SafetyPreset];

export const AiPersona = {
  STANDARD: 'STANDARD',
  STRICT: 'STRICT',
  GENTLE: 'GENTLE',
  CREATIVE: 'CREATIVE',
} as const;
export type AiPersona = (typeof AiPersona)[keyof typeof AiPersona];

// Re-export Zod types (excluding the ones replaced by Enums)
export type {
  AppLanguage,
  EditorSettings,
  AppPreferences,
  TokenUsageEntry,
  SafetyViolation,
  StoryProjectMetadata,
  AssetMetadata,
  PlotBeat,
  StoryScene,
  ChapterStrategy,
  ChapterLog,
  StoryVolume,
  ForeshadowingLink,
};

/**
 * Payload for usage tracking actions.
 */
export type UsagePayload = {
  model: string;
  source: string;
  input: number;
  output: number;
  cached?: number;
};

export interface StoryProject {
  meta: StoryProjectMetadata;
  bible: WorldBible;
  chapters: ChapterLog[];
  sync: SyncState;
  // Optional assets for export/backup purposes (not loaded in main state usually)
  assets?: Record<string, string>;
}

/**
 * Minimal Context Interfaces for Agents
 * Prevents unnecessary dependency on the full StoryProject and improves type safety.
 */

export interface AgentContextBase {
  meta: {
    language?: AppLanguage;
  };
}

export interface CreatorContext extends AgentContextBase {
  bible: {
    setting: string;
    tone: string;
    laws: { name: string }[];
  };
}

export interface VisualContext {
  bible: {
    tone: string;
  };
}
