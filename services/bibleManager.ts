
import { WorldBible, ChapterLog, SyncOperation, HistoryEntry } from '../types';
import { STRATEGY_MAP } from './sync/strategies';
import { validateSyncOperation, findItemIdx } from './sync/utils';

// Re-export common functions to maintain API compatibility
export { normalizeProject } from './schema/normalizer';
export { findMatchCandidates, validateSyncOperation } from './sync/utils';

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
      // Handle nested character profile/state fields
      if (path === 'characters') {
         if (['name', 'role', 'description', 'appearance', 'personality', 'background', 'traits', 'motivation', 'flaw', 'arc'].includes(field)) {
             return item.profile?.[field];
         }
         if (['location', 'health', 'currentGoal', 'internalState', 'socialStanding'].includes(field)) {
             return item.state?.[field];
         }
         if (field === 'voice') return item.profile?.voice;
      }
      return item[field];
    }
    return item;
  }
  return collection;
};
