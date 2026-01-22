
import { StoryProject } from "../../types";
import { initDB, STORE_HEADS, STORE_REVISIONS, STORE_CHAPTER_DATA, STORE_APP_STATE, STORE_PORTRAITS } from "./baseRepository";

const KEEP_REVISIONS = 10;
export const tabId = crypto.randomUUID();
const syncChannel = new BroadcastChannel('duoscript_sync_channel');

export const getSyncChannel = () => syncChannel;

export const getHeadRev = async (projectId: string): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_HEADS, 'readonly');
    const request = transaction.objectStore(STORE_HEADS).get(projectId);
    request.onsuccess = () => resolve(request.result?.headRev || 0);
    request.onerror = () => resolve(0);
  });
};

const SCHEMA_VERSION = 1;

export const saveProjectRevision = async (project: StoryProject, expectedRev?: number): Promise<number> => {
  const db = await initDB();
  const projectId = project.meta.id;

  return new Promise((resolve, reject) => {
    // Added STORE_PORTRAITS to transaction scope for asset restoration logic
    const transaction = db.transaction([STORE_HEADS, STORE_REVISIONS, STORE_CHAPTER_DATA, STORE_APP_STATE, STORE_PORTRAITS], 'readwrite');
    let nextRev = 0;
    
    transaction.oncomplete = () => {
      if (nextRev > 0) {
        garbageCollectRevisions(projectId, nextRev).catch(console.error);
        syncChannel.postMessage({ type: 'REVISION_SAVED', projectId, rev: nextRev, sender: tabId });
        resolve(nextRev);
      }
    };
    
    transaction.onerror = (event: any) => {
      const error = transaction.error || event.target.error;
      if (error && (error.name === 'QuotaExceededError' || error.code === 22)) {
        reject(new Error('STORAGE_QUOTA_EXCEEDED'));
      } else {
        reject(error);
      }
    };
    
    const headStore = transaction.objectStore(STORE_HEADS);
    const revStore = transaction.objectStore(STORE_REVISIONS);
    const chapterStore = transaction.objectStore(STORE_CHAPTER_DATA);
    
    const headReq = headStore.get(projectId);

    headReq.onsuccess = () => {
      const currentRev = headReq.result?.headRev || 0;

      if (expectedRev !== undefined && currentRev !== expectedRev) {
         reject(new Error('SAVE_CONFLICT'));
         transaction.abort();
         return;
      }

      nextRev = currentRev + 1;

      try {
        const chapterHeaders = project.chapters.map((ch: any) => {
          const { content, ...header } = ch;
          
          if (content !== undefined) {
            // If content is loaded in memory, save it to the new revision
            chapterStore.put({ projectId, chapterId: ch.id, rev: nextRev, content });
          } else if (currentRev > 0) {
            // Lazy Save: Content not in memory, copy from previous revision
            const prevContentReq = chapterStore.get([projectId, ch.id, currentRev]);
            prevContentReq.onsuccess = () => {
              if (prevContentReq.result) {
                chapterStore.put({ ...prevContentReq.result, rev: nextRev });
              }
            };
          }
          
          return header;
        });

        revStore.put({
          projectId,
          rev: nextRev,
          schemaVersion: SCHEMA_VERSION,
          meta: { ...project.meta, headRev: nextRev, schemaVersion: SCHEMA_VERSION },
          bible: project.bible,
          sync: project.sync,
          chapterHeaders,
          timestamp: Date.now()
        });

        headStore.put({ projectId, headRev: nextRev }, projectId);
      } catch (e: any) {
        // Catch synchronous errors during put (though mostly async errors go to transaction.onerror)
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          reject(new Error('STORAGE_QUOTA_EXCEEDED'));
          transaction.abort();
        } else {
          throw e;
        }
      }
    };
  });
};

export const getRevisionHistory = async (projectId: string): Promise<{ rev: number; timestamp: number; wordCount: number }[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_REVISIONS, 'readonly');
    const store = transaction.objectStore(STORE_REVISIONS);
    // Key range for [projectId, 0] to [projectId, Infinity]
    const range = IDBKeyRange.bound([projectId, 0], [projectId, Infinity]);
    const request = store.openCursor(range, 'prev'); // Newest first
    
    const results: { rev: number; timestamp: number; wordCount: number }[] = [];

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const val = cursor.value;
        // Calculate rough word count from chapter headers to give context
        const totalWords = (val.chapterHeaders || []).reduce((acc: number, ch: any) => acc + (ch.wordCount || 0), 0);
        
        results.push({
          rev: val.rev,
          timestamp: val.timestamp,
          wordCount: totalWords
        });
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const loadFullSnapshot = async (projectId: string, rev?: number): Promise<any | null> => {
  const db = await initDB();
  const targetRev = rev !== undefined ? rev : await getHeadRev(projectId);
  if (targetRev === 0) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_REVISIONS], 'readonly');
    const revStore = transaction.objectStore(STORE_REVISIONS);

    const revReq = revStore.get([projectId, targetRev]);
    revReq.onsuccess = () => {
      const manifest = revReq.result;
      if (!manifest) { resolve(null); return; }

      // Optimization: Lazy Loading
      // We only load metadata (headers). Content and Assets are loaded on demand by hooks.
      // This massively reduces initial load time and memory usage.
      const chapters = manifest.chapterHeaders || [];
      
      // Explicitly set content to undefined to indicate it needs fetching
      // unless it was saved as empty string in header (which shouldn't happen usually)
      const lightChapters = chapters.map((c: any) => ({ ...c, content: undefined }));

      resolve({ ...manifest, chapters: lightChapters });
    };
    revReq.onerror = () => reject(revReq.error);
  });
};

export const loadLatestProject = async (projectId: string): Promise<any | null> => {
  const headRev = await getHeadRev(projectId);
  return loadFullSnapshot(projectId, headRev);
};

export const saveChapterContent = async (projectId: string, chapterId: string, rev: number, content: string): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(STORE_CHAPTER_DATA, 'readwrite');
  transaction.objectStore(STORE_CHAPTER_DATA).put({ projectId, chapterId, rev, content });
};

export const loadChapterContent = async (projectId: string, chapterId: string, rev: number): Promise<string | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_CHAPTER_DATA, 'readonly');
    const request = transaction.objectStore(STORE_CHAPTER_DATA).get([projectId, chapterId, rev]);
    request.onsuccess = () => resolve(request.result?.content || "");
    request.onerror = () => resolve("");
  });
};

export const getAllProjects = async (): Promise<StoryProject[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_HEADS, 'readonly');
    const request = transaction.objectStore(STORE_HEADS).getAll();
    request.onsuccess = async () => {
      const heads = request.result || [];
      const projects = await Promise.all(heads.map((h: any) => loadLatestProject(h.projectId)));
      resolve(projects.filter(Boolean));
    };
  });
};

const garbageCollectRevisions = async (projectId: string, currentRev: number) => {
  const db = await initDB();
  const threshold = currentRev - KEEP_REVISIONS;
  if (threshold <= 0) return;
  const transaction = db.transaction([STORE_REVISIONS, STORE_CHAPTER_DATA], 'readwrite');
  
  // Cleanup Revisions Manifests
  transaction.objectStore(STORE_REVISIONS).delete(IDBKeyRange.bound([projectId, 0], [projectId, threshold]));

  // Cleanup Chapter Data Content
  const chapterStore = transaction.objectStore(STORE_CHAPTER_DATA);
  const request = chapterStore.openCursor(IDBKeyRange.lowerBound([projectId]));
  
  request.onsuccess = (event: any) => {
    const cursor = event.target.result;
    if (cursor) {
      const key = cursor.key; 
      if (key[0] !== projectId) return;

      const rev = key[2];
      if (typeof rev === 'number' && rev <= threshold) {
        cursor.delete();
      }
      cursor.continue();
    }
  };
};
