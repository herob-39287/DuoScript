import { StoryProject, ExtractionResult, SyncOperation, QuarantineItem } from '../../types';
import { safeJsonParse } from '../gemini/utils';
import { validateSyncOperation, findMatchCandidates } from './utils';

// Stage 1: Parse
// JSON文字列をパースし、構造エラーがあればキャッチする
const parseStage = (jsonText: string, source: string): any[] => {
  return safeJsonParse<any[]>(jsonText || '[]', source).value || [];
};

// Stage 2: Validate
// パースされたオブジェクトが SyncOperation の要件を満たすか検証する
const validationStage = (
  rawOps: any[],
  source: string,
  project: StoryProject,
  isHypothetical: boolean,
) => {
  const validOps: SyncOperation[] = [];
  const quarantineItems: QuarantineItem[] = [];
  const requestId = crypto.randomUUID();
  const timestamp = Date.now();

  rawOps.forEach((raw) => {
    // 必須フィールドのデフォルト値を補完しつつ候補オブジェクトを作成
    const opCandidate = {
      id: crypto.randomUUID(),
      requestId,
      op: raw.op || 'update',
      path: raw.path,
      targetId: raw.targetId,
      targetName: raw.targetName,
      field: raw.field,
      value: raw.value,
      rationale: raw.rationale || 'AI Proposed',
      evidence: raw.evidence || source,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.9,
      status: 'proposal',
      baseVersion: project.bible.version,
      timestamp,
      isHypothetical,
    };

    // Zodスキーマによる検証
    const errors = validateSyncOperation(opCandidate as any);

    if (errors.length > 0 || !opCandidate.path) {
      quarantineItems.push({
        id: crypto.randomUUID(),
        timestamp,
        rawText: JSON.stringify(raw),
        error: errors.join(', ') || 'Invalid path',
        stage: 'SCHEMA',
        partialOp: raw,
      });
    } else {
      validOps.push(opCandidate as SyncOperation);
    }
  });

  return { validOps, quarantineItems };
};

// Stage 3: Resolve
// プロジェクト内の既存データと照合し、ID解決または曖昧性フラグの設定を行う
const resolutionStage = (ops: SyncOperation[], project: StoryProject): SyncOperation[] => {
  return ops.map((op) => {
    const list = op.path === 'chapters' ? project.chapters : (project.bible as any)[op.path];

    if (Array.isArray(list)) {
      const candidates = findMatchCandidates(list, op.targetId, op.targetName);

      if (op.op === 'add') {
        // 新規追加(add)の場合：
        // 既存項目への自動紐付けは行わないが、重複の可能性があれば候補として提示する
        if (candidates.length > 0 && candidates[0].confidence >= 0.98) {
          op.candidates = candidates;
        }
      } else {
        // 更新・削除(update/delete)の場合：
        // 高信頼度なら自動紐付け、低信頼度ならユーザー確認待ち(needs_resolution)にする
        if (candidates.length > 0 && candidates[0].confidence >= 0.95) {
          op.targetId = candidates[0].id;
          op.targetName = candidates[0].name;
          op.confidence = Math.max(op.confidence, candidates[0].confidence);
        } else {
          op.status = 'needs_resolution';
          op.candidates = candidates;
        }
      }
    }
    return op;
  });
};

/**
 * Neural Sync Pipeline Main Entry Point
 */
export const runSyncPipeline = (
  jsonText: string | undefined,
  source: string,
  project: StoryProject,
  isHypothetical: boolean,
): ExtractionResult => {
  // 1. Parse Raw String -> Objects
  const rawOps = parseStage(jsonText || '[]', source);

  // 2. Validate Objects -> SyncOperation Candidates
  const { validOps, quarantineItems } = validationStage(rawOps, source, project, isHypothetical);

  // 3. Resolve References -> Final SyncOperations
  const readyOps = resolutionStage(validOps, project);

  return { readyOps, quarantineItems };
};
