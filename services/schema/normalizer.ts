
import { StoryProject, TransmissionScope, SafetyPreset, StoryProjectMetadata, WorldBible, ChapterLog, SyncState, Theme, AppLanguage, AiPersona } from '../../types';

export const normalizeProject = (data: any): StoryProject => {
  const now = Date.now();
  
  const savedPrefs = localStorage.getItem('duoscript_prefs');
  const defaultPrefs = savedPrefs ? JSON.parse(savedPrefs) : {
    uiLanguage: 'ja' as AppLanguage,
    transmissionScope: TransmissionScope.FULL,
    safetyPreset: SafetyPreset.MATURE,
    aiPersona: AiPersona.STANDARD,
    allowSearch: true,
    whisperSensitivity: 50,
    disabledLinterRules: []
  };

  // Convert old string Laws to Array format if needed
  let normalizedLaws = Array.isArray(data?.bible?.laws) ? data.bible.laws : [];
  if (typeof data?.bible?.laws === 'string' && data.bible.laws.trim().length > 0) {
    normalizedLaws = [{
      id: crypto.randomUUID(),
      name: "基本法則",
      description: data.bible.laws,
      type: "Physics",
      importance: "Absolute"
    }];
  }

  // Normalize Themes
  let normalizedThemes: Theme[] = [];
  if (Array.isArray(data?.bible?.themes)) {
    normalizedThemes = data.bible.themes.map((t: any) => {
      if (typeof t === 'string') {
        return {
          id: crypto.randomUUID(),
          concept: t,
          description: '',
          motifs: [],
          associatedCharacterIds: []
        };
      }
      return {
        ...t,
        id: t.id || crypto.randomUUID(),
        motifs: Array.isArray(t.motifs) ? t.motifs : [],
        associatedCharacterIds: Array.isArray(t.associatedCharacterIds) ? t.associatedCharacterIds : []
      };
    });
  }

  const meta: StoryProjectMetadata = {
    id: data?.id || data?.meta?.id || crypto.randomUUID(),
    title: String(data?.title || data?.meta?.title || '無題の物語'),
    author: String(data?.author || data?.meta?.author || '不明な著者'),
    genre: String(data?.genre || data?.meta?.genre || '一般'),
    createdAt: data?.createdAt || data?.meta?.createdAt || now,
    updatedAt: data?.updatedAt || data?.meta?.updatedAt || now,
    schemaVersion: 4, 
    language: (data?.language || data?.meta?.language || 'ja') as AppLanguage,
    tokenUsage: Array.isArray(data?.tokenUsage) ? data.tokenUsage : 
                Array.isArray(data?.meta?.tokenUsage) ? data.meta.tokenUsage : [],
    violationCount: data?.violationCount || data?.meta?.violationCount || 0,
    violationHistory: data?.violationHistory || data?.meta?.violationHistory || [],
    preferences: { ...defaultPrefs, ...(data?.meta?.preferences || {}) }
  };

  const bible: WorldBible = {
    version: data?.bible?.version || 1,
    setting: String(data?.bible?.setting || data?.setting || ''),
    laws: normalizedLaws.map((l: any) => ({ ...l, id: l.id || crypto.randomUUID() })),
    grandArc: String(data?.bible?.grandArc || data?.grandArc || ''),
    storyStructure: (Array.isArray(data?.bible?.storyStructure) ? data.bible.storyStructure : []).map((s: any) => ({ ...s, id: s.id || crypto.randomUUID() })),
    locations: (Array.isArray(data?.bible?.locations) ? data.bible.locations : []).map((l: any) => ({ 
      ...l, 
      id: l.id || crypto.randomUUID(),
      connections: Array.isArray(l.connections) ? l.connections : [] 
    })),
    organizations: (Array.isArray(data?.bible?.organizations) ? data.bible.organizations : []).map((o: any) => ({ 
      ...o, 
      id: o.id || crypto.randomUUID(),
      relations: Array.isArray(o.relations) ? o.relations : []
    })),
    themes: normalizedThemes,
    keyItems: (Array.isArray(data?.bible?.keyItems) ? data.bible.keyItems : []).map((k: any) => ({
      ...k,
      id: k.id || crypto.randomUUID(),
      history: Array.isArray(k.history) ? k.history : []
    })),
    storyThreads: (Array.isArray(data?.bible?.storyThreads) ? data.bible.storyThreads : []).map((t: any) => ({
      ...t,
      id: t.id || crypto.randomUUID(),
      beats: Array.isArray(t.beats) ? t.beats : []
    })),
    races: (Array.isArray(data?.bible?.races) ? data.bible.races : []).map((r: any) => ({
      ...r,
      id: r.id || crypto.randomUUID(),
      traits: Array.isArray(r.traits) ? r.traits : [],
      locations: Array.isArray(r.locations) ? r.locations : []
    })),
    bestiary: (Array.isArray(data?.bible?.bestiary) ? data.bible.bestiary : []).map((b: any) => ({
      ...b,
      id: b.id || crypto.randomUUID(),
      dropItems: Array.isArray(b.dropItems) ? b.dropItems : []
    })),
    abilities: (Array.isArray(data?.bible?.abilities) ? data.bible.abilities : []).map((a: any) => ({
      ...a,
      id: a.id || crypto.randomUUID()
    })),

    tone: String(data?.bible?.tone || 'ニュートラル'),
    volumes: (Array.isArray(data?.bible?.volumes) ? data.bible.volumes : []).map((v: any) => ({
      ...v,
      id: v.id || crypto.randomUUID()
    })),
    
    characters: (Array.isArray(data?.bible?.characters) ? data.bible.characters : []).map((c: any) => {
      if (c.profile && c.state) {
        return {
          ...c,
          id: c.id || crypto.randomUUID(),
          history: Array.isArray(c.history) ? c.history : []
        };
      } else {
        const linguisticProfile = c.linguisticProfile || { firstPerson: '私', secondPerson: 'あなた', speechStyle: 'Casual', catchphrases: [], forbiddenWords: [] };
        return {
          id: c.id || crypto.randomUUID(),
          profile: {
             name: c.name || "名無しの権兵衛",
             aliases: Array.isArray(c.aliases) ? c.aliases : [],
             role: c.role || 'Supporting',
             description: c.description || '',
             shortSummary: c.shortSummary || c.summary || '',
             appearance: '', 
             personality: c.personality || '',
             background: c.description || '', 
             voice: linguisticProfile,
             traits: Array.isArray(c.traits) ? c.traits : [],
             motivation: c.motivation || '',
             flaw: c.flaw || '',
             arc: c.arc || ''
          },
          state: {
             location: c.status?.location || '不明',
             internalState: c.status?.internalState || '平常',
             currentGoal: c.status?.currentGoal || c.currentGoal || '',
             health: c.status?.health || '良好',
             socialStanding: c.status?.socialStanding || ''
          },
          relationships: Array.isArray(c.relationships) ? c.relationships.map((r: any) => ({
              targetId: r.targetCharacterId || r.targetId,
              type: r.type || 'Other',
              description: r.description || '',
              strength: r.sentiment || 0,
              lastChangedAt: 'Initial'
          })) : [],
          history: [],
          imageUrl: c.imageUrl,
          isPrivate: c.isPrivate || false
        };
      }
    }),

    timeline: (Array.isArray(data?.bible?.timeline) ? data.bible.timeline : []).map((t: any) => ({
      ...t,
      id: t.id || crypto.randomUUID(),
      foreshadowingLinks: Array.isArray(t.foreshadowingLinks) ? t.foreshadowingLinks : [],
      status: t.status || 'Canon', 
      relatedThreadId: t.relatedThreadId
    })),
    foreshadowing: (Array.isArray(data?.bible?.foreshadowing) ? data.bible.foreshadowing : []).map((f: any) => ({
      ...f,
      id: f.id || crypto.randomUUID(),
      relatedThreadId: f.relatedThreadId,
      relatedThemeId: f.relatedThemeId,
      relatedEntityIds: Array.isArray(f.relatedEntityIds) ? f.relatedEntityIds : [],
      clues: Array.isArray(f.clues) ? f.clues : [],
      redHerrings: Array.isArray(f.redHerrings) ? f.redHerrings : []
    })),
    entries: (Array.isArray(data?.bible?.entries) ? data.bible.entries : []).map((e: any) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
      isPrivate: e.isPrivate || false,
      isSecret: e.isSecret ?? false, 
      aliases: Array.isArray(e.aliases) ? e.aliases : [],
      tags: Array.isArray(e.tags) ? e.tags : [],
      linkedIds: Array.isArray(e.linkedIds) ? e.linkedIds : []
    })),
    nexusBranches: (Array.isArray(data?.bible?.nexusBranches) ? data.bible.nexusBranches : []).map((b: any) => ({
      ...b,
      id: b.id || crypto.randomUUID(),
      timestamp: b.timestamp || now
    })),
    integrityIssues: (Array.isArray(data?.bible?.integrityIssues) ? data.bible.integrityIssues : []).map((i: any) => ({
      ...i,
      id: i.id || crypto.randomUUID()
    })),
    summaryBuffer: String(data?.bible?.summaryBuffer || ''),
    lastSummaryUpdate: data?.bible?.lastSummaryUpdate || 0
  };

  const chapters: ChapterLog[] = Array.isArray(data?.chapters) && data.chapters.length > 0 
    ? data.chapters.map((c: any) => ({
        ...c,
        id: c.id || crypto.randomUUID(),
        title: String(c.title || ''),
        summary: String(c.summary || ''),
        content: String(c.content || ''),
        wordCount: typeof c.wordCount === 'number' ? c.wordCount : (c.content?.length || 0),
        draftVersion: c.draftVersion || 0,
        scenes: Array.isArray(c.scenes) ? c.scenes : [],
        strategy: {
          milestones: Array.isArray(c.strategy?.milestones) ? c.strategy.milestones : [],
          forbiddenResolutions: Array.isArray(c.strategy?.forbiddenResolutions) ? c.strategy.forbiddenResolutions : [],
          characterArcProgress: String(c.strategy?.characterArcProgress || ''),
          pacing: String(c.strategy?.pacing || ''),
          povCharacterId: c.strategy?.povCharacterId
        },
        beats: Array.isArray(c.beats) ? c.beats.map((b: any) => ({ ...b, id: b.id || crypto.randomUUID() })) : [],
        status: c.status || 'Idea',
        updatedAt: c.updatedAt || now,
        involvedCharacterIds: Array.isArray(c.involvedCharacterIds) ? c.involvedCharacterIds : [],
        foreshadowingLinks: Array.isArray(c.foreshadowingLinks) ? c.foreshadowingLinks : []
      }))
    : [{ 
        id: crypto.randomUUID(), 
        title: '序章', 
        summary: '', 
        content: '', 
        scenes: [],
        strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }, 
        beats: [], 
        status: 'Idea', 
        wordCount: 0, 
        draftVersion: 0, 
        involvedCharacterIds: [],
        foreshadowingLinks: [],
        updatedAt: now
      }];

  const sync: SyncState = {
    chatHistory: Array.isArray(data?.chatHistory) ? data.chatHistory : 
                 Array.isArray(data?.sync?.chatHistory) ? data.sync.chatHistory : [],
    archivedChat: Array.isArray(data?.sync?.archivedChat) ? data.sync.archivedChat : [],
    conversationMemory: String(data?.sync?.conversationMemory || ''),
    pendingChanges: (Array.isArray(data?.pendingChanges) ? data.pendingChanges : 
                    Array.isArray(data?.sync?.pendingChanges) ? data.sync.pendingChanges : []).map((p: any) => ({
                      ...p,
                      id: p.id || crypto.randomUUID()
                    })),
    quarantine: (Array.isArray(data?.quarantine) ? data.quarantine :
                Array.isArray(data?.sync?.quarantine) ? data.sync.quarantine : []).map((q: any) => ({
                  ...q,
                  id: q.id || crypto.randomUUID()
                })),
    history: (Array.isArray(data?.history) ? data.history : 
             Array.isArray(data?.sync?.history) ? data.sync.history : []).map((h: any) => ({
               ...h,
               id: h.id || crypto.randomUUID()
             }))
  };

  const assets = data?.assets || {};

  return { meta, bible, chapters, sync, assets };
};
