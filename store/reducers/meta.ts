
import { produce } from 'immer';
import { StoryProjectMetadata, MetaAction } from '../../types';

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

    if (draft.violationCount > 0 && draft.violationHistory && draft.violationHistory.length > 0) {
      const lastViolation = draft.violationHistory[0].timestamp;
      const hoursSinceLast = (Date.now() - lastViolation) / (1000 * 60 * 60);
      if (hoursSinceLast > 12 && draft.violationCount > 0) {
        draft.violationCount = Math.max(0, draft.violationCount - 1);
      }
    }
  });
};
