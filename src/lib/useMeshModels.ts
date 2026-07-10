import { useState, useEffect } from 'react';

// In-memory cache to prevent multiple fetches during the same session
let cachedModels: any[] | null = null;
let isFetching = false;
let fetchPromise: Promise<any[]> | null = null;

export function useMeshModels(apiKey: string) {
  const [models, setModels] = useState<any[]>(cachedModels || []);
  const [isLoading, setIsLoading] = useState(!cachedModels && !!apiKey);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) {
      setModels([]);
      return;
    }

    if (cachedModels) {
      setModels(cachedModels);
      setIsLoading(false);
      return;
    }

    if (isFetching && fetchPromise) {
      fetchPromise.then((data) => {
        setModels(data);
        setIsLoading(false);
      }).catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
      return;
    }

    isFetching = true;
    setIsLoading(true);

    fetchPromise = fetch('/api/mesh/models', {
      headers: { "Authorization": `Bearer ${apiKey}` }
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch models");
        const data = await res.json();
        let fetchedModels: any[] = [];
        if (Array.isArray(data)) fetchedModels = data;
        else if (data?.data && Array.isArray(data.data)) fetchedModels = data.data;
        else if (data?.models && Array.isArray(data.models)) fetchedModels = data.models;
        
        cachedModels = fetchedModels;
        setModels(fetchedModels);
        setIsLoading(false);
        isFetching = false;
        return fetchedModels;
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
        isFetching = false;
        throw err;
      });
  }, [apiKey]);

  return { models, isLoading, error };
}
