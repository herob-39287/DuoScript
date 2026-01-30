import { VectorEntry } from '../../types';
import { initDB, STORE_VECTORS } from './baseRepository';

export const saveVectors = async (entries: VectorEntry[]): Promise<void> => {
  if (entries.length === 0) return;
  const db = await initDB();
  const tx = db.transaction(STORE_VECTORS, 'readwrite');
  await Promise.all(entries.map((entry) => tx.store.put(entry)));
  await tx.done;
};

export const getProjectVectors = async (projectId: string): Promise<VectorEntry[]> => {
  const db = await initDB();
  return db.getAllFromIndex(STORE_VECTORS, 'projectId', projectId);
};

export const deleteVectors = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const db = await initDB();
  const tx = db.transaction(STORE_VECTORS, 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
};
