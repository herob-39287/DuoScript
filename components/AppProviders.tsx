
import React, { useMemo } from 'react';
import { 
  MetadataStateContext, 
  ManuscriptStateContext,
  CharactersContext,
  WorldFoundationContext,
  GeographyContext,
  PlotPlanContext,
  KnowledgeContext,
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
  const chaptersValue = useMemo(() => state.chapters, [state.chapters]);
  const syncValue = useMemo(() => state.sync, [state.sync]);
  const uiValue = useMemo(() => state.ui, [state.ui]);
  const notificationValue = useMemo(() => state.notification, [state.notification]);

  // Granular Bible Sub-States (Suggestion 1 implementation)
  const charactersValue = useMemo(() => state.bible.characters, [state.bible.characters]);
  
  const worldFoundationValue = useMemo(() => ({
    setting: state.bible.setting,
    laws: state.bible.laws,
    tone: state.bible.tone,
    summaryBuffer: state.bible.summaryBuffer,
  }), [state.bible.setting, state.bible.laws, state.bible.tone, state.bible.summaryBuffer]);

  const geographyValue = useMemo(() => ({
    locations: state.bible.locations,
    organizations: state.bible.organizations,
  }), [state.bible.locations, state.bible.organizations]);

  const plotPlanValue = useMemo(() => ({
    grandArc: state.bible.grandArc,
    storyStructure: state.bible.storyStructure,
    timeline: state.bible.timeline,
    foreshadowing: state.bible.foreshadowing,
    storyThreads: state.bible.storyThreads,
  }), [state.bible.grandArc, state.bible.storyStructure, state.bible.timeline, state.bible.foreshadowing, state.bible.storyThreads]);

  const knowledgeValue = useMemo(() => ({
    entries: state.bible.entries,
    keyItems: state.bible.keyItems,
    themes: state.bible.themes,
    nexusBranches: state.bible.nexusBranches,
    integrityIssues: state.bible.integrityIssues,
  }), [state.bible.entries, state.bible.keyItems, state.bible.themes, state.bible.nexusBranches, state.bible.integrityIssues]);

  return (
    <NotificationStateContext.Provider value={notificationValue}>
      <NotificationDispatchContext.Provider value={dispatchers.notification}>
        <UIStateContext.Provider value={uiValue}>
          <UIDispatchContext.Provider value={dispatchers.ui}>
            <ProjectDispatchContext.Provider value={dispatchers.project}>
              <MetadataStateContext.Provider value={metaValue}>
                <ManuscriptStateContext.Provider value={chaptersValue}>
                  <CharactersContext.Provider value={charactersValue}>
                    <WorldFoundationContext.Provider value={worldFoundationValue}>
                      <GeographyContext.Provider value={geographyValue}>
                        <PlotPlanContext.Provider value={plotPlanValue}>
                          <KnowledgeContext.Provider value={knowledgeValue}>
                            <NeuralSyncStateContext.Provider value={syncValue}>
                              {children}
                            </NeuralSyncStateContext.Provider>
                          </KnowledgeContext.Provider>
                        </PlotPlanContext.Provider>
                      </GeographyContext.Provider>
                    </WorldFoundationContext.Provider>
                  </CharactersContext.Provider>
                </ManuscriptStateContext.Provider>
              </MetadataStateContext.Provider>
            </ProjectDispatchContext.Provider>
          </UIDispatchContext.Provider>
        </UIStateContext.Provider>
      </NotificationDispatchContext.Provider>
    </NotificationStateContext.Provider>
  );
};
