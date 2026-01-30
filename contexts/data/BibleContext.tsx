import React, { createContext, useContext } from 'react';
import {
  WorldBible,
  BibleAction,
  Character,
  WorldLaw,
  Location,
  Organization,
  Theme,
  KeyItem,
  StoryThread,
  StoryPhase,
  TimelineEvent,
  Foreshadowing,
  WorldEntry,
  NexusBranch,
  BibleIssue,
  StoryVolume,
  Race,
  Bestiary,
  Ability,
  CharacterProfile,
  CharacterState,
} from '../../types';
import { ProjectDispatchContext } from './ProjectContext';

export const BibleStateContext = createContext<WorldBible | undefined>(undefined);

// Granular Contexts
export const CharactersContext = createContext<Character[] | undefined>(undefined);

// Split Character Contexts for Performance
export const CharacterProfilesContext = createContext<
  (CharacterProfile & { id: string; imageUrl?: string; isPrivate?: boolean })[] | undefined
>(undefined);
export const CharacterStatesContext = createContext<
  (CharacterState & { id: string })[] | undefined
>(undefined);

export const WorldFoundationContext = createContext<
  | {
      version: number;
      setting: string;
      laws: WorldLaw[];
      grandArc: string;
      tone: string;
      summaryBuffer: string;
      lastSummaryUpdate: number;
    }
  | undefined
>(undefined);

export const GeographyContext = createContext<
  | {
      locations: Location[];
      organizations: Organization[];
    }
  | undefined
>(undefined);

export const PlotPlanContext = createContext<
  | {
      storyStructure: StoryPhase[];
      timeline: TimelineEvent[];
      foreshadowing: Foreshadowing[];
      storyThreads: StoryThread[];
      volumes: StoryVolume[];
    }
  | undefined
>(undefined);

export const KnowledgeContext = createContext<
  | {
      entries: WorldEntry[];
      keyItems: KeyItem[];
      themes: Theme[];
      nexusBranches: NexusBranch[];
      integrityIssues: BibleIssue[];
      races: Race[];
      bestiary: Bestiary[];
      abilities: Ability[];
    }
  | undefined
>(undefined);

// Hooks
export const useBible = () => {
  const context = useContext(BibleStateContext);
  if (!context) throw new Error('useBible must be used within a BibleStateContext.Provider');
  return context;
};

export const useBibleDispatch = () => {
  const context = useContext(ProjectDispatchContext);
  if (!context)
    throw new Error('useBibleDispatch must be used within a ProjectDispatchContext.Provider');
  return context as React.Dispatch<BibleAction>;
};

export const useCharacters = () => {
  const context = useContext(CharactersContext);
  if (!context) throw new Error('useCharacters must be used within a CharactersContext.Provider');
  return context;
};

export const useCharacterProfiles = () => {
  const context = useContext(CharacterProfilesContext);
  if (!context)
    throw new Error('useCharacterProfiles must be used within a CharacterProfilesContext.Provider');
  return context;
};

export const useCharacterStates = () => {
  const context = useContext(CharacterStatesContext);
  if (!context)
    throw new Error('useCharacterStates must be used within a CharacterStatesContext.Provider');
  return context;
};

export const useWorldFoundation = () => {
  const context = useContext(WorldFoundationContext);
  if (!context)
    throw new Error('useWorldFoundation must be used within a WorldFoundationContext.Provider');
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
