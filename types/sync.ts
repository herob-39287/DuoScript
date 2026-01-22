import { 
  SyncOperationZodSchema, DetectionZodSchema, 
  IntegrityScanZodSchema, NexusSimulationZodSchema,
  ChapterPackageZodSchema, WhisperZodSchema,
  SyncOperation as ZodSyncOperation,
  SyncCandidate as ZodSyncCandidate,
  SyncPath as ZodSyncPath
} from '../services/validation/schemas';
import { z } from 'zod';

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

// Re-export Zod types
export type SyncCandidate = ZodSyncCandidate;
export type SyncOperation = ZodSyncOperation;
export type SyncPath = ZodSyncPath;

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

// NexusBranch is now exported from bible.ts (which exports schemas)
export { NexusBranch } from './bible';

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

// API Response Types derived from Zod
export type DetectionResult = z.infer<typeof DetectionZodSchema>;
export type IntegrityScanResponse = z.infer<typeof IntegrityScanZodSchema>;
export type NexusSimulationResponse = z.infer<typeof NexusSimulationZodSchema>;
export type ChapterPackageResponse = z.infer<typeof ChapterPackageZodSchema>;
export type WhisperAdvice = z.infer<typeof WhisperZodSchema>;

export interface ProjectGenerationResponse {
  title: string;
  genre: string;
  bible: {
    setting: string;
    grandArc: string;
  };
  chapters?: {
    title: string;
    summary: string;
  }[];
}
