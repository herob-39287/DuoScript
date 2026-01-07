
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
  // requestId ではなく operationId (個別の操作ID) のみで重複を確認する
  // requestId は一連の抽出バッチで共通なため、ここでのチェックに含めるとバッチ内の2件目以降が拒否される原因になる
  if (history.find(h => h.operationId === op.id)) {
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

/**
 * 複数の同期操作を一括適用する。
 * 部分的な成功（Partial Success）を許容し、成功した操作のみを適用して結果を返す。
 * 参照整合性チェックを行い、存在しないターゲットへの更新などはスキップする。
 */
export const applySyncBatch = (
  bible: WorldBible,
  chapters: ChapterLog[],
  ops: SyncOperation[],
  history: HistoryEntry[] = []
): { 
  success: boolean;
  nextBible: WorldBible; 
  nextChapters: ChapterLog[]; 
  historyEntries: HistoryEntry[];
  failedOps: { op: SyncOperation; error: string }[];
} => {
  let currentBible = bible;
  let currentChapters = chapters;
  let currentHistory = [...history];
  const historyEntries: HistoryEntry[] = [];
  const failedOps: { op: SyncOperation; error: string }[] = [];

  for (const op of ops) {
    try {
      // 1. 参照整合性チェック (Reference Integrity Check)
      // 更新または削除の場合、対象IDが存在するか確認する
      if (op.op === 'update' || op.op === 'delete') {
         if (op.targetId) {
            const idx = findItemIdxByPath(currentBible, currentChapters, op.path, op.targetId);
            if (idx === -1) {
               throw new Error(`Integrity Error: Target ID ${op.targetId} not found in ${op.path}. The item may have been deleted.`);
            }
         }
      }

      // 2. 操作の適用
      const { nextBible, nextChapters, historyEntry } = calculateSyncResult(currentBible, currentChapters, op, currentHistory);
      
      // 3. 状態の更新
      currentBible = nextBible;
      currentChapters = nextChapters;
      historyEntries.push(historyEntry);
      currentHistory.push(historyEntry);

    } catch (err: any) {
      console.warn(`SyncOperation failed: ${op.id} (${op.op} ${op.path})`, err);
      failedOps.push({ op, error: err.message });
      // エラーが発生した操作はスキップし、次の操作へ進む（Partial Success戦略）
    }
  }

  return { 
    success: failedOps.length === 0, 
    nextBible: currentBible, 
    nextChapters: currentChapters, 
    historyEntries,
    failedOps 
  };
};

// パスに基づいて項目のインデックスを検索するヘルパー
const findItemIdxByPath = (bible: WorldBible, chapters: ChapterLog[], path: string, id: string): number => {
  if (path === 'chapters') {
    return chapters.findIndex(c => c.id === id);
  }
  const list = (bible as any)[path];
  if (Array.isArray(list)) {
    return list.findIndex((i: any) => i.id === id);
  }
  return -1; // コレクションでないパス、または見つからない場合
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
