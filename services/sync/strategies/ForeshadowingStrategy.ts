
import { SyncStrategy, SyncContext } from './types';
import { SyncOperation, HistoryEntry, Foreshadowing } from '../../../types';
import { findItemIdx } from '../utils';
import { ForeshadowingSyncSchema } from '../../validation/schemas';

export class ForeshadowingStrategy implements SyncStrategy {
  apply(ctx: SyncContext, op: SyncOperation) {
    if (op.path !== 'foreshadowing') throw new Error("Invalid path for ForeshadowingStrategy");
    const nextBible = { ...ctx.bible };
    const items = [...(nextBible.foreshadowing || [])];
    
    // Zod Validation
    const parsed = ForeshadowingSyncSchema.safeParse(op.value);
    if (!parsed.success) {
      throw new Error(`Invalid foreshadowing data: ${parsed.error.message}`);
    }
    const incoming = parsed.data;

    let targetName = op.targetName || "伏線";
    let oldVal: any = null;
    let newVal: any = null;

    const idx = op.op === 'add' ? -1 : findItemIdx(items, op.targetId, op.targetName);

    if (idx === -1 && op.op !== 'delete') {
      const newItem: Foreshadowing = {
        id: crypto.randomUUID(),
        title: incoming.title || targetName,
        description: incoming.description || "",
        shortSummary: "",
        status: (incoming.status as any) || 'Open',
        priority: (incoming.priority as any) || 'Medium',
        clues: incoming.clues || [],
        redHerrings: incoming.redHerrings || [],
        relatedEntityIds: incoming.relatedEntityIds || [],
        relatedThreadId: undefined,
        relatedThemeId: undefined
      };
      items.push(newItem);
      newVal = newItem;
      targetName = newItem.title;
    } else if (idx !== -1) {
      const current = { ...items[idx] };
      oldVal = { ...items[idx] };
      targetName = current.title;

      if (op.op === 'delete') {
        items.splice(idx, 1);
        newVal = "DELETED";
      } else {
        if (incoming.title) current.title = incoming.title;
        if (incoming.description) current.description = incoming.description;
        if (incoming.status) current.status = incoming.status as any;
        if (incoming.priority) current.priority = incoming.priority as any;
        
        if (incoming.clues) {
           const set = new Set([...current.clues, ...incoming.clues]);
           current.clues = Array.from(set);
        }
        if (incoming.redHerrings) {
           const set = new Set([...current.redHerrings, ...incoming.redHerrings]);
           current.redHerrings = Array.from(set);
        }
        if (incoming.relatedEntityIds) {
           const set = new Set([...current.relatedEntityIds, ...incoming.relatedEntityIds]);
           current.relatedEntityIds = Array.from(set);
        }

        newVal = current;
        items[idx] = newVal;
      }
    }

    nextBible.foreshadowing = items;
    return { nextBible, nextChapters: ctx.chapters, targetName: String(targetName), oldValue: oldVal, newValue: newVal };
  }

  revert(ctx: SyncContext, history: HistoryEntry) {
    const nextBible = { ...ctx.bible };
    const items = [...(nextBible.foreshadowing || [])];
    
    if (history.opType === 'delete') {
      items.push(history.oldValue);
    } else if (history.oldValue === null || history.opType === 'add') {
      const idx = items.findIndex((i: any) => i.id === history.newValue?.id);
      if (idx !== -1) items.splice(idx, 1);
    } else {
      const idx = items.findIndex((i: any) => i.id === history.oldValue?.id);
      if (idx !== -1) items[idx] = history.oldValue;
    }
    
    nextBible.foreshadowing = items;
    return { nextBible, nextChapters: ctx.chapters };
  }
}
