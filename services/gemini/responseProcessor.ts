import { StoryProject, ExtractionResult } from '../../types';
import { runSyncPipeline } from '../sync/pipeline';

/**
 * Geminiからの応答（JSON文字列）を解析し、アプリケーションで扱えるSyncOperation形式に変換・加工する。
 * 処理は `services/sync/pipeline.ts` に委譲される。
 */
export function processSyncOperations(
  jsonText: string | undefined,
  source: string,
  project: StoryProject,
  isHypothetical: boolean,
): ExtractionResult {
  return runSyncPipeline(jsonText, source, project, isHypothetical);
}
