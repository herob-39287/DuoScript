
import { 
  Character, WorldLaw, WorldEntry, TimelineEvent, Foreshadowing, 
  Location, Organization, Theme, KeyItem, StoryThread, StoryPhase,
  Race, Bestiary, Ability, WorldBible
} from './bible';
import { ChapterLog, StoryVolume } from './project';

/**
 * Message Kinds for handling context window efficiency
 */
export type MessageKind = 'dialogue' | 'artifact_ref' | 'tool_result' | 'system_note';

/**
 * Structured summary for Artifacts to be included in the context window.
 */
export interface CollapsedContent {
  docId: string; // Artifact ID
  title: string;
  type: string;
  decisions_made: string[]; // Key decisions extracted from the content
  entities_used: string[]; // IDs of entities referenced
  open_threads?: string[]; // Unresolved issues
  retrieval_hint?: string; // Hint for Librarian
}

/**
 * ChatMessage definition updated for Artifact support.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  kind?: MessageKind; // Defaults to 'dialogue' if undefined
  content: string; // For UI display (short summary for artifacts)
  collapsedContent?: CollapsedContent; // For LLM Context (JSON structure)
  artifactId?: string; // Reference to the full content in ArtifactsStore
  timestamp: number;
  requestId?: string;
  sources?: { title: string; uri: string }[];
}

export interface SyncCandidate {
  id: string;
  name: string;
  confidence: number;
  reason: string;
}

/**
 * Project domains for intent detection.
 */
export type ProjectDomain = 'ENTITIES' | 'NARRATIVE' | 'FOUNDATION';

/**
 * Focus areas for tiered context generation.
 */
export type ContextFocus = 'AUTO' | 'CHARACTERS' | 'WORLD' | 'PLOT';

/**
 * Task complexity for model selection hints.
 */
export type TaskComplexity = 'Low' | 'Medium' | 'High';

/**
 * Configuration for Gemini model requests.
 */
export interface ModelRequestConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
}

/**
 * Gemini compatible content structure.
 */
export interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/**
 * 判別共用体（Discriminated Unions）によるSyncOperationの厳密な定義
 */
export type SyncPath = 
  | 'characters' | 'timeline' | 'foreshadowing' | 'entries' | 'chapters' 
  | 'setting' | 'tone' | 'laws' | 'grandArc' | 'storyStructure' 
  | 'locations' | 'organizations' | 'volumes' | 'themes' | 'keyItems' 
  | 'storyThreads' | 'races' | 'bestiary' | 'abilities' | 'nexusBranches';

export interface BaseSyncOperation {
  id: string;
  requestId: string; 
  op: 'add' | 'update' | 'delete' | 'merge' | 'rename' | 'set' | 'addAlias';
  targetId?: string;
  targetName?: string;
  field?: string;
  oldValue?: any;
  rationale: string;
  evidence: string;
  confidence: number;
  status: 'proposal' | 'committed' | 'rejected' | 'quarantined' | 'needs_resolution';
  candidates?: SyncCandidate[];
  baseVersion: number;
  timestamp: number;
  beatId?: string;
  resolutionHint?: string;
  isHypothetical?: boolean;
}

export type SyncOperation = 
  | (BaseSyncOperation & { path: 'characters'; value: Partial<Character> })
  | (BaseSyncOperation & { path: 'laws'; value: Partial<WorldLaw> })
  | (BaseSyncOperation & { path: 'entries'; value: Partial<WorldEntry> })
  | (BaseSyncOperation & { path: 'timeline'; value: Partial<TimelineEvent> })
  | (BaseSyncOperation & { path: 'foreshadowing'; value: Partial<Foreshadowing> })
  | (BaseSyncOperation & { path: 'locations'; value: Partial<Location> })
  | (BaseSyncOperation & { path: 'organizations'; value: Partial<Organization> })
  | (BaseSyncOperation & { path: 'themes'; value: Partial<Theme> })
  | (BaseSyncOperation & { path: 'keyItems'; value: Partial<KeyItem> })
  | (BaseSyncOperation & { path: 'storyThreads'; value: Partial<StoryThread> })
  | (BaseSyncOperation & { path: 'storyStructure'; value: Partial<StoryPhase> })
  | (BaseSyncOperation & { path: 'races'; value: Partial<Race> })
  | (BaseSyncOperation & { path: 'bestiary'; value: Partial<Bestiary> })
  | (BaseSyncOperation & { path: 'abilities'; value: Partial<Ability> })
  | (BaseSyncOperation & { path: 'volumes'; value: Partial<StoryVolume> })
  | (BaseSyncOperation & { path: 'chapters'; value: Partial<ChapterLog> })
  | (BaseSyncOperation & { path: 'setting' | 'tone' | 'grandArc'; value: string });

export interface QuarantineItem {
  id: string;
  timestamp: number;
  rawText: string;
  error: string;
  stage: 'PARSE' | 'SCHEMA' | 'SEMANTIC';
  instructionSummary?: string;
  schemaErrors?: string[];
  partialOp?: Partial<SyncOperation>;
}

export interface ExtractionResult {
  readyOps: SyncOperation[];
  quarantineItems: QuarantineItem[];
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  operationId: string;
  requestId?: string;
  opType: SyncOperation['op'];
  path: SyncPath;
  targetId?: string;
  targetName?: string;
  field?: string;
  oldValue: any;
  newValue: any;
  rationale: string;
  evidence: string;
  versionAtCommit: number;
}

export interface NexusBranch {
  id: string;
  hypothesis: string;
  impactOnCanon: string;
  impactOnState: string;
  alternateTimeline: string[];
  timestamp: number;
  color?: string;
}

/**
 * Stored Artifact in IndexedDB (Not in Redux state)
 */
export interface Artifact {
  id: string;
  projectId: string;
  type: 'plot' | 'draft' | 'beats' | 'analysis' | 'general';
  title: string;
  content: string; // Full text
  summary: CollapsedContent;
  createdAt: number;
  sourceAgent: string;
  relatedChapterId?: string;
}

export interface SyncState {
  chatHistory: ChatMessage[];
  archivedChat?: ChatMessage[]; 
  conversationMemory?: string; 
  pendingChanges: SyncOperation[];
  quarantine: QuarantineItem[];
  history: HistoryEntry[];
}

// API Response Types
export interface DetectionResult {
  hasChangeIntent: boolean;
  isHypothetical: boolean; 
  domains: string[];
  categories: string[];
  instructionSummary: string;
}

export interface IntegrityScanResponse {
  issues: any[];
}

export interface NexusSimulationResponse {
  impactOnCanon: string;
  impactOnState: string;
  alternateTimeline: string[];
}

export interface ChapterPackageResponse {
  strategy: any;
  beats: any[];
  draft: string;
}

export interface ProjectGenerationResponse {
  title: string;
  genre: string;
  bible: {
    setting: string;
    grandArc: string;
  };
}

export interface WhisperAdvice {
  id: string;
  ruleId: string;
  text: string;
  type: 'info' | 'alert';
  citations: any[];
}
