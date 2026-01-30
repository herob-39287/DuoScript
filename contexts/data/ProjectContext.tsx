import React, { createContext, useContext } from 'react';
import {
  StoryProjectMetadata,
  ChapterLog,
  SyncState,
  ProjectAction,
  MetaAction,
  ChapterAction,
  SyncAction,
} from '../../types';

export const MetadataStateContext = createContext<StoryProjectMetadata | undefined>(undefined);
export const ManuscriptStateContext = createContext<ChapterLog[] | undefined>(undefined);
export const NeuralSyncStateContext = createContext<SyncState | undefined>(undefined);
export const ProjectDispatchContext = createContext<React.Dispatch<ProjectAction> | undefined>(
  undefined,
);

export const useMetadata = () => {
  const context = useContext(MetadataStateContext);
  if (!context) throw new Error('useMetadata must be used within a MetadataStateContext.Provider');
  return context;
};

export const useMetadataDispatch = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context)
    throw new Error('useMetadataDispatch must be used within a ProjectDispatchContext.Provider');
  return context as React.Dispatch<MetaAction>;
};

export const useManuscript = () => {
  const context = useContext(ManuscriptStateContext);
  if (!context)
    throw new Error('useManuscript must be used within a ManuscriptStateContext.Provider');
  return context;
};

export const useManuscriptDispatch = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context)
    throw new Error('useManuscriptDispatch must be used within a ProjectDispatchContext.Provider');
  return context as React.Dispatch<ChapterAction>;
};

export const useNeuralSync = () => {
  const context = useContext(NeuralSyncStateContext);
  if (!context)
    throw new Error('useNeuralSync must be used within a NeuralSyncStateContext.Provider');
  return context;
};

export const useNeuralSyncDispatch = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context)
    throw new Error('useNeuralSyncDispatch must be used within a ProjectDispatchContext.Provider');
  return context as React.Dispatch<SyncAction>;
};

// New generic hook for root dispatch
export const useProjectDispatchContext = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context)
    throw new Error(
      'useProjectDispatchContext must be used within a ProjectDispatchContext.Provider',
    );
  return context;
};
