
import { produce } from 'immer';
import { 
  StoryProjectMetadata, WorldBible, ChapterLog, SyncState, UIState,
  MetaAction, BibleAction, ChapterAction, SyncAction, UIAction,
  NotificationAction, SystemLog, AppNotification, StoryProject, ProjectAction
} from '../types';

/**
 * Metadata Reducer (Immer)
 */
export const metaReducer = (state: StoryProjectMetadata, action: MetaAction): StoryProjectMetadata => {
  return produce(state, draft => {
    switch (action.type) {
      case 'LOAD_META':
        return action.payload;
      case 'UPDATE_META':
        Object.assign(draft, action.payload);
        draft.updatedAt = Date.now();
        break;
      case 'UPDATE_PREFERENCES':
        Object.assign(draft.preferences, action.payload);
        draft.updatedAt = Date.now();
        break;
      case 'TRACK_USAGE':
        if (!draft.tokenUsage) draft.tokenUsage = [];
        draft.tokenUsage.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), ...action.payload });
        if (draft.tokenUsage.length > 500) draft.tokenUsage.length = 500;
        draft.updatedAt = Date.now();
        break;
      case 'RECORD_VIOLATION': {
        // セーフティ違反の記録
        draft.violationCount = (draft.violationCount || 0) + 1;
        if (!draft.violationHistory) draft.violationHistory = [];
        draft.violationHistory.unshift(action.payload);
        if (draft.violationHistory.length > 50) draft.violationHistory.length = 50;
        draft.updatedAt = Date.now();
        break;
      }
      case 'RESET_VIOLATIONS':
        draft.violationCount = 0;
        draft.updatedAt = Date.now();
        break;
    }

    // 自然回復ロジック (Reducer内で直接時間を扱うのは純粋関数に反するが、利便性のため許容)
    // 本来はMiddlewareかpersistenceで行うべきだが、ここでは簡易化
    if (draft.violationCount > 0 && draft.violationHistory && draft.violationHistory.length > 0) {
      const lastViolation = draft.violationHistory[0].timestamp;
      const hoursSinceLast = (Date.now() - lastViolation) / (1000 * 60 * 60);
      if (hoursSinceLast > 12 && draft.violationCount > 0) {
        // 12時間経過でカウント減少（ロック解除の救済措置）
        draft.violationCount = Math.max(0, draft.violationCount - 1);
      }
    }
  });
};

/**
 * Bible Reducer (Immer)
 */
export const bibleReducer = (state: WorldBible, action: BibleAction): WorldBible => {
  return produce(state, draft => {
    switch (action.type) {
      case 'LOAD_BIBLE':
        return action.payload;
      case 'UPDATE_BIBLE':
        Object.assign(draft, action.payload);
        break;
      case 'APPLY_SYNC_OP':
      case 'UNDO_BIBLE':
        return action.payload.nextBible;
    }
  });
};

/**
 * Chapters Reducer (Immer)
 */
export const chaptersReducer = (state: ChapterLog[], action: ChapterAction | BibleAction): ChapterLog[] => {
  return produce(state, draft => {
    switch (action.type) {
      case 'LOAD_CHAPTERS':
        return action.payload;
      case 'UPDATE_CHAPTER': {
        const chapter = draft.find(c => c.id === action.id);
        if (chapter) {
          Object.assign(chapter, action.updates);
          if (action.updates.content !== undefined) {
            chapter.wordCount = action.updates.content.length;
          }
          chapter.updatedAt = Date.now();
        }
        break;
      }
      case 'SET_CHAPTER_CONTENT': {
        const chapter = draft.find(c => c.id === action.id);
        if (chapter) {
          chapter.content = action.content;
          chapter.wordCount = action.content.length;
          chapter.updatedAt = Date.now();
        }
        break;
      }
      case 'ADD_CHAPTER':
        draft.push(action.payload);
        break;
      case 'REMOVE_CHAPTER': {
        const idx = draft.findIndex(c => c.id === action.id);
        if (idx !== -1) draft.splice(idx, 1);
        break;
      }
      case 'APPLY_SYNC_OP':
      case 'UNDO_BIBLE':
        if (action.payload.nextChapters) {
          return action.payload.nextChapters;
        }
        break;
    }
  });
};

/**
 * Sync Reducer (Immer)
 */
export const syncReducer = (state: SyncState, action: SyncAction): SyncState => {
  return produce(state, draft => {
    switch (action.type) {
      case 'LOAD_SYNC':
        return action.payload;
      case 'SET_CHAT_HISTORY':
        draft.chatHistory = action.payload;
        break;
      case 'CONSOLIDATE_CHAT': {
        const { newMemory, archivedCount } = action.payload;
        const toArchive = draft.chatHistory.slice(0, archivedCount);
        draft.archivedChat = [...(draft.archivedChat || []), ...toArchive];
        draft.chatHistory = draft.chatHistory.slice(archivedCount);
        draft.conversationMemory = newMemory;
        break;
      }
      case 'ADD_PENDING_OPS':
        action.payload.forEach(op => {
          if (!draft.pendingChanges.some(p => p.id === op.id)) {
            draft.pendingChanges.push(op);
          }
        });
        break;
      case 'UPDATE_PENDING_OP': {
        const op = draft.pendingChanges.find(p => p.id === action.id);
        if (op) {
          Object.assign(op, action.updates);
        }
        break;
      }
      case 'REMOVE_PENDING_OP': {
        const idx = draft.pendingChanges.findIndex(p => p.id === action.id);
        if (idx !== -1) draft.pendingChanges.splice(idx, 1);
        break;
      }
      case 'ADD_QUARANTINE_ITEMS':
        if (!draft.quarantine) draft.quarantine = [];
        draft.quarantine.push(...action.payload);
        break;
      case 'REMOVE_QUARANTINE_ITEM': {
        if (draft.quarantine) {
          const idx = draft.quarantine.findIndex(q => q.id === action.id);
          if (idx !== -1) draft.quarantine.splice(idx, 1);
        }
        break;
      }
      case 'ADD_HISTORY_ENTRY':
        draft.history.unshift(action.payload);
        if (draft.history.length > 100) draft.history.length = 100;
        break;
      case 'REMOVE_HISTORY_ENTRY': {
        const idx = draft.history.findIndex(h => h.id === action.id);
        if (idx !== -1) draft.history.splice(idx, 1);
        break;
      }
    }
  });
};

/**
 * UI Reducer (Immer)
 */
export const uiReducer = (state: UIState, action: UIAction): UIState => {
  return produce(state, draft => {
    switch (action.type) {
      case 'SET_VIEW':
        draft.view = action.payload;
        break;
      case 'SET_PLOTTER_TAB':
        draft.plotterTab = action.payload;
        break;
      case 'SET_PENDING_MSG':
        draft.pendingMsg = action.payload;
        break;
      case 'OPEN_DIALOG':
        draft.dialog = { ...action.payload, isOpen: true };
        break;
      case 'CLOSE_DIALOG':
        draft.dialog.isOpen = false;
        break;
      case 'SET_SAFETY_INTERVENTION':
        Object.assign(draft.safetyIntervention, action.payload);
        break;
      case 'SET_PUB_MODAL':
        draft.showPubModal = action.payload;
        break;
      case 'SET_HELP_MODAL':
        draft.showHelpModal = action.payload;
        break;
      case 'SET_SAVE_STATUS':
        draft.saveStatus = action.payload;
        break;
      case 'SET_CONFLICT':
        draft.isConflict = action.payload;
        break;
    }
  });
};

/**
 * Notification Reducer (Immer)
 */
export const notificationReducer = (
  state: { logs: SystemLog[], notifications: AppNotification[] }, 
  action: NotificationAction
) => {
  return produce(state, draft => {
    switch (action.type) {
      case 'ADD_LOG': {
        const log = action.payload;
        draft.logs.unshift(log);
        if (draft.logs.length > 500) draft.logs.length = 500;

        const notifTypeMap: Record<string, AppNotification['type']> = {
          'error': 'error',
          'success': 'success',
          'usage': 'usage',
          'Safety': 'warning'
        };

        const isNotifyTarget = (['error', 'success', 'usage', 'Safety'] as const).some(t => t === log.type || t === log.source);
        
        if (isNotifyTarget) {
          const type = notifTypeMap[log.type as string] || notifTypeMap[log.source as string] || 'info';
          draft.notifications.push({ id: crypto.randomUUID(), type, message: log.message });
          if (draft.notifications.length > 5) draft.notifications.shift();
        }
        break;
      }
      case 'CLEAR_LOGS':
        draft.logs = [];
        break;
      case 'DISMISS_NOTIFICATION': {
        const idx = draft.notifications.findIndex(n => n.id === action.id);
        if (idx !== -1) draft.notifications.splice(idx, 1);
        break;
      }
    }
  });
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
