import { Artifact } from '../../types/sync';
import { initDB, STORE_ARTIFACTS } from './baseRepository';

export const saveArtifact = async (artifact: Artifact): Promise<void> => {
  const db = await initDB();
  await db.put(STORE_ARTIFACTS, artifact);
};

export const getArtifact = async (id: string): Promise<Artifact | null> => {
  const db = await initDB();
  return (await db.get(STORE_ARTIFACTS, id)) || null;
};

export const getProjectArtifacts = async (projectId: string): Promise<Artifact[]> => {
  const db = await initDB();
  return db.getAllFromIndex(STORE_ARTIFACTS, 'projectId', projectId);
};
