
export enum ViewMode {
  WELCOME = 'WELCOME',
  DASHBOARD = 'DASHBOARD',
  PLOTTER = 'PLOTTER',
  WRITER = 'WRITER',
}

export enum AiModel {
  REASONING = 'gemini-3-pro-preview',
  FAST = 'gemini-3-flash-preview',
  IMAGE = 'gemini-2.5-flash-image',
  TTS = 'gemini-2.5-flash-preview-tts',
}

export type ProjectDomain = 'ENTITIES' | 'NARRATIVE' | 'FOUNDATION';

export type TaskComplexity = 'basic' | 'complex' | 'creative' | 'critical';

export interface ModelRequestConfig {
  model: string;
  thinkingBudget?: number;
}

// --- Gemini API Types ---
export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export type UsagePayload = { model: string; source: string; input: number; output: number };
export type UsageCallback = (usage: UsagePayload) => void;
export type LogCallback = (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => void;

// --- Application Core Types ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  sources?: { title: string; uri: string }[];
}

export interface TokenUsageEntry {
  id: string;
  timestamp: number;
  model: string;
  source: string;
  input: number;
  output: number;
}

export interface SyncOperation {
  id: string;
  op: 'add' | 'update' | 'delete' | 'merge' | 'rename' | 'set' | 'addAlias';
  path: 'characters' | 'timeline' | 'foreshadowing' | 'entries' | 'chapters' | 'setting' | 'tone' | 'laws' | 'grandArc';
  domain?: ProjectDomain;
  targetId?: string;
  targetName?: string;
  field?: string;
  value: any;
  oldValue?: any;
  rationale: string;
  evidence: string;
  confidence: number;
  status: 'proposal' | 'committed' | 'rejected';
  baseVersion: number;
  timestamp: number;
  beatId?: string; 
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  operationId: string;
  opType: SyncOperation['op'];
  path: SyncOperation['path'];
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

export interface Relationship {
  id: string;
  targetCharacterId: string;
  type: string; 
  description: string;
  sentiment: number; 
}

export interface CharacterStatus {
  location: string;
  health: string;
  inventory: string[];
  knowledge: string[];
  currentGoal: string;
  socialStanding: string;
  internalState: string;
}

export interface Character {
  id: string;
  name: string;
  role: 'Protagonist' | 'Antagonist' | 'Supporting' | 'Minor';
  description: string; 
  personality?: string;
  traits: string[];
  motivation: string;
  flaw: string;
  arc: string;
  imageUrl?: string; 
  voiceId?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  relationships: Relationship[];
  status: CharacterStatus; 
}

export interface StateDelta {
  id: string;
  characterId: string;
  beatId?: string; 
  field: keyof CharacterStatus;
  op: 'set' | 'add' | 'remove';
  value: any;
  rationale: string;
  evidence: string;
  timestamp: number;
}

// --- World Entry Metadata Extensions ---

export interface GeoMetadata {
  climate?: string;
  neighbors?: string[];
  resources?: string[];
  cultureType?: string;
  dangerLevel?: number; // 0-10
}

export interface MagicMetadata {
  cost?: string;
  difficulty?: string;
  limitation?: string;
  commonality?: string; // High, Medium, Low, Secret
}

export interface HistoryMetadata {
  era?: string;
  relevanceToCurrent?: string;
  keyFigures?: string[];
}

export interface WorldEntry {
  id: string;
  category: 'History' | 'Culture' | 'Technology' | 'Magic' | 'Geography' | 'Lore' | 'Terminology';
  title: string;
  aliases: string[];
  content: string; 
  definition: string; 
  narrativeSignificance: string; 
  etymology?: string; 
  isSecret: boolean; 
  tags: string[];
  linkedIds: string[]; 
  // Extended Metadata
  metadata: GeoMetadata | MagicMetadata | HistoryMetadata | Record<string, any>;
}

export interface ForeshadowingMilestone {
  id: string;
  type: 'Plant' | 'Progress' | 'Payoff';
  description: string;
  beatId?: string;
  chapterId?: string;
  isResolved: boolean;
}

export interface TimelineEvent {
  id: string;
  timeLabel: string;
  event: string;
  description?: string;
  involvedCharacterIds: string[];
  importance: 'Minor' | 'Major' | 'Climax';
  causalLinks: string[]; // IDs of preceding events that triggered this
  foreshadowingLinks: string[]; // IDs of foreshadowing items related to this
}

export interface Foreshadowing {
  id: string;
  title: string;
  description: string;
  status: 'Open' | 'Resolved' | 'Stale';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  milestones: ForeshadowingMilestone[];
}

export interface ToneVector {
  hope: number; // 0 to 1
  darkness: number;
  tension: number;
  logic: number;
  magic: number;
}

export interface WorldBible {
  version: number;
  setting: string; 
  laws: string;    
  grandArc: string; 
  themes: string[]; 
  tone: string;     
  toneVector: ToneVector; // Quantified tone
  characters: Character[]; 
  timeline: TimelineEvent[]; 
  foreshadowing: Foreshadowing[]; 
  entries: WorldEntry[]; 
  nexusBranches: NexusBranch[]; 
  integrityIssues: BibleIssue[];
  summaryBuffer: string; 
  lastSummaryUpdate: number;
}

export interface StoryProjectMetadata {
  id: string;
  title: string;
  author: string;
  genre: string;
  createdAt: number;
  updatedAt: number;
  language: 'ja';
  tokenUsage: TokenUsageEntry[];
}

export interface SyncState {
  chatHistory: ChatMessage[];
  pendingChanges: SyncOperation[];
  history: HistoryEntry[];
}

export interface StoryProject {
  meta: StoryProjectMetadata;
  bible: WorldBible;
  chapters: ChapterLog[];
  sync: SyncState;
}

export interface SystemLog {
  id: string;
  timestamp: number;
  type: 'info' | 'error' | 'success' | 'usage';
  source: 'System' | 'Architect' | 'Writer' | 'Linter' | 'Artist' | 'Voice' | 'NeuralSync';
  message: string;
  details?: string;
}

export interface AppNotification {
  id: string;
  type: 'info' | 'error' | 'success' | 'usage';
  message: string;
}

export interface BibleIssue {
  id: string;
  type: 'Duplicate' | 'Incomplete' | 'Contradiction' | 'Broken';
  targetIds: string[];
  targetType: 'Character' | 'Entry' | 'General' | 'Law';
  description: string;
  suggestion: string;
  severity: 'Low' | 'Medium' | 'High';
}

export interface DialogState {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface UIState {
  view: ViewMode;
  plotterTab: string;
  pendingMsg: string | null;
  dialog: DialogState;
  showPubModal: boolean;
  showHelpModal: boolean;
  saveStatus: 'idle' | 'saving' | 'saved';
}

// Actions integration
export type MetaAction = 
  | { type: 'LOAD_META'; payload: StoryProjectMetadata }
  | { type: 'UPDATE_META'; payload: Partial<StoryProjectMetadata> }
  | { type: 'TRACK_USAGE'; payload: UsagePayload };

export type BibleAction = 
  | { type: 'LOAD_BIBLE'; payload: WorldBible }
  | { type: 'UPDATE_BIBLE'; payload: Partial<WorldBible> }
  | { type: 'APPLY_SYNC_OP'; payload: { nextBible: WorldBible; historyEntry: HistoryEntry } }
  | { type: 'UNDO_BIBLE'; payload: { nextBible: WorldBible } };

export type ChapterAction = 
  | { type: 'LOAD_CHAPTERS'; payload: ChapterLog[] }
  | { type: 'UPDATE_CHAPTER'; id: string; updates: Partial<ChapterLog> }
  | { type: 'SET_CHAPTER_CONTENT'; id: string; content: string }
  | { type: 'ADD_CHAPTER'; payload: ChapterLog }
  | { type: 'REMOVE_CHAPTER'; id: string };

export type SyncAction = 
  | { type: 'LOAD_SYNC'; payload: SyncState }
  | { type: 'SET_CHAT_HISTORY'; payload: ChatMessage[] }
  | { type: 'ADD_PENDING_OPS'; payload: SyncOperation[] }
  | { type: 'REMOVE_PENDING_OP'; id: string }
  | { type: 'ADD_HISTORY_ENTRY'; payload: HistoryEntry }
  | { type: 'REMOVE_HISTORY_ENTRY'; id: string };

export type UIAction = 
  | { type: 'SET_VIEW'; payload: ViewMode }
  | { type: 'SET_PLOTTER_TAB'; payload: string }
  | { type: 'SET_PENDING_MSG'; payload: string | null }
  | { type: 'OPEN_DIALOG'; payload: DialogState }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'SET_PUB_MODAL'; payload: boolean }
  | { type: 'SET_HELP_MODAL'; payload: boolean }
  | { type: 'SET_SAVE_STATUS'; payload: 'idle' | 'saving' | 'saved' };

export type ProjectAction = 
  | MetaAction
  | BibleAction
  | ChapterAction
  | SyncAction
  | { type: 'LOAD_PROJECT'; payload: StoryProject }
  | { type: 'CLEAR_DATA' };

export type NotificationAction = 
  | { type: 'ADD_LOG'; payload: SystemLog }
  | { type: 'CLEAR_LOGS' }
  | { type: 'DISMISS_NOTIFICATION'; id: string };

// --- New Response Interfaces ---
export interface DetectionResult {
  hasChangeIntent: boolean;
  domains: ProjectDomain[];
  categories: string[];
  instructionSummary: string;
}

export interface IntegrityScanResponse {
  issues: BibleIssue[];
}

export interface NexusSimulationResponse {
  hypothesis: string;
  impactOnCanon: string;
  impactOnState: string;
  alternateTimeline: string[];
}

export interface ChapterPackageResponse {
  strategy: Partial<ChapterStrategy>;
  beats: PlotBeat[];
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

export interface PlotBeat {
  id: string;
  text: string;
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
  title: string;
  summary: string;
  content?: string; 
  beats: PlotBeat[];
  strategy: ChapterStrategy;
  status: 'Idea' | 'Beats' | 'Drafting' | 'Polished';
  wordCount: number;
  stateDeltas: StateDelta[]; 
  postStateCache?: { [characterId: string]: CharacterStatus }; 
  updatedAt: number; 
}
