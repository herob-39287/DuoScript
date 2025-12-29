import { 
  StoryProject, StoryProjectMetadata, WorldBible, ChapterLog, 
  SyncOperation, HistoryEntry, ChatMessage, ViewMode, 
  UsagePayload, SystemLog, DialogState, ProjectAction, 
  MetaAction, BibleAction, ChapterAction, SyncAction, UIAction, NotificationAction,
  SyncState
} from '../types';

/**
 * Metadata Actions
 */
export const loadMeta = (meta: StoryProjectMetadata): MetaAction => ({ type: 'LOAD_META', payload: meta });
export const updateMeta = (updates: Partial<StoryProjectMetadata>): MetaAction => ({ type: 'UPDATE_META', payload: updates });
export const trackUsage = (usage: UsagePayload): MetaAction => ({ type: 'TRACK_USAGE', payload: usage });

/**
 * Bible Actions
 */
export const loadBible = (bible: WorldBible): BibleAction => ({ type: 'LOAD_BIBLE', payload: bible });
export const updateBible = (updates: Partial<WorldBible>): BibleAction => ({ type: 'UPDATE_BIBLE', payload: updates });
export const applySyncOp = (nextBible: WorldBible, historyEntry: HistoryEntry): BibleAction => ({ 
  type: 'APPLY_SYNC_OP', 
  payload: { nextBible, historyEntry } 
});
export const undoBible = (nextBible: WorldBible): BibleAction => ({ type: 'UNDO_BIBLE', payload: { nextBible } });

/**
 * Chapter Actions
 */
export const loadChapters = (chapters: ChapterLog[]): ChapterAction => ({ type: 'LOAD_CHAPTERS', payload: chapters });
export const updateChapter = (id: string, updates: Partial<ChapterLog>): ChapterAction => ({ type: 'UPDATE_CHAPTER', id, updates });
export const setChapterContent = (id: string, content: string): ChapterAction => ({ type: 'SET_CHAPTER_CONTENT', id, content });
export const addChapter = (chapter: ChapterLog): ChapterAction => ({ type: 'ADD_CHAPTER', payload: chapter });
export const removeChapter = (id: string): ChapterAction => ({ type: 'REMOVE_CHAPTER', id });

/**
 * Sync Actions
 */
export const loadSync = (sync: SyncState): SyncAction => ({ type: 'LOAD_SYNC', payload: sync });
export const setChatHistory = (history: ChatMessage[]): SyncAction => ({ type: 'SET_CHAT_HISTORY', payload: history });
export const addPendingOps = (ops: SyncOperation[]): SyncAction => ({ type: 'ADD_PENDING_OPS', payload: ops });
export const removePendingOp = (id: string): SyncAction => ({ type: 'REMOVE_PENDING_OP', id });
export const addHistoryEntry = (entry: HistoryEntry): SyncAction => ({ type: 'ADD_HISTORY_ENTRY', payload: entry });
export const removeHistoryEntry = (id: string): SyncAction => ({ type: 'REMOVE_HISTORY_ENTRY', id });

/**
 * UI Actions
 */
export const setView = (view: ViewMode): UIAction => ({ type: 'SET_VIEW', payload: view });
export const setPlotterTab = (tab: string): UIAction => ({ type: 'SET_PLOTTER_TAB', payload: tab });
export const setPendingMsg = (msg: string | null): UIAction => ({ type: 'SET_PENDING_MSG', payload: msg });
export const openDialog = (dialog: DialogState): UIAction => ({ type: 'OPEN_DIALOG', payload: dialog });
export const closeDialog = (): UIAction => ({ type: 'CLOSE_DIALOG' });
export const setPubModal = (show: boolean): UIAction => ({ type: 'SET_PUB_MODAL', payload: show });
export const setHelpModal = (show: boolean): UIAction => ({ type: 'SET_HELP_MODAL', payload: show });
export const setSaveStatus = (status: 'idle' | 'saving' | 'saved'): UIAction => ({ type: 'SET_SAVE_STATUS', payload: status });

/**
 * Notification Actions
 */
export const addLog = (log: SystemLog): NotificationAction => ({ type: 'ADD_LOG', payload: log });
export const clearLogs = (): NotificationAction => ({ type: 'CLEAR_LOGS' });
export const dismissNotification = (id: string): NotificationAction => ({ type: 'DISMISS_NOTIFICATION', id });

/**
 * Root Project Actions
 */
export const loadProject = (project: StoryProject): ProjectAction => ({ type: 'LOAD_PROJECT', payload: project });
export const clearData = (): ProjectAction => ({ type: 'CLEAR_DATA' });

// Enhanced Utility for generating a standard log
export const createLog = (
  type: SystemLog['type'], 
  source: SystemLog['source'], 
  message: string, 
  details?: string
): SystemLog => ({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  type,
  source,
  message,
  details
});