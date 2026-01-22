
import { produce } from 'immer';
import { NotificationAction, SystemLog, AppNotification } from '../../types';

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
