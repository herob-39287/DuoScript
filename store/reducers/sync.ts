
import { produce } from 'immer';
import { SyncState, SyncAction } from '../../types';

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
