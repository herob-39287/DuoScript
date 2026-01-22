
import { AssetMetadata } from "../../types";
import { initDB, STORE_PORTRAITS } from "./baseRepository";

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
