
import React, { createContext, useContext, useMemo } from 'react';
import { 
  StoryProjectMetadata, ChapterLog, WorldBible, SyncState, SystemLog, AppNotification,
  ProjectAction, MetaAction, BibleAction, ChapterAction, SyncAction, NotificationAction, UIState, UIAction,
  Character, WorldLaw, Location, Organization, Theme, KeyItem, StoryThread, StoryPhase,
  TimelineEvent, Foreshadowing, WorldEntry, NexusBranch, BibleIssue
} from '../types';
import * as Actions from '../store/actions';

export type { UIState };

// --- Data Contexts ---
export const MetadataStateContext = createContext<StoryProjectMetadata | undefined>(undefined);
export const ManuscriptStateContext = createContext<ChapterLog[] | undefined>(undefined);
export const NeuralSyncStateContext = createContext<SyncState | undefined>(undefined);

// Bible Sub-Contexts (Implementation of Suggestion 1: Granular State)
export const CharactersContext = createContext<Character[] | undefined>(undefined);
export const WorldFoundationContext = createContext<{
  setting: string;
  laws: WorldLaw[];
  tone: string;
  summaryBuffer: string;
} | undefined>(undefined);

export const GeographyContext = createContext<{
  locations: Location[];
  organizations: Organization[];
} | undefined>(undefined);

export const PlotPlanContext = createContext<{
  grandArc: string;
  storyStructure: StoryPhase[];
  timeline: TimelineEvent[];
  foreshadowing: Foreshadowing[];
  storyThreads: StoryThread[];
} | undefined>(undefined);

export const KnowledgeContext = createContext<{
  entries: WorldEntry[];
  keyItems: KeyItem[];
  themes: Theme[];
  nexusBranches: NexusBranch[];
  integrityIssues: BibleIssue[];
} | undefined>(undefined);

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

// Granular Bible Hooks
export const useCharacters = () => {
  const context = useContext(CharactersContext);
  if (!context) throw new Error('useCharacters must be used within a CharactersContext.Provider');
  return context;
};

export const useWorldFoundation = () => {
  const context = useContext(WorldFoundationContext);
  if (!context) throw new Error('useWorldFoundation must be used within a WorldFoundationContext.Provider');
  return context;
};

export const useGeography = () => {
  const context = useContext(GeographyContext);
  if (!context) throw new Error('useGeography must be used within a GeographyContext.Provider');
  return context;
};

export const usePlotPlan = () => {
  const context = useContext(PlotPlanContext);
  if (!context) throw new Error('usePlotPlan must be used within a PlotPlanContext.Provider');
  return context;
};

export const useKnowledge = () => {
  const context = useContext(KnowledgeContext);
  if (!context) throw new Error('useKnowledge must be used within a KnowledgeContext.Provider');
  return context;
};

// Legacy Bible Hook for backward compatibility where needed
export const useBible = () => {
  const chars = useCharacters();
  const found = useWorldFoundation();
  const geo = useGeography();
  const plot = usePlotPlan();
  const knw = useKnowledge();
  
  return useMemo(() => ({
    version: 0, // version can be added to foundation if needed for triggering saves
    characters: chars,
    ...found,
    ...geo,
    ...plot,
    ...knw
  } as WorldBible), [chars, found, geo, plot, knw]);
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
  
  const { dispatch } = context;
  
  const log = useMemo(() => (type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => {
    dispatch(Actions.addLog(Actions.createLog(type, source, message, details)));
  }, [dispatch]);

  return { addLog: log, dispatch };
};
