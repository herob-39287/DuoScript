import {
  StoryProject,
  StoryProjectMetadata,
  ChapterLog,
  UsagePayload,
  AppPreferences,
  SafetyViolation,
} from '../types/project';
import { WorldBible, Character } from '../types/bible';
import { SyncState, ChatMessage, SyncOperation, HistoryEntry, QuarantineItem } from '../types/sync';
import {
  ViewMode,
  SystemLog,
  DialogState,
  UIAction,
  NotificationAction,
  BibleAction,
  ChapterAction,
  MetaAction,
  ProjectAction,
  SafetyIntervention,
  BibleArrayKeys,
  SyncAction,
} from '../types/ui';

/**
 * Metadata Actions
 */
export const loadMeta = (meta: StoryProjectMetadata): MetaAction => ({
  type: 'LOAD_META',
  payload: meta,
});
export const updateMeta = (updates: Partial<StoryProjectMetadata>): MetaAction => ({
  type: 'UPDATE_META',
  payload: updates,
});
export const updatePreferences = (prefs: Partial<AppPreferences>): MetaAction => ({
  type: 'UPDATE_PREFERENCES',
  payload: prefs,
});
export const trackUsage = (usage: UsagePayload): MetaAction => ({
  type: 'TRACK_USAGE',
  payload: usage,
});

/**
 * Bible Actions
 */
export const loadBible = (bible: WorldBible): BibleAction => ({
  type: 'LOAD_BIBLE',
  payload: bible,
});
export const updateBible = (updates: Partial<WorldBible>): BibleAction => ({
  type: 'UPDATE_BIBLE',
  payload: updates,
});

// Optimized specific actions
export const updateCharacterData = (id: string, updates: Partial<Character>): BibleAction => ({
  type: 'UPDATE_CHARACTER_DATA',
  id,
  updates,
});

// Helper type to infer item type from path
type BibleListItem<K extends BibleArrayKeys> = WorldBible[K] extends Array<infer I> ? I : never;

// Overloads for manipulateBibleList to ensure type safety
export function manipulateBibleList<K extends BibleArrayKeys>(
  path: K,
  op: 'add',
  id: undefined,
  item: BibleListItem<K>,
): BibleAction;
export function manipulateBibleList<K extends BibleArrayKeys>(
  path: K,
  op: 'update',
  id: string,
  item: undefined,
  updates: Partial<BibleListItem<K>>,
): BibleAction;
export function manipulateBibleList<K extends BibleArrayKeys>(
  path: K,
  op: 'delete',
  id: string,
): BibleAction;
export function manipulateBibleList(
  path: any,
  op: any,
  id?: any,
  item?: any,
  updates?: any,
): BibleAction {
  return {
    type: 'MANIPULATE_BIBLE_LIST',
    path,
    op,
    id,
    item,
    updates,
  };
}

export const applySyncOp = (
  nextBible: WorldBible,
  nextChapters: ChapterLog[],
  historyEntry: HistoryEntry,
): BibleAction => ({
  type: 'APPLY_SYNC_OP',
  payload: { nextBible, nextChapters, historyEntry },
});

export const undoBible = (nextBible: WorldBible, nextChapters: ChapterLog[]): BibleAction => ({
  type: 'UNDO_BIBLE',
  payload: { nextBible, nextChapters },
});

/**
 * Chapter Actions
 */
export const loadChapters = (chapters: ChapterLog[]): ChapterAction => ({
  type: 'LOAD_CHAPTERS',
  payload: chapters,
});
export const updateChapter = (id: string, updates: Partial<ChapterLog>): ChapterAction => ({
  type: 'UPDATE_CHAPTER',
  id,
  updates,
});
export const setChapterDraftText = (id: string, draftText: string): ChapterAction => ({
  type: 'SET_CHAPTER_DRAFT_TEXT',
  id,
  draftText,
});
export const setChapterAuthoringMode = (
  id: string,
  mode: ChapterLog['authoringMode'],
): ChapterAction => ({
  type: 'SET_CHAPTER_AUTHORING_MODE',
  id,
  mode,
});
export const addChapter = (chapter: ChapterLog): ChapterAction => ({
  type: 'ADD_CHAPTER',
  payload: chapter,
});
export const removeChapter = (id: string): ChapterAction => ({ type: 'REMOVE_CHAPTER', id });

/**
 * Sync Actions
 */
export const loadSync = (sync: SyncState): SyncAction => ({ type: 'LOAD_SYNC', payload: sync });
export const setChatHistory = (history: ChatMessage[]): SyncAction => ({
  type: 'SET_CHAT_HISTORY',
  payload: history,
});
export const consolidateChat = (newMemory: string, archivedCount: number): SyncAction => ({
  type: 'CONSOLIDATE_CHAT',
  payload: { newMemory, archivedCount },
});
export const addPendingOps = (ops: SyncOperation[]): SyncAction => ({
  type: 'ADD_PENDING_OPS',
  payload: ops,
});
export const updatePendingOp = (id: string, updates: Partial<SyncOperation>): SyncAction => ({
  type: 'UPDATE_PENDING_OP',
  id,
  updates,
});
export const removePendingOp = (id: string): SyncAction => ({ type: 'REMOVE_PENDING_OP', id });
export const addQuarantineItems = (items: QuarantineItem[]): SyncAction => ({
  type: 'ADD_QUARANTINE_ITEMS',
  payload: items,
});
export const removeQuarantineItem = (id: string): SyncAction => ({
  type: 'REMOVE_QUARANTINE_ITEM',
  id,
});
export const addHistoryEntry = (entry: HistoryEntry): SyncAction => ({
  type: 'ADD_HISTORY_ENTRY',
  payload: entry,
});
export const removeHistoryEntry = (id: string): SyncAction => ({
  type: 'REMOVE_HISTORY_ENTRY',
  id,
});

/**
 * UI Actions
 */
export const setView = (view: ViewMode): UIAction => ({ type: 'SET_VIEW', payload: view });
export const setPlotterTab = (tab: string): UIAction => ({ type: 'SET_PLOTTER_TAB', payload: tab });
export const setPendingMsg = (msg: string | null): UIAction => ({
  type: 'SET_PENDING_MSG',
  payload: msg,
});
export const openDialog = (dialog: DialogState): UIAction => ({
  type: 'OPEN_DIALOG',
  payload: dialog,
});
export const closeDialog = (): UIAction => ({ type: 'CLOSE_DIALOG' });
export const setSafetyIntervention = (payload: Partial<SafetyIntervention>): UIAction => ({
  type: 'SET_SAFETY_INTERVENTION',
  payload,
});
export const setPubModal = (show: boolean): UIAction => ({ type: 'SET_PUB_MODAL', payload: show });
export const setHelpModal = (show: boolean): UIAction => ({
  type: 'SET_HELP_MODAL',
  payload: show,
});
export const setSaveStatus = (status: 'idle' | 'saving' | 'saved'): UIAction => ({
  type: 'SET_SAVE_STATUS',
  payload: status,
});
export const setConflict = (isConflict: boolean): UIAction => ({
  type: 'SET_CONFLICT',
  payload: isConflict,
});
export const setForceSaveRequested = (requested: boolean): UIAction => ({
  type: 'SET_FORCE_SAVE_REQUESTED',
  payload: requested,
});
export const setThinkingPhase = (phase: string | null): UIAction => ({
  type: 'SET_THINKING_PHASE',
  payload: phase,
});
export const setOnlineStatus = (isOnline: boolean): UIAction => ({
  type: 'SET_ONLINE_STATUS',
  payload: isOnline,
});

/**
 * Notification Actions
 */
export const addLog = (log: SystemLog): NotificationAction => ({ type: 'ADD_LOG', payload: log });
export const clearLogs = (): NotificationAction => ({ type: 'CLEAR_LOGS' });
export const dismissNotification = (id: string): NotificationAction => ({
  type: 'DISMISS_NOTIFICATION',
  id,
});

/**
 * Root Project Actions
 */
export const loadProject = (project: StoryProject): ProjectAction => ({
  type: 'LOAD_PROJECT',
  payload: project,
});
export const clearData = (): ProjectAction => ({ type: 'CLEAR_DATA' });

export const createLog = (
  type: SystemLog['type'],
  source: SystemLog['source'],
  message: string,
  details?: string,
): SystemLog => ({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  type,
  source,
  message,
  details,
});
