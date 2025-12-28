
import React, { createContext, useContext } from 'react';
import { 
  StoryProjectMetadata, ChapterLog, WorldBible, SyncState, SystemLog, AppNotification,
  ProjectAction, MetaAction, BibleAction, ChapterAction, SyncAction, NotificationAction, UIState, UIAction
} from '../types';

export type { 
  StoryProjectMetadata, ChapterLog, WorldBible, SyncState, SystemLog, AppNotification,
  ProjectAction, MetaAction, BibleAction, ChapterAction, SyncAction, NotificationAction, UIState, UIAction
};

// --- Data Contexts ---
export const MetadataStateContext = createContext<StoryProjectMetadata | undefined>(undefined);
export const ManuscriptStateContext = createContext<ChapterLog[] | undefined>(undefined);
export const BibleStateContext = createContext<WorldBible | undefined>(undefined);
export const NeuralSyncStateContext = createContext<SyncState | undefined>(undefined);

// Unified Project Dispatch
export const ProjectDispatchContext = createContext<React.Dispatch<ProjectAction> | undefined>(undefined);

// --- UI Contexts ---
export const UIStateContext = createContext<UIState | undefined>(undefined);
export const UIDispatchContext = createContext<React.Dispatch<UIAction> | undefined>(undefined);

export type UIDispatch = React.Dispatch<UIAction>;

// --- Notification Contexts ---
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

// --- Hooks ---
export const useMetadata = () => {
  const context = useContext(MetadataStateContext);
  if (!context) throw new Error('useMetadata must be used within a MetadataStateContext.Provider');
  return context;
};
export const useMetadataDispatch = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context) throw new Error('useMetadataDispatch must be used within a ProjectDispatchContext.Provider');
  return context as React.Dispatch<MetaAction>;
};
export const useManuscript = () => {
  const context = useContext(ManuscriptStateContext);
  if (!context) throw new Error('useManuscript must be used within a ManuscriptStateContext.Provider');
  return context;
};
export const useManuscriptDispatch = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context) throw new Error('useManuscriptDispatch must be used within a ProjectDispatchContext.Provider');
  return context as React.Dispatch<ChapterAction>;
};
export const useBible = () => {
  const context = useContext(BibleStateContext);
  if (!context) throw new Error('useBible must be used within a BibleStateContext.Provider');
  return context;
};
export const useBibleDispatch = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context) throw new Error('useBibleDispatch must be used within a ProjectDispatchContext.Provider');
  return context as React.Dispatch<BibleAction>;
};
export const useNeuralSync = () => {
  const context = useContext(NeuralSyncStateContext);
  if (!context) throw new Error('useNeuralSync must be used within a NeuralSyncStateContext.Provider');
  return context;
};
export const useNeuralSyncDispatch = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context) throw new Error('useNeuralSyncDispatch must be used within a ProjectDispatchContext.Provider');
  return context as React.Dispatch<SyncAction>;
};
export const useProjectDispatch = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context) throw new Error('useProjectDispatch must be used within a ProjectDispatchContext.Provider');
  return context;
};

export const useUI = () => {
  const context = useContext(UIStateContext);
  if (!context) throw new Error('useUI must be used within a UIStateContext.Provider');
  return context;
};
export const useUIDispatch = () => {
  const context = useContext(UIDispatchContext);
  if (!context) throw new Error('useUIDispatch must be used within a UIDispatchContext.Provider');
  return context;
};
export const useNotifications = () => {
  const context = useContext(NotificationStateContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationStateContext.Provider');
  return context;
};
export const useNotificationDispatch = () => {
  const context = useContext(NotificationDispatchContext);
  if (!context) throw new Error('useNotificationDispatch must be used within a NotificationDispatchContext.Provider');
  return context;
};
