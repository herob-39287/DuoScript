
import { 
  StoryProjectMetadata, WorldBible, ChapterLog, SyncState,
  MetaAction, BibleAction, ChapterAction, SyncAction, StoryProject,
  NotificationAction, SystemLog, AppNotification
} from '../types';

/**
 * Reducer for story project metadata
 */
export const metaReducer = (state: StoryProjectMetadata, action: MetaAction): StoryProjectMetadata => {
  switch (action.type) {
    case 'LOAD_META':
      return action.payload;
    case 'UPDATE_META':
      return { ...state, ...action.payload, updatedAt: Date.now() };
    case 'TRACK_USAGE':
      const entry = { id: crypto.randomUUID(), timestamp: Date.now(), ...action.payload };
      return { ...state, tokenUsage: [entry, ...(state.tokenUsage || [])].slice(0, 500), updatedAt: Date.now() };
    default:
      return state;
  }
};

/**
 * Reducer for the world bible (setting and lore)
 */
export const bibleReducer = (state: WorldBible, action: BibleAction): WorldBible => {
  switch (action.type) {
    case 'LOAD_BIBLE':
      return action.payload;
    case 'UPDATE_BIBLE':
      return { ...state, ...action.payload };
    case 'APPLY_SYNC_OP':
      return action.payload.nextBible;
    case 'UNDO_BIBLE':
      return action.payload.nextBible;
    default:
      return state;
  }
};

/**
 * Reducer for chapters and manuscript content
 */
export const chaptersReducer = (state: ChapterLog[], action: ChapterAction): ChapterLog[] => {
  switch (action.type) {
    case 'LOAD_CHAPTERS':
      return action.payload;
    case 'UPDATE_CHAPTER':
      return state.map(c => 
        c.id === action.id 
          ? { ...c, ...action.updates, updatedAt: Date.now(), wordCount: action.updates.content !== undefined ? action.updates.content.length : c.wordCount } 
          : c
      );
    case 'SET_CHAPTER_CONTENT':
      return state.map(c => 
        c.id === action.id ? { ...c, content: action.content, wordCount: action.content.length } : c
      );
    case 'ADD_CHAPTER':
      return [...state, action.payload];
    case 'REMOVE_CHAPTER':
      return state.filter(c => c.id !== action.id);
    default:
      return state;
  }
};

/**
 * Reducer for NeuralSync state and chat history
 */
export const syncReducer = (state: SyncState, action: SyncAction): SyncState => {
  switch (action.type) {
    case 'LOAD_SYNC':
      return action.payload;
    case 'SET_CHAT_HISTORY':
      return { ...state, chatHistory: action.payload };
    case 'ADD_PENDING_OPS':
      const newOps = action.payload.filter(nop => !state.pendingChanges.some(sop => sop.id === nop.id));
      return { ...state, pendingChanges: [...state.pendingChanges, ...newOps] };
    case 'REMOVE_PENDING_OP':
      return { ...state, pendingChanges: state.pendingChanges.filter(op => op.id !== action.id) };
    case 'ADD_HISTORY_ENTRY':
      return { ...state, history: [action.payload, ...state.history].slice(0, 100) };
    case 'REMOVE_HISTORY_ENTRY':
      return { ...state, history: state.history.filter(h => h.id !== action.id) };
    default:
      return state;
  }
};

/**
 * State interface for notifications and logs
 */
export interface NotificationState {
  logs: SystemLog[];
  notifications: AppNotification[];
}

/**
 * Reducer for system logs and user notifications
 */
export const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
  switch (action.type) {
    case 'ADD_LOG':
      const newLog = action.payload;
      const newNotif: AppNotification | null = (newLog.type === 'error' || newLog.type === 'success' || newLog.type === 'usage') 
        ? { id: crypto.randomUUID(), type: newLog.type, message: newLog.message }
        : null;
      return {
        ...state,
        logs: [newLog, ...state.logs].slice(0, 500),
        notifications: newNotif ? [...state.notifications, newNotif].slice(-5) : state.notifications
      };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.id) };
    default:
      return state;
  }
};
