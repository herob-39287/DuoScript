
export const DB_NAME = 'DuoScriptDB_V2';
export const STORE_HEADS = 'ProjectHeads';
export const STORE_REVISIONS = 'ProjectRevisions';
export const STORE_CHAPTER_DATA = 'ChapterRevisions';
export const STORE_PORTRAITS = 'Portraits';
export const STORE_APP_STATE = 'AppState';
export const STORE_VECTORS = 'VectorIndex';
export const STORE_ARTIFACTS = 'ArtifactsStore';
export const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

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
