
import { produce } from 'immer';
import { WorldBible, BibleAction } from '../../types';

export const bibleReducer = (state: WorldBible, action: BibleAction): WorldBible => {
  return produce(state, draft => {
    switch (action.type) {
      case 'LOAD_BIBLE':
        return action.payload;
      case 'UPDATE_BIBLE':
        Object.assign(draft, action.payload);
        break;
      
      case 'UPDATE_CHARACTER_DATA': {
        const char = draft.characters.find(c => c.id === action.id);
        if (char) {
          // Merge updates deeply if needed, or spread top-level
          // Assumes updates contains keys like profile, state, relationships
          if (action.updates.profile) Object.assign(char.profile, action.updates.profile);
          if (action.updates.state) Object.assign(char.state, action.updates.state);
          if (action.updates.relationships) char.relationships = action.updates.relationships;
          if (action.updates.imageUrl) char.imageUrl = action.updates.imageUrl;
          
          char.history.push({
            timestamp: Date.now(),
            diff: 'Manual Edit'
          });
        }
        break;
      }

      case 'MANIPULATE_BIBLE_LIST': {
        const list = (draft as any)[action.path];
        if (!Array.isArray(list)) break;

        if (action.op === 'add' && action.item) {
          list.push(action.item);
        } else if (action.op === 'update' && action.id && action.updates) {
          const idx = list.findIndex((i: any) => i.id === action.id);
          if (idx !== -1) {
            Object.assign(list[idx], action.updates);
          }
        } else if (action.op === 'delete' && action.id) {
          const idx = list.findIndex((i: any) => i.id === action.id);
          if (idx !== -1) {
            list.splice(idx, 1);
          }
        }
        break;
      }

      case 'APPLY_SYNC_OP':
      case 'UNDO_BIBLE':
        return action.payload.nextBible;
    }
  });
};
