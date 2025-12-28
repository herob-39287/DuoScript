
const DB_NAME = 'DuoScriptDB';
const PORTRAITS_STORE = 'Portraits';
const PROJECTS_STORE = 'Projects';
const CONTENTS_STORE = 'ChapterContents';
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PORTRAITS_STORE)) {
        db.createObjectStore(PORTRAITS_STORE);
      }
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONTENTS_STORE)) {
        db.createObjectStore(CONTENTS_STORE);
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`IndexedDB failed to open: ${request.error?.message}`));
    };
  });
  
  return dbPromise;
};

// Generic wrapper to ensure DB is always ready and transactions are handled
const withStore = async (storeName: string, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest): Promise<any> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = callback(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
};

// --- Portrait Management ---
export const savePortrait = async (charId: string, base64: string): Promise<void> => {
  return withStore(PORTRAITS_STORE, 'readwrite', (store) => store.put(base64, charId));
};

export const getPortrait = async (charId: string): Promise<string | null> => {
  return withStore(PORTRAITS_STORE, 'readonly', (store) => store.get(charId));
};

// --- Chapter Content Management (Lazy Loading) ---
export const saveChapterContent = async (chapterId: string, content: string): Promise<void> => {
  return withStore(CONTENTS_STORE, 'readwrite', (store) => store.put(content, chapterId));
};

export const loadChapterContent = async (chapterId: string): Promise<string | null> => {
  return withStore(CONTENTS_STORE, 'readonly', (store) => store.get(chapterId));
};

// --- Project Management ---
export const saveProject = async (project: any): Promise<void> => {
  return withStore(PROJECTS_STORE, 'readwrite', (store) => store.put(project));
};

export const loadProject = async (id: string): Promise<any | null> => {
  return withStore(PROJECTS_STORE, 'readonly', (store) => store.get(id));
};

export const getAllProjects = async (): Promise<any[]> => {
  return withStore(PROJECTS_STORE, 'readonly', (store) => store.getAll());
};
