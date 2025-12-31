

export enum ViewMode {
  WELCOME = 'WELCOME',
  DASHBOARD = 'DASHBOARD',
  PLOTTER = 'PLOTTER',
  WRITER = 'WRITER',
  RESCUE = 'RESCUE',
}

export enum AiModel {
  REASONING = 'gemini-3-pro-preview',
  FAST = 'gemini-3-flash-preview',
  IMAGE = 'gemini-2.5-flash-image',
  TTS = 'gemini-2.5-flash-preview-tts',
}

export type ProjectDomain = 'ENTITIES' | 'NARRATIVE' | 'FOUNDATION';

export type TaskComplexity = 'basic' | 'complex' | 'creative' | 'critical';

export enum TransmissionScope {
  FULL = 'FULL',           // 全てのコンテキストを送信
  SUMMARY = 'SUMMARY',     // 要約と最小限のキャラクターのみ
  CHAPTER = 'CHAPTER',     // 執筆中の章のみ
  MINIMAL = 'MINIMAL',     // 指示文のみ
}

export enum SafetyPreset {
  STRICT = 'STRICT',       // 標準的な安全フィルター（全年齢）
  MATURE = 'MATURE',       // 小説表現を許容（R15相当の文脈を理解）
  CREATIVE = 'CREATIVE',   // 創作の自由を最大化（過度なフィルタリングを抑制）
}

export type ContextFocus = 'AUTO' | 'CHARACTERS' | 'WORLD' | 'PLOT';

export interface AppPreferences {
  transmissionScope: TransmissionScope;
  safetyPreset: SafetyPreset;
  allowSearch: boolean;
  whisperSensitivity: number; // 0-100
  disabledLinterRules: string[];
}

export interface ModelRequestConfig {
  model: string;
  thinkingBudget?: number;
  seed?: number;
  requestId?: string; 
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
  requestId?: string;
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

export interface AssetMetadata {
  id: string;
  projectId: string;
  type: 'portrait' | 'illustration';
  size: number;
  mimeType: string;
  createdAt: number;
  lastUsedAt: number;
  thumbnail?: string;
}

export interface SyncCandidate {
  id: string;
  name: string;
  confidence: number;
  reason: string;
}

export interface SyncOperation {
  id: string;
  requestId: string; 
  op: 'add' | 'update' | 'delete' | 'merge' | 'rename' | 'set' | 'addAlias';
  path: 'characters' | 'timeline' | 'foreshadowing' | 'entries' | 'chapters' | 'setting' | 'tone' | 'laws' | 'grandArc' | 'storyStructure' | 'locations' | 'organizations' | 'volumes' | 'themes' | 'keyItems' | 'storyThreads' | 'races' | 'bestiary' | 'abilities';
  domain?: ProjectDomain;
  targetId?: string;
  targetName?: string;
  field?: string;
  value: any;
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

// --- CHARACTER REDESIGN ---

export interface LinguisticProfile {
  firstPerson: string; // 一人称
  secondPerson: string; // 二人称
  speechStyle: 'Polite' | 'Casual' | 'Rough' | 'Archaic' | 'Technical' | 'Unique';
  catchphrases: string[];
  forbiddenWords: string[];
  toneSample?: string;
}

export interface Relationship {
  targetId: string; // Directed Edge Target
  type: 'Ally' | 'Enemy' | 'Romance' | 'Family' | 'Business' | 'Other' | 'Complex';
  description: string;
  strength: number; // -100 (Hatred) to 100 (Love/Loyalty)
  lastChangedAt?: string; // Chapter ID or 'Initial'
}

export interface CharacterHistoryEvent {
  chapterId?: string;
  timestamp: number;
  diff: string; // "Joined Party", "Lost Arm", etc.
}

export interface CharacterProfile {
  name: string;
  aliases: string[];
  role: 'Protagonist' | 'Antagonist' | 'Supporting' | 'Minor';
  description: string; // General summary
  appearance: string; // Visual features
  personality: string; // Innate traits
  background: string; // Backstory
  voice: LinguisticProfile;
  traits: string[]; // Keywords
  motivation: string;
  flaw: string;
  arc: string;
}

export interface CharacterState {
  location: string; // Location ID or Name
  internalState: string; // Emotion / Mindset
  currentGoal: string;
  health: string;
  socialStanding: string;
  // Inventory is removed; derived from KeyItems.currentOwnerId
}

export interface Character {
  id: string;
  
  // Immutable / Canon Profile
  profile: CharacterProfile;

  // Mutable / Dynamic State
  state: CharacterState;

  // Graph
  relationships: Relationship[];
  history: CharacterHistoryEvent[];

  // Meta
  imageUrl?: string;
  voiceId?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  isPrivate?: boolean;
}

export interface StateDelta {
  id: string;
  characterId: string;
  beatId?: string; 
  field: keyof CharacterState;
  op: 'set' | 'add' | 'remove';
  value: any;
  rationale: string;
  evidence: string;
  timestamp: number;
}

// ----------------------

export interface WorldEntry {
  id: string;
  parentId?: string; 
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
  isPrivate?: boolean; // ローカル秘匿設定
}

export interface WorldLaw {
  id: string;
  name: string;
  description: string;
  type: 'Physics' | 'Magic' | 'Social' | 'Divine' | 'Taboo';
  importance: 'Absolute' | 'Flexible' | 'Conditional';
}

export interface LocationConnection {
  targetLocationId: string;
  travelTime: string; // e.g. "徒歩3日"
  method: string; // e.g. "街道"
  dangerLevel: string;
}

export interface Location {
  id: string;
  name: string;
  parentId?: string;
  type: 'Continent' | 'Country' | 'City' | 'Region' | 'Spot' | 'Building';
  description: string;
  connections?: LocationConnection[]; // NEW: 地理的接続
}

export interface OrganizationRelation {
  targetOrganizationId: string;
  stance: 'Ally' | 'Neutral' | 'Hostile' | 'Subordinate';
  description: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string;
  type: 'Guild' | 'Government' | 'Cult' | 'Party' | 'Company';
  memberIds: string[];
  relations?: OrganizationRelation[]; // NEW: 外交関係
}

export interface Theme {
  id: string;
  concept: string; // e.g. "贖罪"
  description: string;
  motifs: string[]; // e.g. ["雨", "錆びた剣"]
  associatedCharacterIds: string[];
}

export interface KeyItem { // Artifact
  id: string;
  name: string;
  type: 'Weapon' | 'Tool' | 'Relic' | 'Evidence';
  description: string;
  currentOwnerId: string | null;
  currentLocationId: string | null;
  history: string[]; // 所有の履歴
  mechanics?: string; // 特殊能力や作動原理
}

export interface StoryThread { // SubPlot
  id: string;
  title: string;
  involvedCharacterIds: string[];
  status: 'Open' | 'Resolved';
  beats: { chapterId: string; eventDescription: string }[];
}

// --- NEW STRUCTURES ---

export interface Race {
  id: string;
  name: string;
  description: string;
  traits: string[]; // 身体的・魔法的特徴
  lifespan?: string; // 平均寿命
  locations?: string[]; // 主な居住地ID
}

export interface Bestiary { // Flora & Fauna
  id: string;
  name: string;
  type: 'Beast' | 'Plant' | 'Monster' | 'Spirit';
  description: string;
  habitat: string; // 生息地
  dangerLevel: 'Safe' | 'Caution' | 'Deadly' | 'Catastrophic';
  dropItems?: string[]; // 採取可能な素材など
}

export interface Ability { // Magic / Skills
  id: string;
  name: string;
  type: 'Magic' | 'Skill' | 'Tech' | 'Divine';
  description: string;
  cost: string; // マナ、体力、代償など
  mechanics: string; // ルール上の効果
}

// ----------------------

export interface StoryPhase {
  id: string;
  name: string; // e.g. "Act 1", "Introduction"
  summary: string;
  goal: string;
}

export interface ForeshadowingLink {
  foreshadowingId: string;
  action: 'Plant' | 'Progress' | 'Payoff' | 'Twist' | 'RedHerring'; // Expanded actions
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
  status: 'Canon' | 'Plan' | 'Hypothesis'; // 事実か、予定か、仮説か
  relatedThreadId?: string; // どのスレッドに属するイベントか
}

export interface Foreshadowing {
  id: string;
  title: string;
  description: string;
  status: 'Open' | 'Resolved' | 'Stale';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  relatedThreadId?: string; // 親スレッド
  relatedThemeId?: string; // 親テーマ
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
  stateDeltas: StateDelta[]; 
  involvedCharacterIds: string[];
  foreshadowingLinks?: ForeshadowingLink[];
  postStateCache?: { [characterId: string]: CharacterState }; 
  updatedAt: number; 
}

export interface StoryVolume {
  id: string;
  title: string;
  summary: string;
  order: number;
}

export interface Citation {
  sourceType: 'Bible' | 'Manuscript';
  sourceId?: string;
  textSnippet: string;
  label: string;
}

export interface BibleIssue {
  id: string;
  ruleId: string; // 判定ルールの種類
  type: 'Duplicate' | 'Incomplete' | 'Contradiction' | 'Broken' | 'ToneShift';
  targetIds: string[];
  targetType: 'Character' | 'Entry' | 'General' | 'Law' | 'Plot';
  description: string;
  suggestion: string;
  severity: 'Low' | 'Medium' | 'High';
  citations: Citation[];
  feedback?: 'Useful' | 'FalsePositive' | 'Disabled';
}

export interface WorldBible {
  version: number;
  setting: string; 
  laws: WorldLaw[];
  grandArc: string; 
  storyStructure: StoryPhase[];
  locations: Location[];
  organizations: Organization[];
  themes: Theme[]; 
  keyItems: KeyItem[]; 
  storyThreads: StoryThread[];
  
  // NEW SECTIONS
  races: Race[]; // 種族・民族
  bestiary: Bestiary[]; // 博物誌
  abilities: Ability[]; // 能力・魔法体系

  tone: string;     
  volumes: StoryVolume[];
  characters: Character[]; 
  timeline: TimelineEvent[]; 
  foreshadowing: Foreshadowing[]; 
  entries: WorldEntry[]; 
  nexusBranches: NexusBranch[]; 
  integrityIssues: BibleIssue[];
  summaryBuffer: string; 
  lastSummaryUpdate: number;
}

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
  language: 'ja';
  tokenUsage: TokenUsageEntry[];
  violationCount: number;
  violationHistory: SafetyViolation[];
  headRev?: number;
  preferences: AppPreferences; // ユーザー設定
}

export interface SyncState {
  chatHistory: ChatMessage[];
  archivedChat?: ChatMessage[]; // UI表示用（コンテキストには含まない古いログ）
  conversationMemory?: string; // 長期記憶（要約された会話ログ）
  pendingChanges: SyncOperation[];
  quarantine: QuarantineItem[];
  history: HistoryEntry[];
}

export interface StoryProject {
  meta: StoryProjectMetadata;
  bible: WorldBible;
  chapters: ChapterLog[];
  sync: SyncState;
  assets?: { [id: string]: string }; // 画像アセットのベース64データを格納（エクスポート用）
}

export interface SystemLog {
  id: string;
  timestamp: number;
  type: 'info' | 'error' | 'success' | 'usage';
  source: 'System' | 'Architect' | 'Writer' | 'Linter' | 'Artist' | 'Voice' | 'NeuralSync' | 'Safety';
  message: string;
  details?: string;
}

export interface AppNotification {
  id: string;
  type: 'info' | 'error' | 'success' | 'usage' | 'warning';
  message: string;
}

export interface SafetyIntervention {
  isOpen: boolean;
  category?: string;
  reason?: string;
  alternatives: string[];
  isLocked: boolean; // 連続違反によるロック
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
  safetyIntervention: SafetyIntervention;
  showPubModal: boolean;
  showHelpModal: boolean;
  saveStatus: 'idle' | 'saving' | 'saved';
  isConflict: boolean;
}

export type MetaAction = 
  | { type: 'LOAD_META'; payload: StoryProjectMetadata }
  | { type: 'UPDATE_META'; payload: Partial<StoryProjectMetadata> }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<AppPreferences> }
  | { type: 'TRACK_USAGE'; payload: UsagePayload }
  | { type: 'RECORD_VIOLATION'; payload: SafetyViolation }
  | { type: 'RESET_VIOLATIONS' };

export type BibleAction = 
  | { type: 'LOAD_BIBLE'; payload: WorldBible }
  | { type: 'UPDATE_BIBLE'; payload: Partial<WorldBible> }
  | { type: 'APPLY_SYNC_OP'; payload: { nextBible: WorldBible; nextChapters: ChapterLog[]; historyEntry: HistoryEntry } }
  | { type: 'UNDO_BIBLE'; payload: { nextBible: WorldBible; nextChapters: ChapterLog[] } };

export type ChapterAction = 
  | { type: 'LOAD_CHAPTERS'; payload: ChapterLog[] }
  | { type: 'UPDATE_CHAPTER'; id: string; updates: Partial<ChapterLog> }
  | { type: 'SET_CHAPTER_CONTENT'; id: string; content: string }
  | { type: 'ADD_CHAPTER'; payload: ChapterLog }
  | { type: 'REMOVE_CHAPTER'; id: string };

export type SyncAction = 
  | { type: 'LOAD_SYNC'; payload: SyncState }
  | { type: 'SET_CHAT_HISTORY'; payload: ChatMessage[] }
  | { type: 'CONSOLIDATE_CHAT'; payload: { newMemory: string; archivedCount: number } }
  | { type: 'ADD_PENDING_OPS'; payload: SyncOperation[] }
  | { type: 'UPDATE_PENDING_OP'; id: string; updates: Partial<SyncOperation> }
  | { type: 'REMOVE_PENDING_OP'; id: string }
  | { type: 'ADD_QUARANTINE_ITEMS'; payload: QuarantineItem[] }
  | { type: 'REMOVE_QUARANTINE_ITEM'; id: string }
  | { type: 'ADD_HISTORY_ENTRY'; payload: HistoryEntry }
  | { type: 'REMOVE_HISTORY_ENTRY'; id: string };

export type UIAction = 
  | { type: 'SET_VIEW'; payload: ViewMode }
  | { type: 'SET_PLOTTER_TAB'; payload: string }
  | { type: 'SET_PENDING_MSG'; payload: string | null }
  | { type: 'OPEN_DIALOG'; payload: DialogState }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'SET_SAFETY_INTERVENTION'; payload: Partial<SafetyIntervention> }
  | { type: 'SET_PUB_MODAL'; payload: boolean }
  | { type: 'SET_HELP_MODAL'; payload: boolean }
  | { type: 'SET_SAVE_STATUS'; payload: 'idle' | 'saving' | 'saved' }
  | { type: 'SET_CONFLICT'; payload: boolean };

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

export interface DetectionResult {
  hasChangeIntent: boolean;
  isHypothetical: boolean; 
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

export interface WhisperAdvice {
  id: string;
  ruleId: string;
  text: string;
  type: 'info' | 'alert';
  citations: Citation[];
}