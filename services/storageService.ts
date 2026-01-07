
import { AssetMetadata, StoryProject, VectorEntry } from "../types";
import { Artifact } from "../types/sync";

const DB_NAME = 'DuoScriptDB_V2';
const STORE_HEADS = 'ProjectHeads';
const STORE_REVISIONS = 'ProjectRevisions';
const STORE_CHAPTER_DATA = 'ChapterRevisions';
const STORE_PORTRAITS = 'Portraits';
const STORE_APP_STATE = 'AppState';
const STORE_VECTORS = 'VectorIndex';
const STORE_ARTIFACTS = 'ArtifactsStore'; // New Store
const DB_VERSION = 3; // Bumped version for Artifacts
const SCHEMA_VERSION = 1;

const KEEP_REVISIONS = 10;

let dbPromise: Promise<IDBDatabase> | null = null;

const syncChannel = new BroadcastChannel('duoscript_sync_channel');

export const tabId = crypto.randomUUID();

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
      
      // New Vector Store
      if (!db.objectStoreNames.contains(STORE_VECTORS)) {
        const vectorStore = db.createObjectStore(STORE_VECTORS, { keyPath: 'id' });
        vectorStore.createIndex('projectId', 'projectId', { unique: false });
      }

      // New Artifact Store
      if (!db.objectStoreNames.contains(STORE_ARTIFACTS)) {
        const artifactStore = db.createObjectStore(STORE_ARTIFACTS, { keyPath: 'id' });
        artifactStore.createIndex('projectId', 'projectId', { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`IndexedDB failed: ${request.error?.message}`));
    };
  });
  
  return dbPromise;
};

// --- Artifact Operations ---

export const saveArtifact = async (artifact: Artifact): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(STORE_ARTIFACTS, 'readwrite');
  const store = tx.objectStore(STORE_ARTIFACTS);
  store.put(artifact);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getArtifact = async (id: string): Promise<Artifact | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ARTIFACTS, 'readonly');
    const store = tx.objectStore(STORE_ARTIFACTS);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const getProjectArtifacts = async (projectId: string): Promise<Artifact[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ARTIFACTS, 'readonly');
    const store = tx.objectStore(STORE_ARTIFACTS);
    const index = store.index('projectId');
    const request = index.getAll(projectId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

// --- Vector Operations ---

export const saveVectors = async (entries: VectorEntry[]): Promise<void> => {
  if (entries.length === 0) return;
  const db = await initDB();
  const tx = db.transaction(STORE_VECTORS, 'readwrite');
  const store = tx.objectStore(STORE_VECTORS);
  entries.forEach(entry => store.put(entry));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getProjectVectors = async (projectId: string): Promise<VectorEntry[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VECTORS, 'readonly');
    const store = tx.objectStore(STORE_VECTORS);
    const index = store.index('projectId');
    const request = index.getAll(projectId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const deleteVectors = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const db = await initDB();
  const tx = db.transaction(STORE_VECTORS, 'readwrite');
  const store = tx.objectStore(STORE_VECTORS);
  ids.forEach(id => store.delete(id));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// --- Existing Operations ---

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

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_HEADS, STORE_REVISIONS, STORE_CHAPTER_DATA, STORE_APP_STATE], 'readwrite');
    let nextRev = 0;
    
    transaction.oncomplete = () => {
      if (nextRev > 0) {
        garbageCollectRevisions(projectId, nextRev).catch(console.error);
        syncChannel.postMessage({ type: 'REVISION_SAVED', projectId, rev: nextRev, sender: tabId });
        resolve(nextRev);
      }
    };
    
    transaction.onerror = () => reject(transaction.error);
    
    transaction.onabort = () => {
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
    };
    
    headReq.onerror = () => {
    };
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
