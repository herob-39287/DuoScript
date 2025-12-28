
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
}

export interface ForeshadowingLink {
  foreshadowingId: string;
  action: 'Plant' | 'Progress' | 'Payoff';
  note: string;
}

export interface TimelineEvent {
  id: string;
  timeLabel: string;
  event: string;
  description?: string;
  involvedCharacterIds: string[];
  importance: 'Minor' | 'Major' | 'Climax';
  foreshadowingLinks: ForeshadowingLink[];
}

export interface Foreshadowing {
  id: string;
  title: string;
  description: string;
  status: 'Open' | 'Resolved' | 'Stale';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface ChapterStrategy {
  milestones: string[];
  forbiddenResolutions: string[];
  characterArcProgress: string;
  pacing: string;
  povCharacterId?: string; 
}

export interface PlotBeat {
  id: string;
  text: string;
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

export interface WorldBible {
  version: number;
  setting: string; 
  laws: string;    
  grandArc: string; 
  themes: string[]; 
  tone: string;     
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

export type MetaAction = 
  | { type: 'LOAD_META'; payload: StoryProjectMetadata }
  | { type: 'UPDATE_META'; payload: Partial<StoryProjectMetadata> }
  | { type: 'TRACK_USAGE'; payload: { model: string, source: string, input: number, output: number } };

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

export type ProjectAction = 
  | { type: 'LOAD_PROJECT'; payload: StoryProject }
  | { type: 'CLEAR_DATA' };

export type NotificationAction = 
  | { type: 'ADD_LOG'; payload: SystemLog }
  | { type: 'CLEAR_LOGS' }
  | { type: 'DISMISS_NOTIFICATION'; id: string };
