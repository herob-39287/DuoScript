
import { WorldBible, ChapterLog, HistoryEntry, SyncOperation } from '../../../types';

export interface SyncContext {
  bible: WorldBible;
  chapters: ChapterLog[];
  history: HistoryEntry[];
}

export interface SyncStrategy {
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
