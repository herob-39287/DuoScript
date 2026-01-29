import { openDB, DBSchema, IDBPDatabase } from 'idb';

export const DB_NAME = 'DuoScriptDB_V2';
export const STORE_HEADS = 'ProjectHeads';
export const STORE_REVISIONS = 'ProjectRevisions';
export const STORE_CHAPTER_DATA = 'ChapterRevisions';
export const STORE_PORTRAITS = 'Portraits';
export const STORE_APP_STATE = 'AppState';
export const STORE_VECTORS = 'VectorIndex';
export const STORE_ARTIFACTS = 'ArtifactsStore';
export const DB_VERSION = 3;

export interface DuoScriptDB extends DBSchema {
  ProjectHeads: {
    key: string;
    value: { headRev: number };
  };
  ProjectRevisions: {
    key: [string, number]; // [projectId, rev]
    value: any;
  };
  ChapterRevisions: {
    key: [string, string, number]; // [projectId, chapterId, rev]
    value: { projectId: string; chapterId: string; rev: number; content: string };
  };
  Portraits: {
    key: string; // id
    value: any;
  };
  AppState: {
    key: string;
    value: any;
  };
  VectorIndex: {
    key: string; // id
    value: any;
    indexes: { 'projectId': string };
  };
  ArtifactsStore: {
    key: string; // id
    value: any;
    indexes: { 'projectId': string };
  };
}

let dbPromise: Promise<IDBPDatabase<DuoScriptDB>> | null = null;

export const initDB = (): Promise<IDBPDatabase<DuoScriptDB>> => {
  if (dbPromise) return dbPromise;

  dbPromise = openDB<DuoScriptDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_HEADS)) {
        db.createObjectStore(STORE_HEADS);
      }
      if (!db.objectStoreNames.contains(STORE_REVISIONS)) {
        db.createObjectStore(STORE_REVISIONS, { keyPath: ['projectId', 'rev'] });
      }
      if (!db.objectStoreNames.contains(STORE_CHAPTER_DATA)) {
        db.createObjectStore(STORE_CHAPTER_DATA, { keyPath: ['projectId', 'chapterId', 'rev'] });
      }
      if (!db.objectStoreNames.contains(STORE_PORTRAITS)) {
        db.createObjectStore(STORE_PORTRAITS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_APP_STATE)) {
        db.createObjectStore(STORE_APP_STATE);
      }
      if (!db.objectStoreNames.contains(STORE_VECTORS)) {
        const store = db.createObjectStore(STORE_VECTORS, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ARTIFACTS)) {
        const store = db.createObjectStore(STORE_ARTIFACTS, { keyPath: 'id' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
    },
  });
  
  return dbPromise;
};
