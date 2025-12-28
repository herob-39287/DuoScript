
import React, { useMemo } from 'react';
import { 
  MetadataStateContext, 
  ManuscriptStateContext,
  BibleStateContext, 
  NeuralSyncStateContext, 
  ProjectDispatchContext,
  UIStateContext, UIDispatchContext,
  NotificationStateContext, NotificationDispatchContext,
  UIState, UIDispatch, NotificationState, NotificationDispatch
} from '../contexts/StoryContext';
import { 
  StoryProjectMetadata, ChapterLog, WorldBible, SyncState,
  ProjectAction
} from '../types';

interface AppProvidersProps {
  children: React.ReactNode;
  state: {
    meta: StoryProjectMetadata;
    bible: WorldBible;
    chapters: ChapterLog[];
    sync: SyncState;
    ui: UIState;
    notification: NotificationState;
  };
  dispatchers: {
    project: React.Dispatch<ProjectAction>;
    ui: UIDispatch;
    notification: NotificationDispatch;
  };
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children, state, dispatchers }) => {
  // Memoize each context value to prevent unnecessary re-renders in specialized components
  const metaValue = useMemo(() => state.meta, [state.meta]);
  const bibleValue = useMemo(() => state.bible, [state.bible]);
  const chaptersValue = useMemo(() => state.chapters, [state.chapters]);
  const syncValue = useMemo(() => state.sync, [state.sync]);
  const uiValue = useMemo(() => state.ui, [state.ui]);
  const notificationValue = useMemo(() => state.notification, [state.notification]);

  return (
    <NotificationStateContext.Provider value={notificationValue}>
      <NotificationDispatchContext.Provider value={dispatchers.notification}>
        <UIStateContext.Provider value={uiValue}>
          <UIDispatchContext.Provider value={dispatchers.ui}>
            <ProjectDispatchContext.Provider value={dispatchers.project}>
              <MetadataStateContext.Provider value={metaValue}>
                <ManuscriptStateContext.Provider value={chaptersValue}>
                  <BibleStateContext.Provider value={bibleValue}>
                    <NeuralSyncStateContext.Provider value={syncValue}>
                      {children}
                    </NeuralSyncStateContext.Provider>
                  </BibleStateContext.Provider>
                </ManuscriptStateContext.Provider>
              </MetadataStateContext.Provider>
            </ProjectDispatchContext.Provider>
          </UIDispatchContext.Provider>
        </UIStateContext.Provider>
      </NotificationDispatchContext.Provider>
    </NotificationStateContext.Provider>
  );
};
