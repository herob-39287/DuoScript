
import { StoryProject, SyncOperation, HistoryEntry, WorldBible, Character, StoryProjectMetadata, SyncState, ChapterLog, CharacterStatus, QuarantineItem, SyncCandidate, TransmissionScope, SafetyPreset } from '../types';

/**
 * 日本語の表記ゆれを吸収するための正規化関数
 */
const normalizeJapanese = (str: string): string => {
  return str
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[ぁ-ん]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60));
};

const calculateSimilarity = (s1: string, s2: string): number => {
  const n1 = s1.length, n2 = s2.length;
  if (n1 === 0 || n2 === 0) return 0;
  
  const dp = Array.from({ length: n1 + 1 }, () => Array(n2 + 1).fill(0));
  for (let i = 0; i <= n1; i++) dp[i][0] = i;
  for (let j = 0; j <= n2; j++) dp[0][j] = j;

  for (let i = 1; i <= n1; i++) {
    for (let j = 1; j <= n2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const dist = dp[n1][n2];
  return 1 - dist / Math.max(n1, n2);
};

export const findMatchCandidates = (
  list: any[], 
  targetId?: string, 
  targetName?: string
): SyncCandidate[] => {
  const results: SyncCandidate[] = [];
  const normTarget = targetName ? normalizeJapanese(targetName) : '';

  list.forEach(item => {
    if (targetId && item.id === targetId) {
      results.push({ id: item.id, name: item.name || item.title || item.event, confidence: 1.0, reason: 'IDマッチ' });
      return;
    }

    if (!normTarget) return;

    const nameFields = ['name', 'title', 'event'];
    for (const f of nameFields) {
      if (item[f] && normalizeJapanese(String(item[f])) === normTarget) {
        results.push({ id: item.id, name: item[f], confidence: 0.98, reason: '名称完全一致' });
        return;
      }
    }

    if (Array.isArray(item.aliases)) {
      if (item.aliases.some((a: string) => normalizeJapanese(String(a)) === normTarget)) {
        results.push({ id: item.id, name: item.name || item.title || item.event, confidence: 0.95, reason: '別名一致' });
        return;
      }
    }

    for (const f of nameFields) {
      if (item[f]) {
        const sim = calculateSimilarity(normalizeJapanese(String(item[f])), normTarget);
        if (sim > 0.7) {
          results.push({ id: item.id, name: item[f], confidence: 0.6 + (sim * 0.2), reason: '類似名称' });
        }
      }
    }
  });

  return results.sort((a, b) => b.confidence - a.confidence);
};

const findItemIdx = (list: any[], targetId?: string, targetName?: string): number => {
  if (targetId) {
    const idx = list.findIndex(i => i.id === targetId);
    if (idx !== -1) return idx;
  }
  
  if (!targetName) return -1;
  const candidates = findMatchCandidates(list, targetId, targetName);
  if (candidates.length > 0 && candidates[0].confidence >= 0.98) {
    return list.findIndex(i => i.id === candidates[0].id);
  }
  
  return -1;
};

export const validateSyncOperation = (op: SyncOperation): string[] => {
  const errors: string[] = [];
  if (!op.path) errors.push("path is required");
  if (!op.op) errors.push("op is required");
  if (op.op !== 'add' && !op.targetName && !op.targetId) errors.push("targetName or targetId is required for updates/deletes");
  if (op.value === undefined) errors.push("value is required");
  return errors;
};

const ensureScalar = (value: any, preferredField?: string): any => {
  if (value === null || value === undefined) return "";
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value;

  if (preferredField && value[preferredField] !== undefined && typeof value[preferredField] !== 'object') {
    return value[preferredField];
  }

  const commonFields = ['text', 'content', 'value', 'description', 'summary', 'name', 'event', 'motivation', 'personality'];
  for (const f of commonFields) {
    if (value[f] !== undefined && typeof value[f] !== 'object') {
      return value[f];
    }
  }

  try {
    const keys = Object.keys(value);
    if (keys.length === 1 && typeof value[keys[0]] !== 'object') return String(value[keys[0]]);
    return JSON.stringify(value);
  } catch (e) {
    return "[Object]";
  }
};

interface SyncContext {
  bible: WorldBible;
  chapters: ChapterLog[];
  history: HistoryEntry[];
}

interface SyncStrategy {
  apply(ctx: SyncContext, op: SyncOperation): {
    nextBible: WorldBible;
    nextChapters: ChapterLog[];
    targetName: string;
    oldValue: any;
    newValue: any;
  };
  revert(ctx: SyncContext, history: HistoryEntry): {
    nextBible: WorldBible;
    nextChapters: ChapterLog[];
  };
}

class ScalarStrategy implements SyncStrategy {
  apply(ctx: SyncContext, op: SyncOperation) {
    const nextBible = { ...ctx.bible };
    const oldVal = (nextBible as any)[op.path];
    const newVal = ensureScalar(op.value, op.field);
    
    (nextBible as any)[op.path] = newVal;
    
    return {
      nextBible,
      nextChapters: ctx.chapters,
      targetName: op.path.toUpperCase(),
      oldValue: oldVal,
      newValue: newVal
    };
  }
  revert(ctx: SyncContext, history: HistoryEntry) {
    const nextBible = { ...ctx.bible };
    (nextBible as any)[history.path] = history.oldValue;
    return { nextBible, nextChapters: ctx.chapters };
  }
}

class CharacterStrategy implements SyncStrategy {
  private statusFields = ['location', 'health', 'inventory', 'knowledge', 'currentGoal', 'socialStanding', 'internalState'];

  apply(ctx: SyncContext, op: SyncOperation) {
    const nextBible = { ...ctx.bible };
    const characters = [...(nextBible.characters || [])];
    let targetName = ensureScalar(op.targetName) || "不明な人物";
    let oldVal: any = null;
    let newVal: any = null;

    const idx = findItemIdx(characters, op.targetId, op.targetName);
    const incomingValue = (typeof op.value === 'object' && op.value !== null) ? op.value : { content: op.value };
    
    const statusUpdates: Partial<CharacterStatus> = {};
    const mainUpdates: any = {};
    
    Object.keys(incomingValue).forEach(key => {
      const scalarVal = ensureScalar(incomingValue[key], key);
      if (this.statusFields.includes(key)) {
        (statusUpdates as any)[key] = scalarVal;
      } else {
        mainUpdates[key] = scalarVal;
      }
    });

    if (idx === -1 && op.op !== 'delete') {
      const newChar: Character = {
        id: crypto.randomUUID(),
        name: ensureScalar(mainUpdates.name || op.targetName) || "名もなき登場人物",
        aliases: Array.isArray(mainUpdates.aliases) ? mainUpdates.aliases : [],
        role: (mainUpdates.role || 'Supporting') as Character['role'],
        description: ensureScalar(mainUpdates.description) || '',
        traits: Array.isArray(mainUpdates.traits) ? mainUpdates.traits : [],
        motivation: ensureScalar(mainUpdates.motivation) || '',
        flaw: ensureScalar(mainUpdates.flaw) || '',
        arc: ensureScalar(mainUpdates.arc) || '',
        relationships: [],
        status: {
          location: ensureScalar(statusUpdates.location) || '不明',
          health: ensureScalar(statusUpdates.health) || '良好',
          inventory: Array.isArray(statusUpdates.inventory) ? statusUpdates.inventory : [],
          knowledge: Array.isArray(statusUpdates.knowledge) ? statusUpdates.knowledge : [],
          currentGoal: ensureScalar(statusUpdates.currentGoal) || '',
          socialStanding: ensureScalar(statusUpdates.socialStanding) || '',
          internalState: ensureScalar(statusUpdates.internalState) || '平常'
        },
        isPrivate: false
      };
      characters.push(newChar);
      targetName = newChar.name;
      newVal = newChar;
    } else if (idx !== -1) {
      const current = { ...characters[idx] };
      targetName = current.name;

      if (op.op === 'delete') {
        oldVal = current;
        characters.splice(idx, 1);
        newVal = "DELETED";
      } else {
        oldVal = { ...current };
        if (op.field) {
          const scalarVal = ensureScalar(op.value, op.field);
          if (this.statusFields.includes(op.field)) {
            current.status = { ...current.status, [op.field]: scalarVal };
          } else {
            (current as any)[op.field] = scalarVal;
          }
        } else {
          if (Array.isArray(mainUpdates.aliases)) {
            const combined = Array.from(new Set([...(current.aliases || []), ...mainUpdates.aliases]));
            mainUpdates.aliases = combined;
          }
          Object.assign(current, mainUpdates);
          current.status = { ...current.status, ...statusUpdates } as CharacterStatus;
        }
        newVal = current;
        characters[idx] = newVal;
      }
    }

    nextBible.characters = characters;
    return { nextBible, nextChapters: ctx.chapters, targetName: String(targetName), oldValue: oldVal, newValue: newVal };
  }

  revert(ctx: SyncContext, history: HistoryEntry) {
    const nextBible = { ...ctx.bible };
    const characters = [...(nextBible.characters || [])];
    
    if (history.opType === 'delete') {
      characters.push(history.oldValue);
    } else if (history.oldValue === null || history.opType === 'add') {
      const idx = characters.findIndex(c => c.name === history.targetName);
      if (idx !== -1) characters.splice(idx, 1);
    } else {
      const idx = characters.findIndex(c => c.name === history.targetName);
      if (idx !== -1) {
        characters[idx] = history.oldValue;
      }
    }
    nextBible.characters = characters;
    return { nextBible, nextChapters: ctx.chapters };
  }
}

class CollectionStrategy implements SyncStrategy {
  apply(ctx: SyncContext, op: SyncOperation) {
    const isBiblePath = op.path !== 'chapters';
    const nextBible = { ...ctx.bible };
    const nextChapters = [...ctx.chapters];
    
    const collection = isBiblePath 
      ? [...((nextBible as any)[op.path] || [])]
      : nextChapters;

    let targetName = ensureScalar(op.targetName) || "対象項目";
    let oldVal: any = null;
    let newVal: any = null;

    const idx = findItemIdx(collection, op.targetId, op.targetName);
    const incomingValue = (typeof op.value === 'object' && op.value !== null) ? op.value : { content: op.value };

    if (idx === -1 && op.op !== 'delete') {
      const newItem: any = { id: crypto.randomUUID(), updatedAt: Date.now() };
      Object.keys(incomingValue).forEach(k => {
        newItem[k] = incomingValue[k];
      });

      if (!newItem.title && !newItem.event && !newItem.name && op.targetName) {
        if (op.path === 'timeline') newItem.event = ensureScalar(op.targetName);
        else newItem.title = ensureScalar(op.targetName);
      }
      collection.push(newItem);
      targetName = newItem.title || newItem.event || newItem.name || targetName;
      newVal = newItem;
    } else if (idx !== -1) {
      const current = { ...collection[idx] };
      targetName = current.title || current.event || current.name || targetName;

      if (op.op === 'delete') {
        oldVal = current;
        collection.splice(idx, 1);
        newVal = "DELETED";
      } else {
        oldVal = { ...current };
        if (op.field) {
          current[op.field] = incomingValue[op.field] !== undefined ? incomingValue[op.field] : incomingValue;
        } else {
          if (Array.isArray(incomingValue.aliases)) {
             incomingValue.aliases = Array.from(new Set([...(current.aliases || []), ...incomingValue.aliases]));
          }
          Object.assign(current, incomingValue);
        }
        current.updatedAt = Date.now();
        newVal = current;
        collection[idx] = newVal;
      }
    }

    if (isBiblePath) {
      (nextBible as any)[op.path] = collection;
      return { nextBible, nextChapters: ctx.chapters, targetName: String(targetName), oldValue: oldVal, newValue: newVal };
    } else {
      return { nextBible, nextChapters: collection, targetName: String(targetName), oldValue: oldVal, newValue: newVal };
    }
  }

  revert(ctx: SyncContext, history: HistoryEntry) {
    const isBiblePath = history.path !== 'chapters';
    const nextBible = { ...ctx.bible };
    const nextChapters = [...ctx.chapters];
    
    const collection = isBiblePath 
      ? [...((nextBible as any)[history.path] || [])]
      : nextChapters;
    
    if (history.opType === 'delete') {
      collection.push(history.oldValue);
    } else if (history.oldValue === null) {
      const idx = collection.findIndex((i: any) => (i.title || i.event || i.name) === history.targetName);
      if (idx !== -1) collection.splice(idx, 1);
    } else {
      const idx = collection.findIndex((i: any) => (i.title || i.event || i.name) === history.targetName);
      if (idx !== -1) {
        collection[idx] = history.oldValue;
      }
    }

    if (isBiblePath) {
      (nextBible as any)[history.path] = collection;
    } else {
      return { nextBible, nextChapters: collection };
    }
    return { nextBible, nextChapters: ctx.chapters };
  }
}

const STRATEGY_MAP: Record<string, SyncStrategy> = {
  setting: new ScalarStrategy(),
  tone: new ScalarStrategy(),
  laws: new ScalarStrategy(),
  grandArc: new ScalarStrategy(),
  characters: new CharacterStrategy(),
  timeline: new CollectionStrategy(),
  foreshadowing: new CollectionStrategy(),
  entries: new CollectionStrategy(),
  nexusBranches: new CollectionStrategy(),
  volumes: new CollectionStrategy(),
  chapters: new CollectionStrategy()
};

export const normalizeProject = (data: any): StoryProject => {
  const now = Date.now();
  
  const savedPrefs = localStorage.getItem('duoscript_prefs');
  const defaultPrefs = savedPrefs ? JSON.parse(savedPrefs) : {
    transmissionScope: TransmissionScope.FULL,
    safetyPreset: SafetyPreset.MATURE,
    allowSearch: true,
    whisperSensitivity: 50,
    disabledLinterRules: []
  };

  const meta: StoryProjectMetadata = {
    id: data?.id || data?.meta?.id || crypto.randomUUID(),
    title: String(data?.title || data?.meta?.title || '無題の物語'),
    author: String(data?.author || data?.meta?.author || '不明な著者'),
    genre: String(data?.genre || data?.meta?.genre || '一般'),
    createdAt: data?.createdAt || data?.meta?.createdAt || now,
    updatedAt: data?.updatedAt || data?.meta?.updatedAt || now,
    schemaVersion: data?.schemaVersion || data?.meta?.schemaVersion || 1,
    language: (data?.language || data?.meta?.language || 'ja') as 'ja',
    tokenUsage: Array.isArray(data?.tokenUsage) ? data.tokenUsage : 
                Array.isArray(data?.meta?.tokenUsage) ? data.meta.tokenUsage : [],
    violationCount: data?.violationCount || data?.meta?.violationCount || 0,
    violationHistory: data?.violationHistory || data?.meta?.violationHistory || [],
    preferences: data?.meta?.preferences || defaultPrefs
  };

  const bible: WorldBible = {
    version: data?.bible?.version || 1,
    setting: String(data?.bible?.setting || data?.setting || ''),
    laws: String(data?.bible?.laws || data?.laws || ''),
    grandArc: String(data?.bible?.grandArc || data?.grandArc || ''),
    themes: Array.isArray(data?.bible?.themes) ? data.bible.themes : [],
    tone: String(data?.bible?.tone || 'ニュートラル'),
    volumes: (Array.isArray(data?.bible?.volumes) ? data.bible.volumes : []).map((v: any) => ({
      ...v,
      id: v.id || crypto.randomUUID()
    })),
    characters: (Array.isArray(data?.bible?.characters) ? data.bible.characters : []).map((c: any) => ({
      ...c,
      id: c.id || crypto.randomUUID(),
      isPrivate: c.isPrivate || false,
      status: {
        location: String(c.status?.location || '不明'),
        health: String(c.status?.health || '良好'),
        inventory: Array.isArray(c.status?.inventory) ? c.status.inventory : [],
        knowledge: Array.isArray(c.status?.knowledge) ? c.status.knowledge : [],
        currentGoal: String(c.status?.currentGoal || ''),
        socialStanding: String(c.status?.socialStanding || ''),
        internalState: String(c.status?.internalState || '平常')
      },
      relationships: Array.isArray(c.relationships) ? c.relationships : []
    })),
    timeline: (Array.isArray(data?.bible?.timeline) ? data.bible.timeline : []).map((t: any) => ({
      ...t,
      id: t.id || crypto.randomUUID(),
      foreshadowingLinks: Array.isArray(t.foreshadowingLinks) ? t.foreshadowingLinks : []
    })),
    foreshadowing: (Array.isArray(data?.bible?.foreshadowing) ? data.bible.foreshadowing : []).map((f: any) => ({
      ...f,
      id: f.id || crypto.randomUUID()
    })),
    entries: (Array.isArray(data?.bible?.entries) ? data.bible.entries : []).map((e: any) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
      isPrivate: e.isPrivate || false,
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
        stateDeltas: [],
        involvedCharacterIds: [],
        foreshadowingLinks: [],
        updatedAt: now
      }];

  const sync: SyncState = {
    chatHistory: Array.isArray(data?.chatHistory) ? data.chatHistory : 
                 Array.isArray(data?.sync?.chatHistory) ? data.sync.chatHistory : [],
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

  return { meta, bible, chapters, sync };
};

export const calculateSyncResult = (
  bible: WorldBible, 
  chapters: ChapterLog[], 
  op: SyncOperation,
  history: HistoryEntry[] = []
): { nextBible: WorldBible; nextChapters: ChapterLog[]; historyEntry: HistoryEntry } => {
  if (history.find(h => h.operationId === op.id || (op.requestId && h.requestId === op.requestId))) {
    throw new Error(`Operation ${op.id} was already committed.`);
  }

  const validationErrors = validateSyncOperation(op);
  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.join(", ")}`);
  }

  const strategy = STRATEGY_MAP[op.path];
  if (!strategy) throw new Error(`No strategy for path: ${op.path}`);

  try {
    const { nextBible, nextChapters, targetName, oldValue, newValue } = strategy.apply({ bible, chapters, history }, op);
    nextBible.version += 1;

    const historyEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      operationId: op.id,
      requestId: op.requestId,
      opType: op.op,
      path: op.path,
      targetName: String(targetName),
      oldValue,
      newValue,
      rationale: String(op.rationale),
      evidence: String(op.evidence || "NeuralSync"),
      versionAtCommit: nextBible.version
    };

    return { nextBible, nextChapters, historyEntry };
  } catch (err: any) {
    throw new Error(`Semantic apply failed: ${err.message}`);
  }
};

export const applySyncBatch = (
  bible: WorldBible,
  chapters: ChapterLog[],
  ops: SyncOperation[],
  history: HistoryEntry[] = []
): { 
  success: boolean;
  nextBible?: WorldBible; 
  nextChapters?: ChapterLog[]; 
  historyEntries?: HistoryEntry[];
  failedOps?: { op: SyncOperation; error: string }[];
} => {
  let currentBible = { ...bible };
  let currentChapters = [...chapters];
  let currentHistory = [...history];
  const historyEntries: HistoryEntry[] = [];
  const failedOps: { op: SyncOperation; error: string }[] = [];

  for (const op of ops) {
    try {
      const { nextBible, nextChapters, historyEntry } = calculateSyncResult(currentBible, currentChapters, op, currentHistory);
      currentBible = nextBible;
      currentChapters = nextChapters;
      historyEntries.push(historyEntry);
      currentHistory.push(historyEntry);
    } catch (err: any) {
      failedOps.push({ op, error: err.message });
      return { success: false, failedOps };
    }
  }

  return { success: true, nextBible: currentBible, nextChapters: currentChapters, historyEntries };
};

export const calculateRevertResult = (bible: WorldBible, chapters: ChapterLog[], history: HistoryEntry): { nextBible: WorldBible; nextChapters: ChapterLog[] } => {
  const strategy = STRATEGY_MAP[history.path];
  if (!strategy) return { nextBible: bible, nextChapters: chapters };

  const { nextBible, nextChapters } = strategy.revert({ bible, chapters, history: [] }, history);
  nextBible.version -= 1;
  return { nextBible, nextChapters };
};

export const getCurrentValueForDiff = (bible: WorldBible, chapters: ChapterLog[], path: string, targetName?: string, field?: string): any => {
  const collection = path === 'chapters' ? chapters : (bible as any)[path];
  if (Array.isArray(collection)) {
    const idx = findItemIdx(collection, undefined, targetName);
    const item = idx !== -1 ? collection[idx] : null;
    if (!item) return null;
    if (field) {
      if (path === 'characters' && ['location', 'health', 'currentGoal', 'internalState', 'socialStanding', 'inventory', 'knowledge'].includes(field)) {
        return item.status?.[field];
      }
      return item[field];
    }
    return item;
  }
  return collection;
};
