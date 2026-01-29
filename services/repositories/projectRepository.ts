import { StoryProject } from "../../types";
import { initDB, STORE_HEADS, STORE_REVISIONS, STORE_CHAPTER_DATA, STORE_APP_STATE, STORE_PORTRAITS } from "./baseRepository";

const KEEP_REVISIONS = 10;
export const tabId = crypto.randomUUID();
const syncChannel = new BroadcastChannel('duoscript_sync_channel');

export const getSyncChannel = () => syncChannel;

export const getHeadRev = async (projectId: string): Promise<number> => {
  const db = await initDB();
  const result = await db.get(STORE_HEADS, projectId);
  return result?.headRev || 0;
};

const SCHEMA_VERSION = 1;

export const saveProjectRevision = async (project: StoryProject, expectedRev?: number): Promise<number> => {
  const db = await initDB();
  const projectId = project.meta.id;

  const tx = db.transaction(
    [STORE_HEADS, STORE_REVISIONS, STORE_CHAPTER_DATA, STORE_APP_STATE, STORE_PORTRAITS],
    'readwrite'
  );

  try {
    const headData = await tx.objectStore(STORE_HEADS).get(projectId);
    const currentRev = headData?.headRev || 0;

    if (expectedRev !== undefined && currentRev !== expectedRev) {
      tx.abort();
      throw new Error('SAVE_CONFLICT');
    }

    const nextRev = currentRev + 1;

    const chapterHeaders = await Promise.all(project.chapters.map(async (ch: any) => {
      const { content, ...header } = ch;
      
      if (content !== undefined) {
        // If content is loaded in memory, save it to the new revision
        await tx.objectStore(STORE_CHAPTER_DATA).put({ projectId, chapterId: ch.id, rev: nextRev, content });
      } else if (currentRev > 0) {
        // Lazy Save: Content not in memory, copy from previous revision
        const prevContent = await tx.objectStore(STORE_CHAPTER_DATA).get([projectId, ch.id, currentRev]);
        if (prevContent) {
          await tx.objectStore(STORE_CHAPTER_DATA).put({ ...prevContent, rev: nextRev });
        }
      }
      
      return header;
    }));

    await tx.objectStore(STORE_REVISIONS).put({
      projectId,
      rev: nextRev,
      schemaVersion: SCHEMA_VERSION,
      meta: { ...project.meta, headRev: nextRev, schemaVersion: SCHEMA_VERSION },
      bible: project.bible,
      sync: project.sync,
      chapterHeaders,
      timestamp: Date.now()
    });

    await tx.objectStore(STORE_HEADS).put({ headRev: nextRev }, projectId);
    
    await tx.done;

    garbageCollectRevisions(projectId, nextRev).catch(console.error);
    syncChannel.postMessage({ type: 'REVISION_SAVED', projectId, rev: nextRev, sender: tabId });
    return nextRev;

  } catch (error: any) {
    // Abort is implicitly handled by throwing unless we catch it here,
    // but tx.done handles waiting for completion. If we manually aborted, tx.done will reject.
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      throw new Error('STORAGE_QUOTA_EXCEEDED');
    }
    throw error;
  }
};

export const getRevisionHistory = async (projectId: string): Promise<{ rev: number; timestamp: number; wordCount: number }[]> => {
  const db = await initDB();
  const tx = db.transaction(STORE_REVISIONS, 'readonly');
  const store = tx.objectStore(STORE_REVISIONS);
  
  // IDBKeyRange.bound is standard API, can be used directly
  const range = IDBKeyRange.bound([projectId, 0], [projectId, Infinity]);
  
  const results: { rev: number; timestamp: number; wordCount: number }[] = [];
  let cursor = await store.openCursor(range, 'prev');

  while (cursor) {
    const val = cursor.value;
    const totalWords = (val.chapterHeaders || []).reduce((acc: number, ch: any) => acc + (ch.wordCount || 0), 0);
    results.push({
      rev: val.rev,
      timestamp: val.timestamp,
      wordCount: totalWords
    });
    cursor = await cursor.continue();
  }
  
  await tx.done;
  return results;
};

export const loadFullSnapshot = async (projectId: string, rev?: number): Promise<StoryProject | null> => {
  const db = await initDB();
  const targetRev = rev !== undefined ? rev : await getHeadRev(projectId);
  if (targetRev === 0) return null;

  const manifest = await db.get(STORE_REVISIONS, [projectId, targetRev]);
  if (!manifest) return null;

  const chapters = manifest.chapterHeaders || [];
  // Explicitly set content to undefined to indicate it needs fetching
  const lightChapters = chapters.map((c: any) => ({ ...c, content: undefined }));

  // manifest contains meta, bible, sync. We overwrite chapters with lightChapters.
  // Cast to StoryProject to enforce type.
  return { ...manifest, chapters: lightChapters } as StoryProject;
};

export const loadLatestProject = async (projectId: string): Promise<StoryProject | null> => {
  const headRev = await getHeadRev(projectId);
  return loadFullSnapshot(projectId, headRev);
};

export const saveChapterContent = async (projectId: string, chapterId: string, rev: number, content: string): Promise<void> => {
  const db = await initDB();
  await db.put(STORE_CHAPTER_DATA, { projectId, chapterId, rev, content });
};

export const loadChapterContent = async (projectId: string, chapterId: string, rev: number): Promise<string | null> => {
  const db = await initDB();
  const result = await db.get(STORE_CHAPTER_DATA, [projectId, chapterId, rev]);
  return result?.content || "";
};

export const getAllProjects = async (): Promise<StoryProject[]> => {
  const db = await initDB();
  const keys = await db.getAllKeys(STORE_HEADS);
  
  const projects = await Promise.all(keys.map(async (key) => {
    return loadLatestProject(key as string);
  }));
  
  return projects.filter((p): p is StoryProject => !!p);
};

const garbageCollectRevisions = async (projectId: string, currentRev: number) => {
  const db = await initDB();
  const threshold = currentRev - KEEP_REVISIONS;
  if (threshold <= 0) return;

  const tx = db.transaction([STORE_REVISIONS, STORE_CHAPTER_DATA], 'readwrite');
  
  // Delete old revisions
  // IDBKeyRange.bound([projectId, 0], [projectId, threshold]) covers revisions 0 to threshold
  await tx.objectStore(STORE_REVISIONS).delete(IDBKeyRange.bound([projectId, 0], [projectId, threshold]));

  // Delete old chapter data
  // Iterate and delete is safer for compound keys
  let cursor = await tx.objectStore(STORE_CHAPTER_DATA).openCursor(IDBKeyRange.lowerBound([projectId]));
  
  while (cursor) {
    const key = cursor.key as [string, string, number];
    if (key[0] !== projectId) break; // Optimization if sorted by projectId

    const rev = key[2];
    if (rev <= threshold) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  
  await tx.done;
};