
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
  STANDARD = 'STANDARD', // 標準・バランス
  STRICT = 'STRICT',     // 厳格・論理的 (編集者)
  GENTLE = 'GENTLE',     // 肯定的・受容的 (ミューズ)
  CREATIVE = 'CREATIVE', // 創造的・拡散的 (アイデアマン)
}

export type AppLanguage = 'ja' | 'en';

export interface AppPreferences {
  uiLanguage: AppLanguage; // New: UI Display Language
  transmissionScope: TransmissionScope;
  safetyPreset: SafetyPreset;
  aiPersona: AiPersona; // New: AI Personality
  allowSearch: boolean;
  whisperSensitivity: number; 
  disabledLinterRules: string[];
}

export interface TokenUsageEntry {
  id: string;
  timestamp: number;
  model: string;
  source: string;
  input: number;  // Total prompt tokens (Net Input + Cached)
  output: number;
  cached?: number; // Cached tokens (Included in input)
}

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

export interface SafetyViolation {
  timestamp: number;
  category?: string;
  inputSnippet?: string;
}

export interface StoryProjectMetadata {
  id: string;
  title: string;
  author: string;
  genre: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number; 
  language: AppLanguage; // Story Content Language
  tokenUsage: TokenUsageEntry[];
  violationCount: number;
  violationHistory: SafetyViolation[];
  headRev?: number;
  preferences: AppPreferences; 
}

export interface PlotBeat {
  id: string;
  text: string;
}

export interface StoryScene {
  id: string;
  title: string;
  locationId?: string;
  involvedCharacterIds: string[];
  goal: string;
  summary: string;
  content: string;
  beats: PlotBeat[];
  wordCount: number;
  status: 'Idea' | 'Drafting' | 'Polished';
}

export interface ChapterStrategy {
  milestones: string[];
  forbiddenResolutions: string[];
  characterArcProgress: string;
  pacing: string;
  povCharacterId?: string; 
}

export interface ChapterLog {
  id: string;
  volumeId?: string;
  title: string;
  summary: string;
  content?: string; 
  scenes: StoryScene[];
  beats: PlotBeat[]; 
  strategy: ChapterStrategy;
  status: 'Idea' | 'Beats' | 'Drafting' | 'Polished';
  wordCount: number;
  draftVersion: number; 
  involvedCharacterIds: string[];
  foreshadowingLinks?: ForeshadowingLink[];
  relevantEntityIds?: string[];
  updatedAt: number; 
}

export interface StoryVolume {
  id: string;
  title: string;
  summary: string;
  order: number;
}

/**
 * Metadata for storage assets like portraits.
 */
export interface AssetMetadata {
  id: string;
  projectId: string;
  type: 'portrait' | 'scene' | 'other';
  size: number;
  mimeType: string;
  createdAt: number;
  lastUsedAt: number;
}

import { WorldBible } from './bible';
import { SyncState } from './sync';
import { ForeshadowingLink } from './bible';

export interface StoryProject {
  meta: StoryProjectMetadata;
  bible: WorldBible;
  chapters: ChapterLog[];
  sync: SyncState;
  assets?: { [id: string]: string }; 
}
