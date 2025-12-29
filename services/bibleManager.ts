
import { StoryProject, SyncOperation, HistoryEntry, WorldBible, Character, StoryProjectMetadata, SyncState, ChapterLog, ToneVector } from '../types';

/**
 * Strategy interface for handling different types of synchronization operations.
 */
interface SyncStrategy {
  apply(bible: WorldBible, op: SyncOperation): {
    nextBible: WorldBible;
    targetName: string;
    oldValue: any;
    newValue: any;
  };
  revert(bible: WorldBible, history: HistoryEntry): WorldBible;
}

/**
 * Strategy for scalar fields like 'setting', 'tone', 'laws', and 'grandArc'.
 * Support for 'tone' now updates both string representation and toneVector if provided.
 */
class ScalarStrategy implements SyncStrategy {
  apply(bible: WorldBible, op: SyncOperation) {
    const nextBible = { ...bible };
    const oldVal = (nextBible as any)[op.path];
    const rawValue = op.value;
    
    // Support for complex tone update (string + vector)
    if (op.path === 'tone' && typeof rawValue === 'object' && rawValue !== null) {
      if (rawValue.text) nextBible.tone = rawValue.text;
      if (rawValue.vector) nextBible.toneVector = { ...nextBible.toneVector, ...rawValue.vector };
      
      return {
        nextBible,
        targetName: "TONE",
        oldValue: { text: bible.tone, vector: bible.toneVector },
        newValue: { text: nextBible.tone, vector: nextBible.toneVector }
      };
    }

    const newVal = (typeof rawValue === 'object' && rawValue !== null)
      ? (rawValue.content || rawValue.text || rawValue.value || JSON.stringify(rawValue))
      : rawValue;
    
    (nextBible as any)[op.path] = newVal;
    
    return {
      nextBible,
      targetName: op.path.toUpperCase(),
      oldValue: oldVal,
      newValue: newVal
    };
  }
  revert(bible: WorldBible, history: HistoryEntry) {
    const nextBible = { ...bible };
    if (history.path === 'tone' && typeof history.oldValue === 'object') {
      nextBible.tone = history.oldValue.text;
      nextBible.toneVector = history.oldValue.vector;
    } else {
      (nextBible as any)[history.path] = history.oldValue;
    }
    return nextBible;
  }
}

/**
 * Strategy for the 'characters' collection, supporting nested status updates.
 */
class CharacterStrategy implements SyncStrategy {
  apply(bible: WorldBible, op: SyncOperation) {
    const nextBible = { ...bible };
    const characters = [...(nextBible.characters || [])];
    let targetName = op.targetName || "不明な人物";
    let oldVal: any = null;
    let newVal: any = null;

    let idx = op.targetId ? characters.findIndex(c => c.id === op.targetId) : -1;
    if (idx === -1 && op.targetName) {
      idx = characters.findIndex(c => c.name.toLowerCase().trim() === op.targetName?.toLowerCase().trim());
    }

    if (idx === -1 && op.op !== 'delete') {
      const newChar: Character = {
        id: crypto.randomUUID(),
        name: op.targetName || "名もなき登場人物",
        role: 'Supporting',
        description: '',
        traits: [],
        motivation: '',
        flaw: '',
        arc: '',
        relationships: [],
        status: {
          location: '不明', health: '良好', inventory: [], knowledge: [],
          currentGoal: '', socialStanding: '', internalState: '平常'
        },
        ...op.value
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
        if (op.field) {
          const statusFields = ['location', 'health', 'currentGoal', 'internalState', 'socialStanding', 'inventory', 'knowledge'];
          if (statusFields.includes(op.field)) {
            oldVal = current.status?.[op.field as keyof typeof current.status];
            newVal = op.value && typeof op.value === 'object' && op.value[op.field] !== undefined ? op.value[op.field] : op.value;
            current.status = { ...current.status, [op.field]: newVal };
          } else {
            oldVal = (current as any)[op.field];
            newVal = op.value && typeof op.value === 'object' && op.value[op.field] !== undefined ? op.value[op.field] : op.value;
            (current as any)[op.field] = newVal;
          }
        } else {
          oldVal = { ...current };
          newVal = { ...current, ...op.value };
        }
        characters[idx] = newVal;
      }
    }

    nextBible.characters = characters;
    return { nextBible, targetName, oldValue: oldVal, newValue: newVal };
  }

  revert(bible: WorldBible, history: HistoryEntry) {
    const nextBible = { ...bible };
    const characters = [...(nextBible.characters || [])];
    
    if (history.opType === 'delete') {
      characters.push(history.oldValue);
    } else if (history.oldValue === null || history.opType === 'add') {
      const idx = characters.findIndex(c => c.name === history.targetName);
      if (idx !== -1) characters.splice(idx, 1);
    } else {
      const idx = characters.findIndex(c => c.name === history.targetName);
      if (idx !== -1) {
        if (history.field) {
           const statusFields = ['location', 'health', 'currentGoal', 'internalState', 'socialStanding', 'inventory', 'knowledge'];
           if (statusFields.includes(history.field)) {
             characters[idx].status = { ...characters[idx].status, [history.field]: history.oldValue };
           } else {
             (characters[idx] as any)[history.field] = history.oldValue;
           }
        } else {
           characters[idx] = history.oldValue;
        }
      }
    }
    nextBible.characters = characters;
    return nextBible;
  }
}

/**
 * Strategy for generic collections like 'entries', 'foreshadowing', 'timeline'.
 * Support for extended metadata merge in WorldEntry.
 */
class CollectionStrategy implements SyncStrategy {
  apply(bible: WorldBible, op: SyncOperation) {
    const nextBible = { ...bible };
    const collection = [...((nextBible as any)[op.path] || [])];
    let targetName = op.targetName || "対象項目";
    let oldVal: any = null;
    let newVal: any = null;

    let idx = op.targetId ? collection.findIndex((i: any) => i.id === op.targetId) : -1;
    if (idx === -1 && op.targetName) {
      idx = collection.findIndex((i: any) => {
        const itemName = (i.title || i.event || i.name || "").toLowerCase().trim();
        return itemName === op.targetName?.toLowerCase().trim();
      });
    }

    if (idx === -1 && op.op !== 'delete') {
      const newItem = { id: crypto.randomUUID(), ...op.value };
      
      // Ensure specific structure for WorldEntry
      if (op.path === 'entries') {
        newItem.metadata = newItem.metadata || {};
        newItem.linkedIds = newItem.linkedIds || [];
        newItem.aliases = newItem.aliases || [];
      }
      // Ensure specific structure for Timeline
      if (op.path === 'timeline') {
        newItem.causalLinks = newItem.causalLinks || [];
        newItem.involvedCharacterIds = newItem.involvedCharacterIds || [];
      }
      // Ensure specific structure for Foreshadowing
      if (op.path === 'foreshadowing') {
        newItem.milestones = newItem.milestones || [];
      }

      if (!newItem.title && !newItem.event && !newItem.name && op.targetName) {
        if (op.path === 'timeline') newItem.event = op.targetName;
        else newItem.title = op.targetName;
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
        if (op.field) {
          // Special handle for metadata/causalLinks/milestones
          if (op.field === 'metadata' && typeof op.value === 'object') {
            oldVal = { ...current.metadata };
            current.metadata = { ...current.metadata, ...op.value };
            newVal = { ...current.metadata };
          } else {
            oldVal = current[op.field];
            newVal = op.value && typeof op.value === 'object' && op.value[op.field] !== undefined ? op.value[op.field] : op.value;
            current[op.field] = newVal;
          }
        } else {
          oldVal = { ...current };
          newVal = { ...current, ...op.value };
        }
        collection[idx] = newVal;
      }
    }

    (nextBible as any)[op.path] = collection;
    return { nextBible, targetName, oldValue: oldVal, newValue: newVal };
  }

  revert(bible: WorldBible, history: HistoryEntry) {
    const nextBible = { ...bible };
    const collection = [...((nextBible as any)[history.path] || [])];
    
    if (history.opType === 'delete') {
      collection.push(history.oldValue);
    } else if (history.oldValue === null) {
      const idx = collection.findIndex((i: any) => (i.title || i.event || i.name) === history.targetName);
      if (idx !== -1) collection.splice(idx, 1);
    } else {
      const idx = collection.findIndex((i: any) => (i.title || i.event || i.name) === history.targetName);
      if (idx !== -1) {
        if (history.field) {
           collection[idx][history.field] = history.oldValue;
        } else {
           collection[idx] = history.oldValue;
        }
      }
    }
    (nextBible as any)[history.path] = collection;
    return nextBible;
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
  nexusBranches: new CollectionStrategy()
};

/**
 * Normalizes a StoryProject to ensure all required fields are present and valid.
 */
export const normalizeProject = (data: any): StoryProject => {
  const now = Date.now();
  
  const meta: StoryProjectMetadata = {
    id: data?.id || data?.meta?.id || crypto.randomUUID(),
    title: data?.title || data?.meta?.title || '無題の物語',
    author: data?.author || data?.meta?.author || '不明な著者',
    genre: data?.genre || data?.meta?.genre || '一般',
    createdAt: data?.createdAt || data?.meta?.createdAt || now,
    updatedAt: data?.updatedAt || data?.meta?.updatedAt || now,
    language: data?.language || data?.meta?.language || 'ja',
    tokenUsage: Array.isArray(data?.tokenUsage) ? data.tokenUsage : 
                Array.isArray(data?.meta?.tokenUsage) ? data.meta.tokenUsage : []
  };

  const defaultToneVector: ToneVector = { hope: 0.5, darkness: 0.5, tension: 0.5, logic: 0.8, magic: 0.2 };

  const bible: WorldBible = {
    version: data?.bible?.version || 1,
    setting: data?.bible?.setting || data?.setting || '',
    laws: data?.bible?.laws || data?.laws || '',
    grandArc: data?.bible?.grandArc || data?.grandArc || '',
    themes: Array.isArray(data?.bible?.themes) ? data.bible.themes : [],
    tone: data?.bible?.tone || 'ニュートラル',
    toneVector: data?.bible?.toneVector || defaultToneVector,
    characters: Array.isArray(data?.bible?.characters) ? data.bible.characters : [],
    timeline: Array.isArray(data?.bible?.timeline) ? data.bible.timeline : [],
    foreshadowing: Array.isArray(data?.bible?.foreshadowing) ? data.bible.foreshadowing : [],
    entries: Array.isArray(data?.bible?.entries) ? data.bible.entries : [],
    nexusBranches: Array.isArray(data?.bible?.nexusBranches) ? data.bible.nexusBranches : [],
    integrityIssues: Array.isArray(data?.bible?.integrityIssues) ? data.bible.integrityIssues : [],
    summaryBuffer: data?.bible?.summaryBuffer || '',
    lastSummaryUpdate: data?.bible?.lastSummaryUpdate || 0
  };

  const chapters: ChapterLog[] = Array.isArray(data?.chapters) && data.chapters.length > 0 
    ? data.chapters.map((c: any) => ({ ...c, updatedAt: c.updatedAt || now }))
    : [{ 
        id: crypto.randomUUID(), 
        title: '序章', 
        summary: '', 
        content: '', 
        strategy: { milestones: [], forbiddenResolutions: [], characterArcProgress: '', pacing: '' }, 
        beats: [], 
        status: 'Idea', 
        wordCount: 0, 
        stateDeltas: [],
        updatedAt: now
      }];

  const sync: SyncState = {
    chatHistory: Array.isArray(data?.chatHistory) ? data.chatHistory : 
                 Array.isArray(data?.sync?.chatHistory) ? data.sync.chatHistory : [],
    pendingChanges: Array.isArray(data?.pendingChanges) ? data.pendingChanges : 
                    Array.isArray(data?.sync?.pendingChanges) ? data.sync.pendingChanges : [],
    history: Array.isArray(data?.history) ? data.history : 
             Array.isArray(data?.sync?.history) ? data.sync.history : []
  };

  // Ensure robust normalization for nested objects
  bible.characters = bible.characters.map((c: any) => ({
    ...c,
    status: c.status || { 
      location: '不明', health: '良好', inventory: [], knowledge: [], 
      currentGoal: '', socialStanding: '', internalState: '平常' 
    },
    relationships: c.relationships || []
  }));

  bible.entries = bible.entries.map((e: any) => ({
    ...e,
    metadata: e.metadata || {},
    linkedIds: e.linkedIds || [],
    aliases: e.aliases || []
  }));

  bible.timeline = bible.timeline.map((t: any) => ({
    ...t,
    causalLinks: t.causalLinks || [],
    involvedCharacterIds: t.involvedCharacterIds || []
  }));

  bible.foreshadowing = bible.foreshadowing.map((f: any) => ({
    ...f,
    milestones: f.milestones || []
  }));

  return { meta, bible, chapters, sync };
};

/**
 * Applies a SyncOperation and returns the calculated next state components.
 */
export const calculateSyncResult = (bible: WorldBible, op: SyncOperation): { nextBible: WorldBible; historyEntry: HistoryEntry } => {
  const strategy = STRATEGY_MAP[op.path];
  
  if (!strategy) {
    throw new Error(`No strategy found for path: ${op.path}`);
  }

  const { nextBible, targetName, oldValue, newValue } = strategy.apply(bible, op);
  
  nextBible.version += 1;

  const historyEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    operationId: op.id,
    opType: op.op,
    path: op.path,
    targetName,
    oldValue,
    newValue,
    rationale: op.rationale,
    evidence: op.evidence || "NeuralSync",
    versionAtCommit: nextBible.version
  };

  return { nextBible, historyEntry };
};

/**
 * Reverts a given HistoryEntry.
 */
export const calculateRevertResult = (bible: WorldBible, history: HistoryEntry): WorldBible => {
  const strategy = STRATEGY_MAP[history.path];
  if (!strategy) return bible;

  const nextBible = strategy.revert(bible, history);
  nextBible.version -= 1;
  return nextBible;
};

/**
 * Gets the current value from bible for a specific path/target to show in Diff.
 */
export const getCurrentValueForDiff = (bible: WorldBible, path: string, targetName?: string, field?: string): any => {
  const collection = (bible as any)[path];
  if (Array.isArray(collection)) {
    const item = collection.find((i: any) => (i.title || i.event || i.name || i.id) === targetName);
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
