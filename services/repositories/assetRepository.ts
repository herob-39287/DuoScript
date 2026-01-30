import { AssetMetadata } from '../../types';
import { initDB, STORE_PORTRAITS } from './baseRepository';

export const savePortrait = async (
  projectId: string,
  charId: string,
  base64: string,
): Promise<void> => {
  const db = await initDB();
  const asset: AssetMetadata & { data: string } = {
    id: charId,
    projectId,
    type: 'portrait',
    size: base64.length,
    mimeType: 'image/png',
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    data: base64,
  };
  await db.put(STORE_PORTRAITS, asset);
};

export const getPortrait = async (charId: string): Promise<string | null> => {
  const db = await initDB();
  const result = await db.get(STORE_PORTRAITS, charId);
  return result?.data || null;
};

export const deletePortrait = async (charId: string): Promise<void> => {
  const db = await initDB();
  await db.delete(STORE_PORTRAITS, charId);
};

export const getAllAssetMetadata = async (projectId?: string): Promise<AssetMetadata[]> => {
  const db = await initDB();
  const allAssets = await db.getAll(STORE_PORTRAITS);

  const results = projectId ? allAssets.filter((a: any) => a.projectId === projectId) : allAssets;

  return results.map(({ data, ...meta }: any) => meta);
};
