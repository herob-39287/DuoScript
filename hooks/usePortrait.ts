
import { useState, useEffect, useCallback } from 'react';
import { getPortrait } from '../services/storageService';

export const usePortrait = (charId: string, initialUrl?: string) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchPortrait = useCallback(async () => {
    // If initialUrl is already a data URI, use it directly (e.g. newly generated)
    if (initialUrl && initialUrl.startsWith('data:')) {
      setImageUrl(initialUrl);
      return;
    }

    if (!charId) {
      setImageUrl(null);
      return;
    }

    setIsLoading(true);
    setError(false);
    try {
      // Treat charId as the key for portrait lookup
      const data = await getPortrait(charId);
      if (data) {
        setImageUrl(data);
      } else {
        setImageUrl(null);
      }
    } catch (e) {
      console.error(`Failed to load portrait for ${charId}`, e);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [charId, initialUrl]);

  useEffect(() => {
    fetchPortrait();
  }, [fetchPortrait]);

  return { imageUrl, isLoading, error, reload: fetchPortrait };
};
