import { SyncPath } from '../../types';
import { SyncStrategy } from './strategies/types';
import { ScalarStrategy } from './strategies/ScalarStrategy';
import { CharacterStrategy } from './strategies/CharacterStrategy';
import { ForeshadowingStrategy } from './strategies/ForeshadowingStrategy';
import { CollectionStrategy } from './strategies/CollectionStrategy';

// Export Types for external use
export * from './strategies/types';
export * from './strategies/ScalarStrategy';
export * from './strategies/CharacterStrategy';
export * from './strategies/ForeshadowingStrategy';
export * from './strategies/CollectionStrategy';

// Instances
const scalarStrategy = new ScalarStrategy();
const characterStrategy = new CharacterStrategy();
const foreshadowingStrategy = new ForeshadowingStrategy();
const collectionStrategy = new CollectionStrategy();

export const STRATEGY_MAP: Record<SyncPath, SyncStrategy> = {
  setting: scalarStrategy,
  tone: scalarStrategy,
  grandArc: scalarStrategy,
  laws: collectionStrategy,
  storyStructure: collectionStrategy,
  locations: collectionStrategy,
  organizations: collectionStrategy,
  themes: collectionStrategy,
  keyItems: collectionStrategy,
  storyThreads: collectionStrategy,
  races: collectionStrategy,
  bestiary: collectionStrategy,
  abilities: collectionStrategy,
  characters: characterStrategy,
  timeline: collectionStrategy,
  foreshadowing: foreshadowingStrategy,
  entries: collectionStrategy,
  volumes: collectionStrategy,
  chapters: collectionStrategy,
  nexusBranches: collectionStrategy,
};

export const getStrategy = (path: SyncPath): SyncStrategy => {
  const strategy = STRATEGY_MAP[path];
  if (!strategy) {
    throw new Error(`No strategy defined for path: ${path}`);
  }
  return strategy;
};
