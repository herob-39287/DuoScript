import { z } from "zod";

// --- Primitives & Helpers ---

export const StringOrNull = z.preprocess(
  (val) => (val === null || val === undefined ? "" : String(val)),
  z.string()
);

export const NumberOrZero = z.preprocess(
  (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  },
  z.number()
);

export const StringArray = z.preprocess(
  (val) => {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string') return [val];
    return [];
  },
  z.array(z.string())
);

// --- Core ID & Time Types ---
export const ID = z.string();
export const Timestamp = z.number();

// --- Enums ---
export const AppLanguageSchema = z.enum(['ja', 'en']);
export const TransmissionScopeSchema = z.enum(['FULL', 'SUMMARY', 'CHAPTER', 'MINIMAL']);
export const SafetyPresetSchema = z.enum(['STRICT', 'MATURE', 'CREATIVE']);
export const AiPersonaSchema = z.enum(['STANDARD', 'STRICT', 'GENTLE', 'CREATIVE']);

// --- Project Metadata & Preferences ---

export const EditorSettingsSchema = z.object({
  fontSize: z.number(),
  lineHeight: z.number(),
  fontFamily: z.enum(['serif', 'sans']),
  paperFilter: z.enum(['none', 'sepia', 'dark']),
  verticalMode: z.boolean()
});

export const AppPreferencesSchema = z.object({
  uiLanguage: AppLanguageSchema,
  transmissionScope: TransmissionScopeSchema,
  safetyPreset: SafetyPresetSchema,
  aiPersona: AiPersonaSchema,
  allowSearch: z.boolean(),
  whisperSensitivity: z.number(),
  disabledLinterRules: z.array(z.string()),
  editorSettings: EditorSettingsSchema
});

export const TokenUsageEntrySchema = z.object({
  id: ID,
  timestamp: Timestamp,
  model: z.string(),
  source: z.string(),
  input: z.number(),
  output: z.number(),
  cached: z.number().optional()
});

export const SafetyViolationSchema = z.object({
  timestamp: Timestamp,
  category: z.string().optional(),
  inputSnippet: z.string().optional()
});

export const StoryProjectMetadataSchema = z.object({
  id: ID,
  title: z.string(),
  author: z.string(),
  genre: z.string(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  schemaVersion: z.number(),
  language: AppLanguageSchema,
  tokenUsage: z.array(TokenUsageEntrySchema),
  violationCount: z.number(),
  violationHistory: z.array(SafetyViolationSchema),
  headRev: z.number().optional(),
  preferences: AppPreferencesSchema
});

export const AssetMetadataSchema = z.object({
  id: ID,
  projectId: ID,
  type: z.enum(['portrait', 'scene', 'other']),
  size: z.number(),
  mimeType: z.string(),
  createdAt: Timestamp,
  lastUsedAt: Timestamp
});

// --- Manuscript & Chapters ---

export const PlotBeatSchema = z.object({
  id: ID,
  text: z.string()
});

export const StorySceneSchema = z.object({
  id: ID,
  title: z.string(),
  locationId: z.string().optional(),
  involvedCharacterIds: z.array(z.string()),
  goal: z.string(),
  summary: z.string(),
  content: z.string(),
  beats: z.array(PlotBeatSchema),
  wordCount: z.number(),
  status: z.enum(['Idea', 'Drafting', 'Polished'])
});

export const ChapterStrategySchema = z.object({
  milestones: z.array(z.string()),
  forbiddenResolutions: z.array(z.string()),
  characterArcProgress: z.string(),
  pacing: z.string(),
  povCharacterId: z.string().optional()
});

export const ForeshadowingLinkSchema = z.object({
  foreshadowingId: z.string(),
  action: z.enum(['Plant', 'Progress', 'Payoff', 'Twist', 'RedHerring']),
  note: z.string()
});

export const ChapterLogSchema = z.object({
  id: ID,
  volumeId: z.string().optional(),
  title: z.string(),
  summary: z.string(),
  content: z.string().optional(),
  scenes: z.array(StorySceneSchema),
  beats: z.array(PlotBeatSchema),
  strategy: ChapterStrategySchema,
  status: z.enum(['Idea', 'Beats', 'Drafting', 'Polished']),
  wordCount: z.number(),
  draftVersion: z.number(),
  involvedCharacterIds: z.array(z.string()),
  foreshadowingLinks: z.array(ForeshadowingLinkSchema).optional(),
  relevantEntityIds: z.array(z.string()).optional(),
  updatedAt: Timestamp
});

// --- Bible Sub-Schemas ---

export const CitationSchema = z.object({
  sourceType: z.enum(['Bible', 'Manuscript']),
  sourceId: z.string().optional(),
  textSnippet: z.string(),
  label: z.string()
});

export const BibleIssueSchema = z.object({
  id: ID,
  ruleId: z.string(),
  type: z.enum(['Duplicate', 'Incomplete', 'Contradiction', 'Broken', 'ToneShift', 'Unknown']),
  targetIds: z.array(z.string()),
  targetType: z.enum(['Character', 'Entry', 'General', 'Law', 'Plot']),
  description: z.string(),
  suggestion: z.string(),
  severity: z.enum(['Low', 'Medium', 'High']),
  citations: z.array(CitationSchema),
  feedback: z.enum(['Useful', 'FalsePositive', 'Disabled']).optional()
});

export const WorldLawSchema = z.object({
  id: ID,
  name: z.string(),
  description: z.string(),
  shortSummary: z.string().optional(),
  type: z.enum(['Physics', 'Magic', 'Social', 'Divine', 'Taboo']),
  importance: z.enum(['Absolute', 'Flexible', 'Conditional'])
});

export const LinguisticProfileSchema = z.object({
  firstPerson: z.string(),
  secondPerson: z.string(),
  speechStyle: z.enum(['Polite', 'Casual', 'Rough', 'Archaic', 'Technical', 'Unique']),
  catchphrases: z.array(z.string()),
  forbiddenWords: z.array(z.string()),
  toneSample: z.string().optional()
});

export const RelationshipSchema = z.object({
  targetId: z.string(),
  type: z.enum(['Ally', 'Enemy', 'Romance', 'Family', 'Business', 'Other', 'Complex']),
  description: z.string(),
  strength: z.number(),
  lastChangedAt: z.string().optional()
});

export const CharacterProfileSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  role: z.enum(['Protagonist', 'Antagonist', 'Supporting', 'Minor']),
  description: z.string(),
  shortSummary: z.string().optional(),
  appearance: z.string(),
  personality: z.string(),
  background: z.string(),
  voice: LinguisticProfileSchema,
  traits: z.array(z.string()),
  motivation: z.string(),
  flaw: z.string(),
  arc: z.string()
});

export const CharacterStateSchema = z.object({
  location: z.string(),
  internalState: z.string(),
  currentGoal: z.string(),
  health: z.string(),
  socialStanding: z.string()
});

export const CharacterHistoryEventSchema = z.object({
  chapterId: z.string().optional(),
  timestamp: Timestamp,
  diff: z.string()
});

export const CharacterSchema = z.object({
  id: ID,
  profile: CharacterProfileSchema,
  state: CharacterStateSchema,
  relationships: z.array(RelationshipSchema),
  history: z.array(CharacterHistoryEventSchema),
  imageUrl: z.string().optional(),
  voiceId: z.enum(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']).optional(),
  isPrivate: z.boolean().optional()
});

export const WorldEntrySchema = z.object({
  id: ID,
  parentId: z.string().optional(),
  category: z.enum(['History', 'Culture', 'Technology', 'Magic', 'Geography', 'Lore', 'Terminology']),
  title: z.string(),
  aliases: z.array(z.string()),
  content: z.string(),
  shortSummary: z.string().optional(),
  definition: z.string(),
  narrativeSignificance: z.string(),
  etymology: z.string().optional(),
  isSecret: z.boolean(),
  tags: z.array(z.string()),
  linkedIds: z.array(z.string()),
  isPrivate: z.boolean().optional()
});

export const LocationConnectionSchema = z.object({
  targetLocationId: z.string(),
  travelTime: z.string(),
  method: z.string(),
  dangerLevel: z.string()
});

export const LocationSchema = z.object({
  id: ID,
  name: z.string(),
  parentId: z.string().optional(),
  type: z.enum(['Continent', 'Country', 'City', 'Region', 'Spot', 'Building']),
  description: z.string(),
  shortSummary: z.string().optional(),
  connections: z.array(LocationConnectionSchema).optional()
});

export const OrganizationRelationSchema = z.object({
  targetOrganizationId: z.string(),
  stance: z.enum(['Ally', 'Neutral', 'Hostile', 'Subordinate']),
  description: z.string()
});

export const OrganizationSchema = z.object({
  id: ID,
  name: z.string(),
  description: z.string(),
  shortSummary: z.string().optional(),
  type: z.enum(['Guild', 'Government', 'Cult', 'Party', 'Company']),
  memberIds: z.array(z.string()),
  relations: z.array(OrganizationRelationSchema).optional()
});

export const ThemeSchema = z.object({
  id: ID,
  concept: z.string(),
  description: z.string(),
  shortSummary: z.string().optional(),
  motifs: z.array(z.string()),
  associatedCharacterIds: z.array(z.string())
});

export const KeyItemSchema = z.object({
  id: ID,
  name: z.string(),
  type: z.enum(['Weapon', 'Tool', 'Relic', 'Evidence']),
  description: z.string(),
  shortSummary: z.string().optional(),
  currentOwnerId: z.string().nullable(),
  currentLocationId: z.string().nullable(),
  history: z.array(z.string()),
  mechanics: z.string().optional()
});

export const StoryThreadSchema = z.object({
  id: ID,
  title: z.string(),
  shortSummary: z.string().optional(),
  involvedCharacterIds: z.array(z.string()),
  status: z.enum(['Open', 'Resolved']),
  beats: z.array(z.object({ chapterId: z.string(), eventDescription: z.string() }))
});

export const RaceSchema = z.object({
  id: ID,
  name: z.string(),
  description: z.string(),
  traits: z.array(z.string()),
  lifespan: z.string().optional(),
  locations: z.array(z.string()).optional()
});

export const BestiarySchema = z.object({
  id: ID,
  name: z.string(),
  type: z.enum(['Beast', 'Plant', 'Monster', 'Spirit']),
  description: z.string(),
  habitat: z.string(),
  dangerLevel: z.enum(['Safe', 'Caution', 'Deadly', 'Catastrophic']),
  dropItems: z.array(z.string()).optional()
});

export const AbilitySchema = z.object({
  id: ID,
  name: z.string(),
  type: z.enum(['Magic', 'Skill', 'Tech', 'Divine']),
  description: z.string(),
  cost: z.string(),
  mechanics: z.string()
});

export const StoryPhaseSchema = z.object({
  id: ID,
  name: z.string(),
  summary: z.string(),
  goal: z.string()
});

export const StoryVolumeSchema = z.object({
  id: ID,
  title: z.string(),
  summary: z.string(),
  order: z.number()
});

export const TimelineEventSchema = z.object({
  id: ID,
  timeLabel: z.string(),
  event: z.string(),
  description: z.string().optional(),
  involvedCharacterIds: z.array(z.string()),
  importance: z.enum(['Minor', 'Major', 'Climax']),
  foreshadowingLinks: z.array(ForeshadowingLinkSchema),
  status: z.enum(['Canon', 'Plan', 'Hypothesis']),
  relatedThreadId: z.string().optional()
});

export const ForeshadowingSchema = z.object({
  id: ID,
  title: z.string(),
  description: z.string(),
  shortSummary: z.string().optional(),
  status: z.enum(['Open', 'Resolved', 'Stale']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  clues: z.array(z.string()),
  redHerrings: z.array(z.string()),
  relatedThreadId: z.string().optional(),
  relatedThemeId: z.string().optional(),
  relatedEntityIds: z.array(z.string())
});

export const NexusBranchSchema = z.object({
  id: ID,
  hypothesis: z.string(),
  impactOnCanon: z.string(),
  impactOnState: z.string(),
  alternateTimeline: z.array(z.string()),
  timestamp: Timestamp,
  color: z.string().optional()
});

export const VectorEntrySchema = z.object({
  id: ID,
  projectId: ID,
  type: z.enum(['character', 'location', 'organization', 'entry', 'item', 'law']),
  name: z.string(),
  textChunk: z.string(),
  embedding: z.array(z.number()),
  updatedAt: Timestamp
});

export const WorldBibleSchema = z.object({
  version: z.number(),
  setting: z.string(),
  laws: z.array(WorldLawSchema),
  grandArc: z.string(),
  storyStructure: z.array(StoryPhaseSchema),
  locations: z.array(LocationSchema),
  organizations: z.array(OrganizationSchema),
  themes: z.array(ThemeSchema),
  keyItems: z.array(KeyItemSchema),
  storyThreads: z.array(StoryThreadSchema),
  races: z.array(RaceSchema),
  bestiary: z.array(BestiarySchema),
  abilities: z.array(AbilitySchema),
  tone: z.string(),
  volumes: z.array(StoryVolumeSchema),
  characters: z.array(CharacterSchema),
  timeline: z.array(TimelineEventSchema),
  foreshadowing: z.array(ForeshadowingSchema),
  entries: z.array(WorldEntrySchema),
  nexusBranches: z.array(NexusBranchSchema),
  integrityIssues: z.array(BibleIssueSchema),
  summaryBuffer: z.string(),
  lastSummaryUpdate: Timestamp
});

// --- Aggregated Project State ---

// Sync State is complex and defined in sync.ts (via SyncOperation schema below) but referenced here as Any for now to avoid circular deps if needed
// However, SyncState is not part of the schema validation usually, it's runtime state.

export const StoryProjectSchema = z.object({
  meta: StoryProjectMetadataSchema,
  bible: WorldBibleSchema,
  chapters: z.array(ChapterLogSchema),
  sync: z.any(), // SyncState defined separately
  assets: z.record(z.string()).optional()
});

// --- Export Types from Schemas ---

export type AppLanguage = z.infer<typeof AppLanguageSchema>;
export type TransmissionScope = z.infer<typeof TransmissionScopeSchema>;
export type SafetyPreset = z.infer<typeof SafetyPresetSchema>;
export type AiPersona = z.infer<typeof AiPersonaSchema>;
export type EditorSettings = z.infer<typeof EditorSettingsSchema>;
export type AppPreferences = z.infer<typeof AppPreferencesSchema>;
export type TokenUsageEntry = z.infer<typeof TokenUsageEntrySchema>;
export type SafetyViolation = z.infer<typeof SafetyViolationSchema>;
export type StoryProjectMetadata = z.infer<typeof StoryProjectMetadataSchema>;
export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;

export type PlotBeat = z.infer<typeof PlotBeatSchema>;
export type StoryScene = z.infer<typeof StorySceneSchema>;
export type ChapterStrategy = z.infer<typeof ChapterStrategySchema>;
export type ForeshadowingLink = z.infer<typeof ForeshadowingLinkSchema>;
export type ChapterLog = z.infer<typeof ChapterLogSchema>;

export type StoryVolume = z.infer<typeof StoryVolumeSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type BibleIssue = z.infer<typeof BibleIssueSchema>;
export type WorldLaw = z.infer<typeof WorldLawSchema>;
export type LinguisticProfile = z.infer<typeof LinguisticProfileSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;
export type CharacterState = z.infer<typeof CharacterStateSchema>;
export type CharacterHistoryEvent = z.infer<typeof CharacterHistoryEventSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type WorldEntry = z.infer<typeof WorldEntrySchema>;
export type LocationConnection = z.infer<typeof LocationConnectionSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type OrganizationRelation = z.infer<typeof OrganizationRelationSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type KeyItem = z.infer<typeof KeyItemSchema>;
export type StoryThread = z.infer<typeof StoryThreadSchema>;
export type Race = z.infer<typeof RaceSchema>;
export type Bestiary = z.infer<typeof BestiarySchema>;
export type Ability = z.infer<typeof AbilitySchema>;
export type StoryPhase = z.infer<typeof StoryPhaseSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type Foreshadowing = z.infer<typeof ForeshadowingSchema>;
export type NexusBranch = z.infer<typeof NexusBranchSchema>;
export type VectorEntry = z.infer<typeof VectorEntrySchema>;
export type WorldBible = z.infer<typeof WorldBibleSchema>;

export type StoryProject = z.infer<typeof StoryProjectSchema> & {
  // SyncState is complex and has recursive structures, better typed manually or via separate schema file
  sync: any; 
};


/**
 * Helper Preprocessors for Sync Operations (Loose input)
 */
const entityPreprocessor = (val: unknown) => {
  if (typeof val === 'string') {
    return { name: val, description: val, title: val, concept: val, event: val };
  }
  return val;
};

// --- Sync Operation Schemas (Loose / Partial) ---

export const CharacterSyncSchema = z.object({
  profile: CharacterProfileSchema.partial().optional(),
  state: CharacterStateSchema.partial().optional(),
  relationships: z.array(RelationshipSchema.partial({ 
    targetId: true, strength: true, description: true 
  }).extend({
    targetCharacterId: StringOrNull.optional(), // AI alias
    targetId: StringOrNull
  })).optional(),
  
  // Flat properties often returned by AI
  name: StringOrNull.optional(),
  role: StringOrNull.optional(),
  description: StringOrNull.optional(),
  summary: StringOrNull.optional(),
  location: StringOrNull.optional(),
  status: StringOrNull.optional(),
});

export const LawSyncSchema = z.preprocess(entityPreprocessor, WorldLawSchema.partial().extend({
  name: StringOrNull,
  description: StringOrNull,
  type: StringOrNull,
  importance: StringOrNull,
}));

export const LocationSyncSchema = z.preprocess(entityPreprocessor, LocationSchema.partial().extend({
  name: StringOrNull,
  type: StringOrNull,
  description: StringOrNull,
  connections: z.array(LocationConnectionSchema.partial().extend({
    targetLocationId: StringOrNull,
    travelTime: StringOrNull,
    method: StringOrNull,
    dangerLevel: StringOrNull
  })).optional()
}));

export const OrganizationSyncSchema = z.preprocess(entityPreprocessor, OrganizationSchema.partial().extend({
  name: StringOrNull,
  type: StringOrNull,
  description: StringOrNull,
  relations: z.array(OrganizationRelationSchema.partial().extend({
    targetOrganizationId: StringOrNull,
    stance: StringOrNull,
    description: StringOrNull
  })).optional()
}));

export const KeyItemSyncSchema = z.preprocess(entityPreprocessor, KeyItemSchema.partial().extend({
  name: StringOrNull,
  type: StringOrNull,
  description: StringOrNull,
  mechanics: StringOrNull,
  currentOwnerId: StringOrNull.optional(),
  currentLocationId: StringOrNull.optional(),
}));

export const EntrySyncSchema = z.preprocess(entityPreprocessor, WorldEntrySchema.partial().extend({
  title: StringOrNull,
  category: StringOrNull,
  definition: StringOrNull,
  description: StringOrNull.optional(), // AI alias
  tags: StringArray,
}));

export const ThemeSyncSchema = z.preprocess(entityPreprocessor, ThemeSchema.partial().extend({
  concept: StringOrNull,
  description: StringOrNull,
  motifs: StringArray,
}));

export const RaceSyncSchema = z.preprocess(entityPreprocessor, RaceSchema.partial().extend({
  name: StringOrNull,
  description: StringOrNull,
  traits: StringArray,
  lifespan: StringOrNull,
}));

export const BestiarySyncSchema = z.preprocess(entityPreprocessor, BestiarySchema.partial().extend({
  name: StringOrNull,
  type: StringOrNull,
  description: StringOrNull,
  habitat: StringOrNull,
  dangerLevel: StringOrNull,
  dropItems: StringArray,
}));

export const AbilitySyncSchema = z.preprocess(entityPreprocessor, AbilitySchema.partial().extend({
  name: StringOrNull,
  type: StringOrNull,
  description: StringOrNull,
  cost: StringOrNull,
  mechanics: StringOrNull,
}));

export const TimelineSyncSchema = z.preprocess(entityPreprocessor, TimelineEventSchema.partial().extend({
  timeLabel: StringOrNull,
  event: StringOrNull,
  description: StringOrNull,
  importance: StringOrNull,
  status: StringOrNull,
  involvedCharacterIds: StringArray,
}));

export const ForeshadowingSyncSchema = z.preprocess(entityPreprocessor, ForeshadowingSchema.partial().extend({
  title: StringOrNull,
  description: StringOrNull,
  status: StringOrNull,
  priority: StringOrNull,
  clues: StringArray,
  redHerrings: StringArray,
  relatedEntityIds: StringArray,
}));

export const StoryThreadSyncSchema = z.preprocess(entityPreprocessor, StoryThreadSchema.partial().extend({
  title: StringOrNull,
  shortSummary: StringOrNull,
  status: StringOrNull,
  beats: z.array(z.object({
    chapterId: StringOrNull,
    eventDescription: StringOrNull
  })).optional()
}));

export const StoryStructureSyncSchema = z.preprocess(entityPreprocessor, StoryPhaseSchema.partial().extend({
  name: StringOrNull,
  goal: StringOrNull,
  summary: StringOrNull,
}));

export const VolumeSyncSchema = z.preprocess(entityPreprocessor, StoryVolumeSchema.partial().extend({
  title: StringOrNull,
  order: NumberOrZero,
  summary: StringOrNull,
}));

export const ChapterSyncSchema = z.preprocess(entityPreprocessor, z.object({
  title: StringOrNull,
  summary: StringOrNull,
  status: StringOrNull,
  beats: z.array(z.object({ text: StringOrNull })).optional(),
}).partial());

export const NexusBranchSyncSchema = NexusBranchSchema.partial().extend({
  hypothesis: StringOrNull,
  impactOnCanon: StringOrNull,
  impactOnState: StringOrNull,
  alternateTimeline: StringArray,
});

/**
 * Valid Sync Paths Enum
 */
export const SyncPathSchema = z.enum([
  'characters', 'laws', 'entries', 'timeline', 'foreshadowing', 'locations',
  'organizations', 'themes', 'keyItems', 'storyThreads', 'chapters',
  'grandArc', 'setting', 'tone', 'volumes', 'races', 'bestiary', 'abilities', 'nexusBranches',
  'storyStructure'
]);

export type SyncPath = z.infer<typeof SyncPathSchema>;

/**
 * Sync Operation Schemas (Extraction & Internal)
 */

// Extraction Schema (AI Output Target)
export const SyncOperationZodSchema = z.object({
  op: z.enum(['add', 'update', 'delete', 'merge', 'rename', 'set', 'addAlias']).default('update'),
  path: SyncPathSchema,
  targetId: z.string().optional(),
  targetName: z.string().optional(),
  field: z.string().optional(),
  value: z.any(), // Validated in Strategies using specific schemas
  rationale: StringOrNull,
  evidence: StringOrNull,
  confidence: z.number().default(0.8),
  isHypothetical: z.boolean().optional()
});

export const SyncOperationArraySchema = z.array(SyncOperationZodSchema);

// Internal Strict Schema (App State)
export const SyncCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  confidence: z.number(),
  reason: z.string()
});

export const SyncStatusSchema = z.enum(['proposal', 'committed', 'rejected', 'quarantined', 'needs_resolution']);
export const SyncOpTypeSchema = z.enum(['add', 'update', 'delete', 'merge', 'rename', 'set', 'addAlias']);

const BaseInternalSyncOpSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  op: SyncOpTypeSchema,
  status: SyncStatusSchema,
  targetId: z.string().optional(),
  targetName: z.string().optional(),
  field: z.string().optional(),
  rationale: StringOrNull,
  evidence: StringOrNull,
  confidence: z.number(),
  isHypothetical: z.boolean().optional(),
  baseVersion: z.number(),
  timestamp: z.number(),
  beatId: z.string().optional(),
  resolutionHint: z.string().optional(),
  candidates: z.array(SyncCandidateSchema).optional()
});

// Discriminated Union for Type Safety
export const InternalSyncOperationSchema = z.discriminatedUnion('path', [
  BaseInternalSyncOpSchema.extend({ path: z.literal('characters'), value: CharacterSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('laws'), value: LawSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('entries'), value: EntrySyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('timeline'), value: TimelineSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('foreshadowing'), value: ForeshadowingSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('locations'), value: LocationSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('organizations'), value: OrganizationSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('themes'), value: ThemeSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('keyItems'), value: KeyItemSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('storyThreads'), value: StoryThreadSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('chapters'), value: ChapterSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('grandArc'), value: z.string() }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('setting'), value: z.string() }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('tone'), value: z.string() }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('volumes'), value: VolumeSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('races'), value: RaceSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('bestiary'), value: BestiarySyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('abilities'), value: AbilitySyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('nexusBranches'), value: NexusBranchSyncSchema }),
  BaseInternalSyncOpSchema.extend({ path: z.literal('storyStructure'), value: StoryStructureSyncSchema }),
]);

export type SyncOperation = z.infer<typeof InternalSyncOperationSchema>;
export type SyncCandidate = z.infer<typeof SyncCandidateSchema>;

/**
 * Detection Schema (Architect/Detector)
 */
export const DetectionZodSchema = z.object({
  hasChangeIntent: z.boolean().default(false),
  isHypothetical: z.boolean().default(false),
  domains: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  instructionSummary: StringOrNull
});

/**
 * Whisper/Advice Schema (Architect/Whisper)
 */
export const WhisperZodSchema = z.object({
  ruleId: StringOrNull,
  text: StringOrNull,
  type: z.string().default('info'),
  citations: z.array(z.object({
    label: StringOrNull,
    textSnippet: StringOrNull
  })).default([])
});

/**
 * Integrity Issue Schema (Analyst/Linter)
 */
export const IntegrityScanZodSchema = z.object({
  issues: z.array(z.object({
    ruleId: StringOrNull,
    type: z.string().default('Unknown'),
    targetType: z.string().optional(),
    description: StringOrNull,
    suggestion: StringOrNull,
    severity: z.string().default('Low'),
    citations: z.array(z.object({
      sourceId: z.string().optional(),
      textSnippet: StringOrNull,
      label: StringOrNull
    })).default([])
  })).default([])
});

/**
 * Nexus Simulation Schema (Analyst/Nexus)
 */
export const NexusSimulationZodSchema = z.object({
  impactOnCanon: StringOrNull,
  impactOnState: StringOrNull,
  alternateTimeline: StringArray
});

/**
 * Chapter Package Schema (Writer)
 */
export const ChapterPackageZodSchema = z.object({
  strategy: z.object({
    milestones: StringArray,
    forbiddenResolutions: StringArray,
    characterArcProgress: StringOrNull,
    pacing: StringOrNull
  }).default({ milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }),
  beats: z.array(z.object({
    text: StringOrNull
  })).default([]),
  draft: StringOrNull
});

/**
 * Brainstorming Schema
 */
export const BrainstormArraySchema = z.array(z.object({
  name: StringOrNull,
  title: StringOrNull,
  concept: StringOrNull,
  event: StringOrNull,
  concept_note: StringOrNull,
}).passthrough());
