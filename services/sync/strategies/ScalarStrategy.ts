import { SyncStrategy, SyncContext } from './types';
import { SyncOperation, HistoryEntry } from '../../../types';
import { StringOrNull } from '../../validation/schemas';

export class ScalarStrategy implements SyncStrategy {
  apply(ctx: SyncContext, op: SyncOperation) {
    const nextBible = { ...ctx.bible };
    const oldVal = (nextBible as any)[op.path];

    // Validate scalar value
    const parsed = StringOrNull.safeParse(op.value);
    const newVal = parsed.success ? parsed.data : String(op.value);

    (nextBible as any)[op.path] = newVal;

    return {
      nextBible,
      nextChapters: ctx.chapters,
      targetName: op.path.toUpperCase(),
      oldValue: oldVal,
      newValue: newVal,
    };
  }

  revert(ctx: SyncContext, history: HistoryEntry) {
    const nextBible = { ...ctx.bible };
    (nextBible as any)[history.path] = history.oldValue;
    return { nextBible, nextChapters: ctx.chapters };
  }
}
