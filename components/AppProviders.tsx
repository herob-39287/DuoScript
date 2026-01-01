import React, { useMemo } from 'react';
import { 
  MetadataStateContext, 
  ManuscriptStateContext,
  BibleStateContext,
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
  const bibleValue = useMemo(() => state.bible, [state.bible]);
  const chaptersValue = useMemo(() => state.chapters, [state.chapters]);
  const syncValue = useMemo(() => state.sync, [state.sync]);
  const uiValue = useMemo(() => state.ui, [state.ui]);
  const notificationValue = useMemo(() => state.notification, [state.notification]);

  // Granular Bible Sub-States (Suggestion 1 implementation)
  const charactersValue = useMemo(() => state.bible.characters, [state.bible.characters]);
  
  const worldFoundationValue = useMemo(() => ({
    version: state.bible.version,
    setting: state.bible.setting,
    laws: state.bible.laws,
    grandArc: state.bible.grandArc,
    tone: state.bible.tone,
    summaryBuffer: state.bible.summaryBuffer,
    lastSummaryUpdate: state.bible.lastSummaryUpdate,
  }), [state.bible.version, state.bible.setting, state.bible.laws, state.bible.grandArc, state.bible.tone, state.bible.summaryBuffer, state.bible.lastSummaryUpdate]);

  const geographyValue = useMemo(() => ({
    locations: state.bible.locations,
    organizations: state.bible.organizations,
  }), [state.bible.locations, state.bible.organizations]);

  const plotPlanValue = useMemo(() => ({
    storyStructure: state.bible.storyStructure,
    timeline: state.bible.timeline,
    foreshadowing: state.bible.foreshadowing,
    storyThreads: state.bible.storyThreads,
    volumes: state.bible.volumes,
  }), [state.bible.storyStructure, state.bible.timeline, state.bible.foreshadowing, state.bible.storyThreads, state.bible.volumes]);

  const knowledgeValue = useMemo(() => ({
    entries: state.bible.entries,
    keyItems: state.bible.keyItems,
    themes: state.bible.themes,
    nexusBranches: state.bible.nexusBranches,
    integrityIssues: state.bible.integrityIssues,
    races: state.bible.races,
    bestiary: state.bible.bestiary,
    abilities: state.bible.abilities,
  }), [state.bible.entries, state.bible.keyItems, state.bible.themes, state.bible.nexusBranches, state.bible.integrityIssues, state.bible.races, state.bible.bestiary, state.bible.abilities]);

  return (
    <NotificationStateContext.Provider value={notificationValue}>
      <NotificationDispatchContext.Provider value={dispatchers.notification}>
        <UIStateContext.Provider value={uiValue}>
          <UIDispatchContext.Provider value={dispatchers.ui}>
            <ProjectDispatchContext.Provider value={dispatchers.project}>
              <MetadataStateContext.Provider value={metaValue}>
                <ManuscriptStateContext.Provider value={chaptersValue}>
                  <BibleStateContext.Provider value={bibleValue}>
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