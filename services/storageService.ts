
import { AssetMetadata, StoryProject } from "../types";

const DB_NAME = 'DuoScriptDB_V2';
const STORE_HEADS = 'ProjectHeads';
const STORE_REVISIONS = 'ProjectRevisions';
const STORE_CHAPTER_DATA = 'ChapterRevisions';
const STORE_PORTRAITS = 'Portraits';
const STORE_APP_STATE = 'AppState';
const DB_VERSION = 1;
const SCHEMA_VERSION = 1;

const KEEP_REVISIONS = 10;

let dbPromise: Promise<IDBDatabase> | null = null;

const syncChannel = new BroadcastChannel('duoscript_sync_channel');

export const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_HEADS)) db.createObjectStore(STORE_HEADS);
      if (!db.objectStoreNames.contains(STORE_REVISIONS)) db.createObjectStore(STORE_REVISIONS, { keyPath: ['projectId', 'rev'] });
      if (!db.objectStoreNames.contains(STORE_CHAPTER_DATA)) db.createObjectStore(STORE_CHAPTER_DATA, { keyPath: ['projectId', 'chapterId', 'rev'] });
      if (!db.objectStoreNames.contains(STORE_PORTRAITS)) db.createObjectStore(STORE_PORTRAITS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_APP_STATE)) db.createObjectStore(STORE_APP_STATE);
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`IndexedDB failed: ${request.error?.message}`));
    };
  });
  
  return dbPromise;
};

export const getHeadRev = async (projectId: string): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_HEADS, 'readonly');
    const request = transaction.objectStore(STORE_HEADS).get(projectId);
    request.onsuccess = () => resolve(request.result?.headRev || 0);
    request.onerror = () => resolve(0);
  });
};

export const saveProjectRevision = async (project: StoryProject, expectedRev?: number): Promise<number> => {
  const db = await initDB();
  const projectId = project.meta.id;
  const currentRev = await getHeadRev(projectId);

  if (expectedRev !== undefined && currentRev !== expectedRev) {
     throw new Error('SAVE_CONFLICT');
  }

  const nextRev = currentRev + 1;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_HEADS, STORE_REVISIONS, STORE_CHAPTER_DATA, STORE_APP_STATE], 'readwrite');
    
    transaction.oncomplete = () => {
      garbageCollectRevisions(projectId, nextRev).catch(console.error);
      syncChannel.postMessage({ type: 'REVISION_SAVED', projectId, rev: nextRev });
      resolve(nextRev);
    };
    transaction.onerror = () => reject(transaction.error);

    const revStore = transaction.objectStore(STORE_REVISIONS);
    const chapterStore = transaction.objectStore(STORE_CHAPTER_DATA);
    const headStore = transaction.objectStore(STORE_HEADS);

    const chapterHeaders = project.chapters.map((ch: any) => {
      const { content, ...header } = ch;
      chapterStore.put({ projectId, chapterId: ch.id, rev: nextRev, content: content || "" });
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
  });
};

export const loadFullSnapshot = async (projectId: string, rev?: number): Promise<any | null> => {
  const db = await initDB();
  const targetRev = rev !== undefined ? rev : await getHeadRev(projectId);
  if (targetRev === 0) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_REVISIONS, STORE_CHAPTER_DATA, STORE_PORTRAITS], 'readonly');
    const revStore = transaction.objectStore(STORE_REVISIONS);
    const chapterStore = transaction.objectStore(STORE_CHAPTER_DATA);
    const portraitStore = transaction.objectStore(STORE_PORTRAITS);

    const revReq = revStore.get([projectId, targetRev]);
    revReq.onsuccess = () => {
      const manifest = revReq.result;
      if (!manifest) { resolve(null); return; }

      const chapters: any[] = [];
      const headers = manifest.chapterHeaders || [];
      const assets: { [id: string]: string } = {};

      const portraitReq = portraitStore.getAll();
      portraitReq.onsuccess = () => {
        const allPortraits = portraitReq.result || [];
        allPortraits.filter(p => p.projectId === projectId).forEach(p => {
          assets[p.id] = p.data;
        });

        if (headers.length === 0) {
          resolve({ ...manifest, chapters: [], assets });
          return;
        }

        let loadedCount = 0;
        headers.forEach((header: any) => {
          const contentReq = chapterStore.get([projectId, header.id, targetRev]);
          contentReq.onsuccess = () => {
            chapters.push({ ...header, content: contentReq.result?.content || "" });
            if (++loadedCount === headers.length) resolve({ ...manifest, chapters, assets });
          };
          contentReq.onerror = () => {
            chapters.push({ ...header, content: "" });
            if (++loadedCount === headers.length) resolve({ ...manifest, chapters, assets });
          };
        });
      };
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

const garbageCollectRevisions = async (projectId: string, currentRev: number) => {
  const db = await initDB();
  const threshold = currentRev - KEEP_REVISIONS;
  if (threshold <= 0) return;
  const transaction = db.transaction([STORE_REVISIONS, STORE_CHAPTER_DATA], 'readwrite');
  transaction.objectStore(STORE_REVISIONS).delete(IDBKeyRange.bound([projectId, 0], [projectId, threshold]));
};

export const savePortrait = async (projectId: string, charId: string, base64: string): Promise<void> => {
  const db = await initDB();
  const asset: AssetMetadata & { data: string } = {
    id: charId, projectId, type: 'portrait', size: base64.length, mimeType: 'image/png',
    createdAt: Date.now(), lastUsedAt: Date.now(), data: base64
  };
  const transaction = db.transaction(STORE_PORTRAITS, 'readwrite');
  transaction.objectStore(STORE_PORTRAITS).put(asset);
};

export const getPortrait = async (charId: string): Promise<string | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_PORTRAITS, 'readonly');
    const request = transaction.objectStore(STORE_PORTRAITS).get(charId);
    request.onsuccess = () => resolve(request.result?.data || null);
  });
};

export const deletePortrait = async (charId: string): Promise<void> => {
  const db = await initDB();
  db.transaction(STORE_PORTRAITS, 'readwrite').objectStore(STORE_PORTRAITS).delete(charId);
};

export const getAllAssetMetadata = async (projectId?: string): Promise<AssetMetadata[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const request = db.transaction(STORE_PORTRAITS, 'readonly').objectStore(STORE_PORTRAITS).getAll();
    request.onsuccess = () => {
      let results = request.result || [];
      if (projectId) results = results.filter((a: any) => a.projectId === projectId);
      resolve(results.map(({ data, ...meta }: any) => meta));
    };
  });
};

export const getAllProjects = async (): Promise<StoryProject[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_HEADS, 'readonly');
    const request = transaction.objectStore(STORE_HEADS).getAll();
    request.onsuccess = async () => {
      const heads = request.result || [];
      const projects = await Promise.all(heads.map(h => loadLatestProject(h.projectId)));
      resolve(projects.filter(Boolean));
    };
  });
};

export const getLastOpenedProjectId = async (): Promise<string | null> => {
  return localStorage.getItem('duoscript_active_id');
};

export const getSyncChannel = () => syncChannel;
