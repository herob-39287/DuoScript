import { produce } from 'immer';
import { UIState, UIAction } from '../../types';

export const uiReducer = (state: UIState, action: UIAction): UIState => {
  return produce(state, (draft) => {
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
      case 'SET_FORCE_SAVE_REQUESTED':
        draft.forceSaveRequested = action.payload;
        break;
      case 'TOGGLE_CONTEXT_ACTIVE':
        draft.isContextActive = action.payload;
        break;
      case 'SET_THINKING_PHASE':
        draft.thinkingPhase = action.payload;
        break;
      case 'SET_ONLINE_STATUS':
        draft.isOnline = action.payload;
        break;
    }
  });
};
