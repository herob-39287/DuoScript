
export enum ViewMode {
  WELCOME = 'WELCOME',
  DASHBOARD = 'DASHBOARD',
  PLOTTER = 'PLOTTER',
  WRITER = 'WRITER',
  RESCUE = 'RESCUE',
}

export interface SystemLog {
  id: string;
  timestamp: number;
  type: 'info' | 'error' | 'success' | 'usage';
  source: 'System' | 'Architect' | 'Writer' | 'Linter' | 'Artist' | 'Voice' | 'NeuralSync' | 'Safety';
  message: string;
  details?: string;
}

export type UsageCallback = (usage: UsagePayload) => void;
export type LogCallback = (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => void;

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
  isLocked: boolean; 
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
  forceSaveRequested: boolean; 
  isContextActive: boolean;
  thinkingPhase: string | null; // AIの思考プロセスを表示するための状態
}

import { 
  StoryProject, StoryProjectMetadata, AppPreferences, 
  TokenUsageEntry, SafetyViolation, ChapterLog, UsagePayload 
} from './project';
import { WorldBible } from './bible';
import { 
  SyncState, ChatMessage, SyncOperation, HistoryEntry, 
  QuarantineItem 
} from './sync';

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
  | { type: 'SET_CONFLICT'; payload: boolean }
  | { type: 'SET_FORCE_SAVE_REQUESTED'; payload: boolean } 
  | { type: 'TOGGLE_CONTEXT_ACTIVE'; payload: boolean }
  | { type: 'SET_THINKING_PHASE'; payload: string | null };

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
