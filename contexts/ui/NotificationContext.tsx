
import React, { createContext, useContext, useMemo } from 'react';
import { SystemLog, AppNotification, NotificationAction } from '../../types';
import * as Actions from '../../store/actions';

export interface NotificationState { 
  logs: SystemLog[]; 
  notifications: AppNotification[]; 
}

export interface NotificationDispatch { 
  addLog: (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => void; 
  dispatch: React.Dispatch<NotificationAction>; 
}

export const NotificationStateContext = createContext<NotificationState | undefined>(undefined);
export const NotificationDispatchContext = createContext<NotificationDispatch | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationStateContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationStateContext.Provider');
  return context;
};

export const useNotificationDispatch = () => {
  const context = useContext(NotificationDispatchContext);
  if (!context) throw new Error('useNotificationDispatch must be used within a NotificationDispatchContext.Provider');
  
  const { dispatch } = context;
  
  const log = useMemo(() => (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => {
    dispatch(Actions.addLog(Actions.createLog(type, source, message, details)));
  }, [dispatch]);

  return { addLog: log, dispatch };
};
