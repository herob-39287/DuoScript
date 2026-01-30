import React, { useMemo, useRef } from 'react';
import {
  MetadataStateContext,
  ManuscriptStateContext,
  BibleStateContext,
  CharactersContext,
  CharacterProfilesContext,
  CharacterStatesContext,
  WorldFoundationContext,
  GeographyContext,
  PlotPlanContext,
  KnowledgeContext,
  NeuralSyncStateContext,
  ProjectDispatchContext,
  UIStateContext,
  UIDispatchContext,
  NotificationStateContext,
  NotificationDispatchContext,
  UIDispatch,
  NotificationState,
  NotificationDispatch,
} from '../contexts/StoryContext';
import {
  StoryProjectMetadata,
  ChapterLog,
  WorldBible,
  SyncState,
  ProjectAction,
  UIState,
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

  // Granular Bible Sub-States (Optimization)
  // Replaced JSON.stringify deep comparison with reference checks using refs to improve performance with large datasets.

  // 1. Characters (Full)
  const charactersValue = useMemo(() => state.bible.characters, [state.bible.characters]);

  // Refs for Profile optimization
  const prevProfilesSourceRef = useRef<any[]>([]);
  const profilesCacheRef = useRef<any[]>([]);

  // 2. Character Profiles (Static - changes rarely)
  const characterProfilesValue = useMemo(() => {
    const source = state.bible.characters;
    const prevSource = prevProfilesSourceRef.current;
    const prevResult = profilesCacheRef.current;

    let hasChanged = false;

    // Check length change
    if (source.length !== prevSource.length) {
      hasChanged = true;
    } else {
      // Check individual items for profile-related changes
      for (let i = 0; i < source.length; i++) {
        // Immer ensures references change only if data changes.
        // We compare relevant sub-objects.
        if (
          source[i].profile !== prevSource[i].profile ||
          source[i].imageUrl !== prevSource[i].imageUrl ||
          source[i].isPrivate !== prevSource[i].isPrivate ||
          source[i].id !== prevSource[i].id
        ) {
          hasChanged = true;
          break;
        }
      }
    }

    if (!hasChanged && prevResult.length > 0) {
      return prevResult;
    }

    // Generate new derived array
    const newResult = source.map((c) => ({
      id: c.id,
      ...c.profile,
      imageUrl: c.imageUrl,
      isPrivate: c.isPrivate,
    }));

    // Update cache
    prevProfilesSourceRef.current = source;
    profilesCacheRef.current = newResult;
    return newResult;
  }, [state.bible.characters]);

  // Refs for State optimization
  const prevStatesSourceRef = useRef<any[]>([]);
  const statesCacheRef = useRef<any[]>([]);

  // 3. Character States (Volatile - changes often)
  const characterStatesValue = useMemo(() => {
    const source = state.bible.characters;
    const prevSource = prevStatesSourceRef.current;
    const prevResult = statesCacheRef.current;

    let hasChanged = false;

    if (source.length !== prevSource.length) {
      hasChanged = true;
    } else {
      for (let i = 0; i < source.length; i++) {
        if (source[i].state !== prevSource[i].state || source[i].id !== prevSource[i].id) {
          hasChanged = true;
          break;
        }
      }
    }

    if (!hasChanged && prevResult.length > 0) {
      return prevResult;
    }

    const newResult = source.map((c) => ({
      id: c.id,
      ...c.state,
    }));

    prevStatesSourceRef.current = source;
    statesCacheRef.current = newResult;
    return newResult;
  }, [state.bible.characters]);

  // 4. World Foundation
  const worldFoundationValue = useMemo(
    () => ({
      version: state.bible.version,
      setting: state.bible.setting,
      laws: state.bible.laws,
      grandArc: state.bible.grandArc,
      tone: state.bible.tone,
      summaryBuffer: state.bible.summaryBuffer,
      lastSummaryUpdate: state.bible.lastSummaryUpdate,
    }),
    [
      state.bible.version,
      state.bible.setting,
      state.bible.laws,
      state.bible.grandArc,
      state.bible.tone,
      state.bible.summaryBuffer,
      state.bible.lastSummaryUpdate,
    ],
  );

  // 5. Geography
  const geographyValue = useMemo(
    () => ({
      locations: state.bible.locations,
      organizations: state.bible.organizations,
    }),
    [state.bible.locations, state.bible.organizations],
  );

  // 6. Plot Plan
  const plotPlanValue = useMemo(
    () => ({
      storyStructure: state.bible.storyStructure,
      timeline: state.bible.timeline,
      foreshadowing: state.bible.foreshadowing,
      storyThreads: state.bible.storyThreads,
      volumes: state.bible.volumes,
    }),
    [
      state.bible.storyStructure,
      state.bible.timeline,
      state.bible.foreshadowing,
      state.bible.storyThreads,
      state.bible.volumes,
    ],
  );

  // 7. Knowledge Base
  const knowledgeValue = useMemo(
    () => ({
      entries: state.bible.entries,
      keyItems: state.bible.keyItems,
      themes: state.bible.themes,
      nexusBranches: state.bible.nexusBranches,
      integrityIssues: state.bible.integrityIssues,
      races: state.bible.races,
      bestiary: state.bible.bestiary,
      abilities: state.bible.abilities,
    }),
    [
      state.bible.entries,
      state.bible.keyItems,
      state.bible.themes,
      state.bible.nexusBranches,
      state.bible.integrityIssues,
      state.bible.races,
      state.bible.bestiary,
      state.bible.abilities,
    ],
  );

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
                      <CharacterProfilesContext.Provider value={characterProfilesValue}>
                        <CharacterStatesContext.Provider value={characterStatesValue}>
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
                        </CharacterStatesContext.Provider>
                      </CharacterProfilesContext.Provider>
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
