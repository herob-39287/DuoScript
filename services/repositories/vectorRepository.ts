
import { VectorEntry } from "../../types";
import { initDB, STORE_VECTORS } from "./baseRepository";

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
