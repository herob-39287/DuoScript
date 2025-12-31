
export interface Citation {
  sourceType: 'Bible' | 'Manuscript';
  sourceId?: string;
  textSnippet: string;
  label: string;
}

export interface BibleIssue {
  id: string;
  ruleId: string; 
  type: 'Duplicate' | 'Incomplete' | 'Contradiction' | 'Broken' | 'ToneShift';
  targetIds: string[];
  targetType: 'Character' | 'Entry' | 'General' | 'Law' | 'Plot';
  description: string;
  suggestion: string;
  severity: 'Low' | 'Medium' | 'High';
  citations: Citation[];
  feedback?: 'Useful' | 'FalsePositive' | 'Disabled';
}

export interface WorldLaw {
  id: string;
  name: string;
  description: string;
  shortSummary?: string;
  type: 'Physics' | 'Magic' | 'Social' | 'Divine' | 'Taboo';
  importance: 'Absolute' | 'Flexible' | 'Conditional';
}

export interface LinguisticProfile {
  firstPerson: string; 
  secondPerson: string; 
  speechStyle: 'Polite' | 'Casual' | 'Rough' | 'Archaic' | 'Technical' | 'Unique';
  catchphrases: string[];
  forbiddenWords: string[];
  toneSample?: string;
}

export interface Relationship {
  targetId: string; 
  type: 'Ally' | 'Enemy' | 'Romance' | 'Family' | 'Business' | 'Other' | 'Complex';
  description: string;
  strength: number; 
  lastChangedAt?: string; 
}

export interface CharacterProfile {
  name: string;
  aliases: string[];
  role: 'Protagonist' | 'Antagonist' | 'Supporting' | 'Minor';
  description: string; 
  shortSummary?: string;
  appearance: string; 
  personality: string; 
  background: string; 
  voice: LinguisticProfile;
  traits: string[]; 
  motivation: string;
  flaw: string;
  arc: string;
}

export interface CharacterState {
  location: string; 
  internalState: string; 
  currentGoal: string;
  health: string;
  socialStanding: string;
}

export interface CharacterHistoryEvent {
  chapterId?: string;
  timestamp: number;
  diff: string; 
}

export interface Character {
  id: string;
  profile: CharacterProfile;
  state: CharacterState;
  relationships: Relationship[];
  history: CharacterHistoryEvent[];
  imageUrl?: string;
  voiceId?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  isPrivate?: boolean;
}

export interface WorldEntry {
  id: string;
  parentId?: string; 
  category: 'History' | 'Culture' | 'Technology' | 'Magic' | 'Geography' | 'Lore' | 'Terminology';
  title: string;
  aliases: string[];
  content: string; 
  shortSummary?: string;
  definition: string; 
  narrativeSignificance: string; 
  etymology?: string; 
  isSecret: boolean; 
  tags: string[];
  linkedIds: string[]; 
  isPrivate?: boolean; 
}

export interface LocationConnection {
  targetLocationId: string;
  travelTime: string; 
  method: string; 
  dangerLevel: string;
}

export interface Location {
  id: string;
  name: string;
  parentId?: string;
  type: 'Continent' | 'Country' | 'City' | 'Region' | 'Spot' | 'Building';
  description: string;
  shortSummary?: string;
  connections?: LocationConnection[]; 
}

export interface OrganizationRelation {
  targetOrganizationId: string;
  stance: 'Ally' | 'Neutral' | 'Hostile' | 'Subordinate';
  description: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string;
  shortSummary?: string;
  type: 'Guild' | 'Government' | 'Cult' | 'Party' | 'Company';
  memberIds: string[];
  relations?: OrganizationRelation[]; 
}

export interface Theme {
  id: string;
  concept: string; 
  description: string;
  shortSummary?: string;
  motifs: string[]; 
  associatedCharacterIds: string[];
}

export interface KeyItem { 
  id: string;
  name: string;
  type: 'Weapon' | 'Tool' | 'Relic' | 'Evidence';
  description: string;
  shortSummary?: string;
  currentOwnerId: string | null;
  currentLocationId: string | null;
  history: string[]; 
  mechanics?: string; 
}

export interface StoryThread { 
  id: string;
  title: string;
  shortSummary?: string;
  involvedCharacterIds: string[];
  status: 'Open' | 'Resolved';
  beats: { chapterId: string; eventDescription: string }[];
}

export interface Race {
  id: string;
  name: string;
  description: string;
  traits: string[]; 
  lifespan?: string; 
  locations?: string[]; 
}

export interface Bestiary { 
  id: string;
  name: string;
  type: 'Beast' | 'Plant' | 'Monster' | 'Spirit';
  description: string;
  habitat: string; 
  dangerLevel: 'Safe' | 'Caution' | 'Deadly' | 'Catastrophic';
  dropItems?: string[]; 
}

export interface Ability { 
  id: string;
  name: string;
  type: 'Magic' | 'Skill' | 'Tech' | 'Divine';
  description: string;
  cost: string; 
  mechanics: string; 
}

export interface StoryPhase {
  id: string;
  name: string; 
  summary: string;
  goal: string;
}

export interface ForeshadowingLink {
  foreshadowingId: string;
  action: 'Plant' | 'Progress' | 'Payoff' | 'Twist' | 'RedHerring'; 
  note: string;
}

export interface TimelineEvent {
  id: string;
  timeLabel: string;
  event: string;
  description?: string;
  involvedCharacterIds: string[];
  importance: 'Minor' | 'Major' | 'Climax';
  foreshadowingLinks: ForeshadowingLink[];
  status: 'Canon' | 'Plan' | 'Hypothesis'; 
  relatedThreadId?: string; 
}

export interface Foreshadowing {
  id: string;
  title: string;
  description: string;
  shortSummary?: string;
  status: 'Open' | 'Resolved' | 'Stale';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  relatedThreadId?: string; 
  relatedThemeId?: string; 
}

import { NexusBranch } from './sync';

export interface WorldBible {
  version: number;
  setting: string; 
  laws: WorldLaw[];
  grandArc: string; 
  storyStructure: StoryPhase[];
  locations: Location[];
  organizations: Organization[];
  themes: Theme[]; 
  keyItems: KeyItem[]; 
  storyThreads: StoryThread[];
  races: Race[]; 
  bestiary: Bestiary[]; 
  abilities: Ability[]; 
  tone: string;     
  volumes: StoryVolume[];
  characters: Character[]; 
  timeline: TimelineEvent[]; 
  foreshadowing: Foreshadowing[]; 
  entries: WorldEntry[]; 
  nexusBranches: NexusBranch[]; 
  integrityIssues: BibleIssue[];
  summaryBuffer: string; 
  lastSummaryUpdate: number;
}

import { StoryVolume } from './project';
