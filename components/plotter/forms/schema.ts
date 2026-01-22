
import { FieldDefinition, MODEL_DEFINITIONS } from '../../../services/schema/definitions';

export type ItemType = 
  | 'law' | 'location' | 'organization' | 'item' | 'entry' | 'theme'
  | 'race' | 'bestiary' | 'ability' 
  | 'timeline' | 'foreshadowing' | 'thread' | 'structure' | 'volume' | 'chapter';

export type FieldSchema = FieldDefinition;

export const ITEM_LABELS: Record<ItemType, string> = {
  law: 'World Law',
  location: 'Location',
  organization: 'Organization',
  item: 'Key Item',
  entry: 'Entry',
  theme: 'Theme',
  race: 'Race',
  bestiary: 'Bestiary',
  ability: 'Ability',
  timeline: 'Timeline Event',
  foreshadowing: 'Foreshadowing',
  thread: 'Story Thread',
  structure: 'Phase',
  volume: 'Volume',
  chapter: 'Chapter'
};

// Re-export schemas from the centralized definition
export const SCHEMAS: Record<ItemType, FieldSchema[]> = {
  law: MODEL_DEFINITIONS.law,
  location: MODEL_DEFINITIONS.location,
  organization: MODEL_DEFINITIONS.organization,
  item: MODEL_DEFINITIONS.item,
  entry: MODEL_DEFINITIONS.entry,
  theme: MODEL_DEFINITIONS.theme,
  race: MODEL_DEFINITIONS.race,
  bestiary: MODEL_DEFINITIONS.bestiary,
  ability: MODEL_DEFINITIONS.ability,
  timeline: MODEL_DEFINITIONS.timeline,
  foreshadowing: MODEL_DEFINITIONS.foreshadowing,
  thread: MODEL_DEFINITIONS.thread,
  structure: MODEL_DEFINITIONS.structure,
  volume: MODEL_DEFINITIONS.volume,
  chapter: MODEL_DEFINITIONS.chapter
};
