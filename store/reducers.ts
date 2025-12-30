
import { 
  StoryProjectMetadata, WorldBible, ChapterLog, SyncState, UIState,
  MetaAction, BibleAction, ChapterAction, SyncAction, UIAction,
  NotificationAction, SystemLog, AppNotification, StoryProject, ProjectAction
} from '../types';

const update = <T>(state: T, payload: Partial<T>): T => ({
  ...state,
  ...payload,
});

const updateWithTimestamp = <T>(state: T, payload: Partial<T>): T => ({
  ...state,
  ...payload,
  updatedAt: Date.now()
} as any);

/**
 * Metadata Reducer
 */
export const metaReducer = (state: StoryProjectMetadata, action: MetaAction): StoryProjectMetadata => {
  switch (action.type) {
    case 'LOAD_META':
      return action.payload;
    case 'UPDATE_META':
      return updateWithTimestamp(state, action.payload);
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
        updatedAt: Date.now()
      };
    case 'TRACK_USAGE':
      const entry = { id: crypto.randomUUID(), timestamp: Date.now(), ...action.payload };
      return { 
        ...state, 
        tokenUsage: [entry, ...(state.tokenUsage || [])].slice(0, 500), 
        updatedAt: Date.now() 
      };
    case 'RECORD_VIOLATION':
      return {
        ...state,
        violationCount: (state.violationCount || 0) + 1,
        violationHistory: [action.payload, ...(state.violationHistory || [])].slice(0, 50),
        updatedAt: Date.now()
      };
    case 'RESET_VIOLATIONS':
      return {
        ...state,
        violationCount: 0,
        updatedAt: Date.now()
      };
    default:
      return state;
  }
};

/**
 * Bible Reducer
 */
export const bibleReducer = (state: WorldBible, action: BibleAction): WorldBible => {
  switch (action.type) {
    case 'LOAD_BIBLE':
      return action.payload;
    case 'UPDATE_BIBLE':
      return update(state, action.payload);
    case 'APPLY_SYNC_OP':
    case 'UNDO_BIBLE':
      return action.payload.nextBible;
    default:
      return state;
  }
};

/**
 * Chapters Reducer
 */
export const chaptersReducer = (state: ChapterLog[], action: ChapterAction | BibleAction): ChapterLog[] => {
  switch (action.type) {
    case 'LOAD_CHAPTERS':
      return action.payload;
    case 'UPDATE_CHAPTER':
      if (action.type === 'UPDATE_CHAPTER') {
        return state.map(c => 
          c.id === action.id 
            ? { 
                ...c, 
                ...action.updates, 
                updatedAt: Date.now(), 
                wordCount: action.updates.content !== undefined ? action.updates.content.length : c.wordCount 
              } 
            : c
        );
      }
      return state;
    case 'SET_CHAPTER_CONTENT':
      if (action.type === 'SET_CHAPTER_CONTENT') {
        return state.map(c => 
          c.id === action.id ? { ...c, content: action.content, wordCount: action.content.length, updatedAt: Date.now() } : c
        );
      }
      return state;
    case 'ADD_CHAPTER':
      return action.type === 'ADD_CHAPTER' ? [...state, action.payload] : state;
    case 'REMOVE_CHAPTER':
      return action.type === 'REMOVE_CHAPTER' ? state.filter(c => c.id !== action.id) : state;
    case 'APPLY_SYNC_OP':
    case 'UNDO_BIBLE':
      if (action.type === 'APPLY_SYNC_OP' || action.type === 'UNDO_BIBLE') {
        return action.payload.nextChapters || state;
      }
      return state;
    default:
      return state;
  }
};

/**
 * Sync Reducer
 */
export const syncReducer = (state: SyncState, action: SyncAction): SyncState => {
  switch (action.type) {
    case 'LOAD_SYNC':
      return action.payload;
    case 'SET_CHAT_HISTORY':
      return update(state, { chatHistory: action.payload });
    case 'ADD_PENDING_OPS':
      const newOps = action.payload.filter(nop => !state.pendingChanges.some(sop => sop.id === nop.id));
      return update(state, { pendingChanges: [...state.pendingChanges, ...newOps] });
    case 'UPDATE_PENDING_OP':
      return update(state, { 
        pendingChanges: state.pendingChanges.map(op => 
          op.id === action.id ? { ...op, ...action.updates } : op
        ) 
      });
    case 'REMOVE_PENDING_OP':
      return update(state, { pendingChanges: state.pendingChanges.filter(op => op.id !== action.id) });
    case 'ADD_QUARANTINE_ITEMS':
      return update(state, { quarantine: [...(state.quarantine || []), ...action.payload] });
    case 'REMOVE_QUARANTINE_ITEM':
      return update(state, { quarantine: (state.quarantine || []).filter(i => i.id !== action.id) });
    case 'ADD_HISTORY_ENTRY':
      return update(state, { history: [action.payload, ...state.history].slice(0, 100) });
    case 'REMOVE_HISTORY_ENTRY':
      return update(state, { history: state.history.filter(h => h.id !== action.id) });
    default:
      return state;
  }
};

/**
 * Root Project Reducer
 */
export const projectReducer = (state: StoryProject, action: ProjectAction): StoryProject => {
  if (action.type === 'LOAD_PROJECT') {
    return action.payload;
  }
  
  return {
    meta: metaReducer(state.meta, action as MetaAction),
    bible: bibleReducer(state.bible, action as BibleAction),
    chapters: chaptersReducer(state.chapters, action as any),
    sync: syncReducer(state.sync, action as SyncAction),
  };
};

/**
 * UI Reducer
 */
export const uiReducer = (state: UIState, action: UIAction): UIState => {
  switch (action.type) {
    case 'SET_VIEW':
      return update(state, { view: action.payload });
    case 'SET_PLOTTER_TAB':
      return update(state, { plotterTab: action.payload });
    case 'SET_PENDING_MSG':
      return update(state, { pendingMsg: action.payload });
    case 'OPEN_DIALOG':
      return update(state, { dialog: { ...action.payload, isOpen: true } });
    case 'CLOSE_DIALOG':
      return update(state, { dialog: { ...state.dialog, isOpen: false } });
    case 'SET_SAFETY_INTERVENTION':
      return update(state, { safetyIntervention: { ...state.safetyIntervention, ...action.payload } });
    case 'SET_PUB_MODAL':
      return update(state, { showPubModal: action.payload });
    case 'SET_HELP_MODAL':
      return update(state, { showHelpModal: action.payload });
    case 'SET_SAVE_STATUS':
      return update(state, { saveStatus: action.payload });
    case 'SET_CONFLICT':
      return update(state, { isConflict: action.payload });
    default:
      return state;
  }
};

/**
 * Notification Reducer
 */
export const notificationReducer = (state: { logs: SystemLog[], notifications: AppNotification[] }, action: NotificationAction) => {
  switch (action.type) {
    case 'ADD_LOG':
      const log = action.payload;
      const notifTypeMap: Record<string, AppNotification['type']> = {
        'error': 'error',
        'success': 'success',
        'usage': 'usage',
        'Safety': 'warning'
      };
      const notif = (['error', 'success', 'usage', 'Safety'] as const).includes(log.type as any || log.source as any) 
        ? { id: crypto.randomUUID(), type: notifTypeMap[log.type] || notifTypeMap[log.source] || 'info', message: log.message }
        : null;
      return {
        logs: [log, ...state.logs].slice(0, 500),
        notifications: notif ? [...state.notifications, notif].slice(-5) : state.notifications
      };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.id) };
    default:
      return state;
  }
};
