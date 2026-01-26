
import { 
  StoryProjectMetadata, AppPreferences, AppLanguage, 
  TokenUsageEntry, SafetyViolation, AssetMetadata,
  ChapterLog, PlotBeat, StoryScene, ChapterStrategy,
  StoryVolume, ForeshadowingLink,
  EditorSettings
} from '../services/validation/schemas';
import { WorldBible } from './bible';
import { SyncState } from './sync';

// Enums - Defined as native TypeScript Enums to satisfy both Value and Type usage
export enum TransmissionScope {
  FULL = 'FULL',           
  SUMMARY = 'SUMMARY',     
  CHAPTER = 'CHAPTER',     
  MINIMAL = 'MINIMAL',     
}

export enum SafetyPreset {
  STRICT = 'STRICT',       
  MATURE = 'MATURE',       
  CREATIVE = 'CREATIVE',   
}

export enum AiPersona {
  STANDARD = 'STANDARD', 
  STRICT = 'STRICT',     
  GENTLE = 'GENTLE',     
  CREATIVE = 'CREATIVE', 
}

// Re-export Zod types (excluding the ones replaced by Enums)
export type { 
  AppLanguage,
  EditorSettings, AppPreferences, TokenUsageEntry, SafetyViolation,
  StoryProjectMetadata, AssetMetadata,
  PlotBeat, StoryScene, ChapterStrategy, ChapterLog, StoryVolume, ForeshadowingLink
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
