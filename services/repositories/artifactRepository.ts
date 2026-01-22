
import { Artifact } from "../../types/sync";
import { initDB, STORE_ARTIFACTS } from "./baseRepository";

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
