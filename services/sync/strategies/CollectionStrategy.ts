import { SyncStrategy, SyncContext } from './types';
import { SyncOperation, HistoryEntry, WorldBible, ChapterLog } from '../../../types';
import { findItemIdx } from '../utils';
import {
  LawSyncSchema,
  LocationSyncSchema,
  OrganizationSyncSchema,
  KeyItemSyncSchema,
  EntrySyncSchema,
  ThemeSyncSchema,
  RaceSyncSchema,
  BestiarySyncSchema,
  AbilitySyncSchema,
  TimelineSyncSchema,
  StoryThreadSyncSchema,
  StoryStructureSyncSchema,
  VolumeSyncSchema,
  ChapterSyncSchema,
  NexusBranchSyncSchema,
  StringOrNull,
} from '../../validation/schemas';
import { z } from 'zod';

// Collection items usually have an ID and some content.
// Define a generic interface for items manipulated by this strategy.
interface GenericCollectionItem {
  id: string;
  updatedAt?: number;
  [key: string]: any;
}

export class CollectionStrategy implements SyncStrategy {
  private getMapping(path: string) {
    const modelMap: Record<string, { schema: z.ZodType<any>; naming: string; content: string }> = {
      laws: { schema: LawSyncSchema, naming: 'name', content: 'description' },
      locations: { schema: LocationSyncSchema, naming: 'name', content: 'description' },
      organizations: { schema: OrganizationSyncSchema, naming: 'name', content: 'description' },
      keyItems: { schema: KeyItemSyncSchema, naming: 'name', content: 'description' },
      entries: { schema: EntrySyncSchema, naming: 'title', content: 'definition' },
      themes: { schema: ThemeSyncSchema, naming: 'concept', content: 'description' },
      races: { schema: RaceSyncSchema, naming: 'name', content: 'description' },
      bestiary: { schema: BestiarySyncSchema, naming: 'name', content: 'description' },
      abilities: { schema: AbilitySyncSchema, naming: 'name', content: 'description' },
      timeline: { schema: TimelineSyncSchema, naming: 'event', content: 'description' },
      storyThreads: { schema: StoryThreadSyncSchema, naming: 'title', content: 'shortSummary' },
      storyStructure: { schema: StoryStructureSyncSchema, naming: 'name', content: 'summary' },
      volumes: { schema: VolumeSyncSchema, naming: 'title', content: 'summary' },
      chapters: { schema: ChapterSyncSchema, naming: 'title', content: 'summary' },
      nexusBranches: {
        schema: NexusBranchSyncSchema,
        naming: 'hypothesis',
        content: 'impactOnCanon',
      },
    };
    return modelMap[path];
  }

  apply(ctx: SyncContext, op: SyncOperation) {
    const isBiblePath = op.path !== 'chapters';
    const nextBible = { ...ctx.bible };
    const nextChapters = [...ctx.chapters];

    // Type-safe collection retrieval
    let collection: GenericCollectionItem[];

    if (op.path === 'chapters') {
      collection = nextChapters as unknown as GenericCollectionItem[];
    } else {
      // Cast to ensure we are accessing an array property of WorldBible
      // We assume op.path refers to a valid array property in WorldBible for CollectionStrategy
      const bibleKey = op.path as keyof WorldBible;
      const bibleValue = nextBible[bibleKey];

      if (Array.isArray(bibleValue)) {
        collection = [...bibleValue] as GenericCollectionItem[];
      } else {
        // Fallback or error if path is not a collection
        throw new Error(`Path ${op.path} is not a valid collection in Bible.`);
      }
    }

    const mapping = this.getMapping(op.path);
    if (!mapping) throw new Error(`No schema mapping found for path: ${op.path}`);

    // Zod Validation ensures runtime type safety for incoming value
    const parsed = mapping.schema.safeParse(op.value);
    if (!parsed.success) {
      throw new Error(`Validation failed for ${op.path}: ${parsed.error.message}`);
    }
    const incomingValue = parsed.data;

    const namingField = mapping.naming;
    let targetName = StringOrNull.parse(op.targetName) || '対象項目';
    let oldVal: any = null;
    let newVal: any = null;

    const idx = op.op === 'add' ? -1 : findItemIdx(collection, op.targetId, op.targetName);

    if (idx === -1 && op.op !== 'delete') {
      const newItem: GenericCollectionItem = { id: crypto.randomUUID(), updatedAt: Date.now() };
      Object.assign(newItem, incomingValue);

      if (!newItem[namingField]) {
        newItem[namingField] =
          op.targetName ||
          incomingValue.name ||
          incomingValue.title ||
          incomingValue.event ||
          incomingValue.concept ||
          '無題';
      }

      // Default array initialization if needed
      if (op.path === 'entries') {
        if (!newItem.tags) newItem.tags = [];
        if (!newItem.aliases) newItem.aliases = [];
        if (!newItem.linkedIds) newItem.linkedIds = [];
      }

      collection.push(newItem);
      targetName = newItem[namingField] || targetName;
      newVal = newItem;
    } else if (idx !== -1) {
      const current = { ...collection[idx] };
      targetName = current[namingField] || targetName;

      if (op.op === 'delete') {
        oldVal = current;
        collection.splice(idx, 1);
        newVal = 'DELETED';
      } else {
        oldVal = { ...current };

        if (op.field) {
          // For manual field updates, we assign directly
          current[op.field] = op.value;
        } else {
          // For full object updates, we merge validated schema data
          Object.assign(current, incomingValue);
        }

        current.updatedAt = Date.now();
        newVal = current;
        collection[idx] = newVal;
      }
    }

    if (isBiblePath) {
      (nextBible as any)[op.path] = collection;
      return {
        nextBible,
        nextChapters: ctx.chapters,
        targetName: String(targetName),
        oldValue: oldVal,
        newValue: newVal,
      };
    } else {
      return {
        nextBible,
        nextChapters: collection as unknown as ChapterLog[],
        targetName: String(targetName),
        oldValue: oldVal,
        newValue: newVal,
      };
    }
  }

  revert(ctx: SyncContext, history: HistoryEntry) {
    const isBiblePath = history.path !== 'chapters';
    const nextBible = { ...ctx.bible };
    const nextChapters = [...ctx.chapters];

    // Use similar logic for retrieval
    let collection: GenericCollectionItem[];
    if (history.path === 'chapters') {
      collection = nextChapters as unknown as GenericCollectionItem[];
    } else {
      const bibleKey = history.path as keyof WorldBible;
      const bibleValue = nextBible[bibleKey];
      if (Array.isArray(bibleValue)) {
        collection = [...bibleValue] as GenericCollectionItem[];
      } else {
        return { nextBible, nextChapters: ctx.chapters };
      }
    }

    const mapping = this.getMapping(history.path);
    const namingField = mapping?.naming || 'id';

    if (history.opType === 'delete') {
      collection.push(history.oldValue);
    } else if (history.oldValue === null || history.opType === 'add') {
      const idx = collection.findIndex(
        (i) => i.id === history.targetId || i[namingField] === history.targetName,
      );
      if (idx !== -1) collection.splice(idx, 1);
    } else {
      const idx = collection.findIndex(
        (i) => i.id === history.targetId || i[namingField] === history.targetName,
      );
      if (idx !== -1) collection[idx] = history.oldValue;
    }

    if (isBiblePath) {
      (nextBible as any)[history.path] = collection;
      return { nextBible, nextChapters: ctx.chapters };
    } else {
      return { nextBible, nextChapters: collection as unknown as ChapterLog[] };
    }
  }
}
