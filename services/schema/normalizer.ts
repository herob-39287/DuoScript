import {
  StoryProject,
  TransmissionScope,
  SafetyPreset,
  StoryProjectMetadata,
  WorldBible,
  ChapterLog,
  SyncState,
  Theme,
  AppLanguage,
  AiPersona,
  EditorSettings,
} from '../../types';

export const normalizeProject = (data: any): StoryProject => {
  const now = Date.now();

  const defaultEditorSettings: EditorSettings = {
    fontSize: 16,
    lineHeight: 2.5,
    fontFamily: 'serif',
    paperFilter: 'none',
    verticalMode: false,
  };

  const savedPrefs = localStorage.getItem('duoscript_prefs');
  const defaultPrefs = savedPrefs
    ? JSON.parse(savedPrefs)
    : {
        uiLanguage: 'ja' as AppLanguage,
        transmissionScope: TransmissionScope.FULL,
        safetyPreset: SafetyPreset.MATURE,
        aiPersona: AiPersona.STANDARD,
        allowSearch: true,
        whisperSensitivity: 50,
        disabledLinterRules: [],
        editorSettings: defaultEditorSettings,
      };

  // Safe access helper
  const safeArray = (arr: any) => (Array.isArray(arr) ? arr : []);
  const safeString = (str: any, def: string = '') =>
    typeof str === 'string' || typeof str === 'number' ? String(str) : def;

  // --- PASS 1: Identify & ID Assignment ---

  // Helper to ensure ID exists
  const ensureId = (item: any) => {
    if (!item) return { id: crypto.randomUUID() };
    // Handle legacy string array case if any
    if (typeof item === 'string') return { id: crypto.randomUUID(), concept: item, name: item };
    return { ...item, id: item.id || crypto.randomUUID() };
  };

  // Pre-process collections that can be referenced
  const rawChars = safeArray(data?.bible?.characters).map(ensureId);
  const rawLocs = safeArray(data?.bible?.locations).map(ensureId);
  const rawOrgs = safeArray(data?.bible?.organizations).map(ensureId);
  const rawItems = safeArray(data?.bible?.keyItems).map(ensureId);
  const rawThemes = safeArray(data?.bible?.themes).map((t: any) => {
    if (typeof t === 'string') return { id: crypto.randomUUID(), concept: t };
    return { ...t, id: t.id || crypto.randomUUID() };
  });
  const rawForeshadowing = safeArray(data?.bible?.foreshadowing).map(ensureId);
  const rawThreads = safeArray(data?.bible?.storyThreads).map(ensureId);

  // Build ID/Name Map for Resolution
  const refMap = new Map<string, string>();
  const register = (id: string, ...names: (string | undefined | null)[]) => {
    if (!id) return;
    refMap.set(id, id); // Self reference
    names.forEach((n) => {
      if (n && typeof n === 'string') refMap.set(n.trim(), id);
    });
  };

  rawChars.forEach((c: any) => register(c.id, c.name, c.profile?.name));
  rawLocs.forEach((l: any) => register(l.id, l.name));
  rawOrgs.forEach((o: any) => register(o.id, o.name));
  rawItems.forEach((i: any) => register(i.id, i.name));
  rawThemes.forEach((t: any) => register(t.id, t.concept));
  rawForeshadowing.forEach((f: any) => register(f.id, f.title));
  rawThreads.forEach((t: any) => register(t.id, t.title));

  // Resolver Helper
  const resolve = (ref: any): string => {
    if (!ref || typeof ref !== 'string') return ref;
    return refMap.get(ref.trim()) || ref; // Fallback to original if not found
  };
  const resolveArray = (refs: any[]): string[] => {
    return safeArray(refs)
      .map(resolve)
      .filter((r: any) => typeof r === 'string' && r.length > 0);
  };

  // --- PASS 2: Object Reconstruction with Resolution ---

  // Meta
  const meta: StoryProjectMetadata = {
    id: data?.id || data?.meta?.id || crypto.randomUUID(),
    title: safeString(data?.title || data?.meta?.title, '無題の物語'),
    author: safeString(data?.author || data?.meta?.author, '不明な著者'),
    genre: safeString(data?.genre || data?.meta?.genre, '一般'),
    createdAt: data?.createdAt || data?.meta?.createdAt || now,
    updatedAt: data?.updatedAt || data?.meta?.updatedAt || now,
    schemaVersion: 4,
    language: (data?.language || data?.meta?.language || 'ja') as AppLanguage,
    tokenUsage: safeArray(data?.tokenUsage || data?.meta?.tokenUsage),
    violationCount: data?.violationCount || data?.meta?.violationCount || 0,
    violationHistory: safeArray(data?.violationHistory || data?.meta?.violationHistory),
    headRev: typeof data?.rev === 'number' ? data.rev : data?.headRev || data?.meta?.headRev,
    preferences: {
      ...defaultPrefs,
      ...data?.meta?.preferences,
      editorSettings: {
        ...defaultEditorSettings,
        ...(data?.meta?.preferences?.editorSettings || defaultPrefs.editorSettings || {}),
      },
    },
  };

  // Bible
  let normalizedLaws = safeArray(data?.bible?.laws).map(ensureId);
  if (typeof data?.bible?.laws === 'string' && data.bible.laws.trim().length > 0) {
    normalizedLaws = [
      {
        id: crypto.randomUUID(),
        name: '基本法則',
        description: data.bible.laws,
        type: 'Physics',
        importance: 'Absolute',
      },
    ];
  }

  const bible: WorldBible = {
    version: data?.bible?.version || 1,
    setting: safeString(data?.bible?.setting || data?.setting),
    laws: normalizedLaws,
    grandArc: safeString(data?.bible?.grandArc || data?.grandArc),
    storyStructure: safeArray(data?.bible?.storyStructure).map(ensureId),

    locations: rawLocs.map((l: any) => ({
      ...l,
      connections: safeArray(l.connections).map((c: any) => ({
        ...c,
        targetLocationId: resolve(c.targetLocationId),
      })),
    })),

    organizations: rawOrgs.map((o: any) => ({
      ...o,
      relations: safeArray(o.relations).map((r: any) => ({
        ...r,
        targetOrganizationId: resolve(r.targetOrganizationId),
      })),
    })),

    themes: rawThemes.map((t: any) => ({
      ...t,
      motifs: safeArray(t.motifs),
      associatedCharacterIds: resolveArray(t.associatedCharacterIds),
    })),

    keyItems: rawItems.map((k: any) => ({
      ...k,
      history: safeArray(k.history),
      currentOwnerId: resolve(k.currentOwnerId),
      currentLocationId: resolve(k.currentLocationId),
    })),

    storyThreads: rawThreads.map((t: any) => ({
      ...t,
      beats: safeArray(t.beats),
      involvedCharacterIds: resolveArray(t.involvedCharacterIds),
    })),

    races: safeArray(data?.bible?.races).map((r: any) => ({
      ...r,
      id: r.id || crypto.randomUUID(),
      traits: safeArray(r.traits),
      locations: safeArray(r.locations).map(resolve),
    })),

    bestiary: safeArray(data?.bible?.bestiary).map((b: any) => ({
      ...b,
      id: b.id || crypto.randomUUID(),
      dropItems: safeArray(b.dropItems),
    })),

    abilities: safeArray(data?.bible?.abilities).map((a: any) => ({
      ...a,
      id: a.id || crypto.randomUUID(),
    })),

    tone: safeString(data?.bible?.tone, 'ニュートラル'),
    volumes: safeArray(data?.bible?.volumes).map(ensureId),

    characters: rawChars.map((c: any) => {
      // Preserve original logic for profile/state vs legacy structure
      const base = { ...c };
      if (c.profile && c.state) {
        if (c.relationships) {
          base.relationships = safeArray(c.relationships).map((r: any) => ({
            ...r,
            targetId: resolve(r.targetCharacterId || r.targetId),
          }));
        }
        return {
          ...base,
          history: safeArray(c.history),
        };
      } else {
        // Legacy/Simplified object conversion
        const linguisticProfile = c.linguisticProfile || {
          firstPerson: '私',
          secondPerson: 'あなた',
          speechStyle: 'Casual',
          catchphrases: [],
          forbiddenWords: [],
        };
        return {
          id: c.id, // ID is already ensured
          profile: {
            name: c.name || '名無しの権兵衛',
            aliases: safeArray(c.aliases),
            role: c.role || 'Supporting',
            description: c.description || '',
            shortSummary: c.shortSummary || c.summary || '',
            appearance: '',
            personality: c.personality || '',
            background: c.description || '',
            voice: linguisticProfile,
            traits: safeArray(c.traits),
            motivation: c.motivation || '',
            flaw: c.flaw || '',
            arc: c.arc || '',
          },
          state: {
            location: c.status?.location || '不明',
            internalState: c.status?.internalState || '平常',
            currentGoal: c.status?.currentGoal || c.currentGoal || '',
            health: c.status?.health || '良好',
            socialStanding: c.status?.socialStanding || '',
          },
          relationships: safeArray(c.relationships).map((r: any) => ({
            targetId: resolve(r.targetCharacterId || r.targetId),
            type: r.type || 'Other',
            description: r.description || '',
            strength: r.sentiment || 0,
            lastChangedAt: 'Initial',
          })),
          history: [],
          imageUrl: c.imageUrl,
          isPrivate: c.isPrivate || false,
        };
      }
    }),

    timeline: safeArray(data?.bible?.timeline).map((t: any) => ({
      ...t,
      id: t.id || crypto.randomUUID(),
      foreshadowingLinks: safeArray(t.foreshadowingLinks).map((l: any) => ({
        ...l,
        foreshadowingId: resolve(l.foreshadowingId),
      })),
      status: t.status || 'Canon',
      relatedThreadId: resolve(t.relatedThreadId),
      involvedCharacterIds: resolveArray(t.involvedCharacterIds),
    })),

    foreshadowing: rawForeshadowing.map((f: any) => ({
      ...f,
      relatedThreadId: resolve(f.relatedThreadId),
      relatedThemeId: resolve(f.relatedThemeId),
      relatedEntityIds: resolveArray(f.relatedEntityIds),
      clues: safeArray(f.clues),
      redHerrings: safeArray(f.redHerrings),
      status: f.status || 'Open',
      priority: f.priority || 'Medium',
    })),
    routes: safeArray(data?.bible?.routes),
    revealPlans: safeArray(data?.bible?.revealPlans || data?.bible?.revealPlan),
    stateAxes: safeArray(data?.bible?.stateAxes),
    branchPolicies: safeArray(data?.bible?.branchPolicies),

    entries: safeArray(data?.bible?.entries).map((e: any) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
      isPrivate: e.isPrivate || false,
      isSecret: e.isSecret ?? false,
      aliases: safeArray(e.aliases),
      tags: safeArray(e.tags),
      linkedIds: resolveArray(e.linkedIds),
    })),

    nexusBranches: safeArray(data?.bible?.nexusBranches).map((b: any) => ({
      ...b,
      id: b.id || crypto.randomUUID(),
      timestamp: b.timestamp || now,
    })),
    integrityIssues: safeArray(data?.bible?.integrityIssues).map((i: any) => ({
      ...i,
      id: i.id || crypto.randomUUID(),
    })),
    summaryBuffer: safeString(data?.bible?.summaryBuffer),
    lastSummaryUpdate: data?.bible?.lastSummaryUpdate || 0,
  };

  // Manuscript
  const chapters: ChapterLog[] =
    Array.isArray(data?.chapters) && data.chapters.length > 0
      ? data.chapters.map((c: any) => {
          // P1 migration helper: create minimal Scene Packages from legacy scenes when absent.
          const scenePackages =
            Array.isArray(c.scenePackages) && c.scenePackages.length > 0
              ? c.scenePackages
              : safeArray(c.scenes).map((s: any) => ({
                  sceneId: s.id || crypto.randomUUID(),
                  title: safeString(s.title, '無題シーン'),
                  chapterId: c.id || '',
                  routeId: undefined,
                  locationId: s.locationId,
                  involvedCharacterIds: resolveArray(s.involvedCharacterIds),
                  povCharacterId: undefined,
                  purpose: safeString(s.goal || s.summary || s.title, ''),
                  mandatoryInfo: [],
                  emotionalShift: '',
                  entryConditions: undefined,
                  exitEffects: [],
                  sharedSpine: {
                    intro: '',
                    conflict: '',
                    deepen: '',
                    preChoiceBeat: '',
                    close: safeString(s.summary || ''),
                  },
                  choicePoints: [],
                  reactionVariants: [],
                  convergencePoint: undefined,
                  carryoverStateChanges: [],
                  spoilerLevel: 'Low',
                  status: s.status || 'Idea',
                }));

          return {
            ...c,
            id: c.id || crypto.randomUUID(),
            title: safeString(c.title),
            summary: safeString(c.summary),
            authoringMode: c.authoringMode || 'freeform',
            draftText: c.draftText ?? c.content ?? undefined,
            compiledContent: c.compiledContent ?? c.content ?? undefined,
            freeformSource:
              c.freeformSource && typeof c.freeformSource === 'object'
                ? {
                    structuredOrigin: Boolean(c.freeformSource.structuredOrigin),
                    convertedAt:
                      typeof c.freeformSource.convertedAt === 'number'
                        ? c.freeformSource.convertedAt
                        : now,
                    sourceScenePackageSnapshot: safeArray(
                      c.freeformSource.sourceScenePackageSnapshot,
                    ),
                  }
                : undefined,
            content: c.content || undefined, // Keep undefined if not present to trigger lazy load
            wordCount:
              typeof c.wordCount === 'number'
                ? c.wordCount
                : safeString(c.draftText ?? c.compiledContent ?? c.content).length || 0,
            draftVersion: c.draftVersion || 0,
            scenes: safeArray(c.scenes),
            scenePackages,
            routeNotes: safeArray(c.routeNotes),
            revealNotes: safeArray(c.revealNotes),
            statePolicies: safeArray(c.statePolicies),
            branchPolicies: safeArray(c.branchPolicies),
            validatorIssues: safeArray(c.validatorIssues),
            codexImportedAt: typeof c.codexImportedAt === 'number' ? c.codexImportedAt : undefined,
            strategy: {
              milestones: safeArray(c.strategy?.milestones),
              forbiddenResolutions: safeArray(c.strategy?.forbiddenResolutions),
              characterArcProgress: safeString(c.strategy?.characterArcProgress),
              pacing: safeString(c.strategy?.pacing),
              povCharacterId: resolve(c.strategy?.povCharacterId),
            },
            beats: safeArray(c.beats).map((b: any) => ({ ...b, id: b.id || crypto.randomUUID() })),
            status: c.status || 'Idea',
            updatedAt: c.updatedAt || now,
            involvedCharacterIds: resolveArray(c.involvedCharacterIds),
            foreshadowingLinks: safeArray(c.foreshadowingLinks).map((l: any) => ({
              ...l,
              foreshadowingId: resolve(l.foreshadowingId),
            })),
            relevantEntityIds: resolveArray(c.relevantEntityIds),
          };
        })
      : [
          {
            id: crypto.randomUUID(),
            title: '序章',
            summary: '',
            authoringMode: 'freeform',
            draftText: '',
            compiledContent: '',
            scenes: [],
            strategy: {
              milestones: [],
              forbiddenResolutions: [],
              characterArcProgress: '',
              pacing: '',
            },
            beats: [],
            status: 'Idea',
            wordCount: 0,
            draftVersion: 0,
            involvedCharacterIds: [],
            foreshadowingLinks: [],
            updatedAt: now,
          },
        ];

  const sync: SyncState = {
    chatHistory: safeArray(data?.chatHistory || data?.sync?.chatHistory),
    archivedChat: safeArray(data?.sync?.archivedChat),
    conversationMemory: safeString(data?.sync?.conversationMemory),
    pendingChanges: safeArray(data?.pendingChanges || data?.sync?.pendingChanges).map((p: any) => ({
      ...p,
      id: p.id || crypto.randomUUID(),
      targetId: resolve(p.targetId), // Try to resolve pending op target IDs too
    })),
    quarantine: safeArray(data?.quarantine || data?.sync?.quarantine).map((q: any) => ({
      ...q,
      id: q.id || crypto.randomUUID(),
    })),
    history: safeArray(data?.history || data?.sync?.history).map((h: any) => ({
      ...h,
      id: h.id || crypto.randomUUID(),
      targetId: resolve(h.targetId),
    })),
  };

  return { meta, bible, chapters, sync };
};
