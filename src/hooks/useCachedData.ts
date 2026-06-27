import { useState, useEffect, useCallback, useRef } from 'react';
import { dataCache } from '../lib/dataCache';
import { useNetwork } from '../context/NetworkContext';

interface UseCachedDataOptions<T> {
  cacheKey: string;
  businessId: string | undefined;
  fetchFn: () => Promise<T>;
  maxItems?: number;
  enabled?: boolean;
}

interface UseCachedDataResult<T> {
  data: T | null;
  loading: boolean;
  isStale: boolean;
  isFromCache: boolean;
  refresh: () => Promise<void>;
}

export function useCachedData<T>({
  cacheKey,
  businessId,
  fetchFn,
  maxItems,
  enabled = true,
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const { isConnected, wasOffline } = useNetwork();
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadFromCacheAndFetch = useCallback(async () => {
    if (!businessId || !enabled) {
      setLoading(false);
      return;
    }

    // Step 1: Try cache first
    const cached = await dataCache.get<T>(cacheKey, businessId);
    if (cached && isMountedRef.current) {
      setData(cached.data);
      setIsStale(cached.isStale);
      setIsFromCache(true);
      setLoading(false);
    }

    // Step 2: If online, fetch fresh data
    if (!isConnected) {
      if (!cached && isMountedRef.current) {
        setLoading(false);
      }
      return;
    }

    try {
      const freshData = await fetchFn();
      if (!isMountedRef.current) return;

      // Apply maxItems cap if it's an array
      let cappedData = freshData;
      if (maxItems && Array.isArray(freshData)) {
        cappedData = freshData.slice(0, maxItems) as unknown as T;
      }

      setData(cappedData);
      setIsStale(false);
      setIsFromCache(false);
      setLoading(false);
      hasFetchedRef.current = true;

      // Persist to cache
      await dataCache.set(cacheKey, businessId, cappedData);
    } catch (error) {
      // Network fetch failed - keep cached data if we have it
      if (!cached && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [businessId, cacheKey, enabled, fetchFn, isConnected, maxItems]);

  // Initial load
  useEffect(() => {
    hasFetchedRef.current = false;
    setLoading(true);
    loadFromCacheAndFetch();
  }, [businessId, cacheKey, enabled]);

  // Auto-refetch when coming back online
  useEffect(() => {
    if (wasOffline && isConnected && businessId && enabled) {
      loadFromCacheAndFetch();
    }
  }, [wasOffline, isConnected]);

  const refresh = useCallback(async () => {
    if (!businessId || !enabled) return;

    if (!isConnected) return;

    try {
      const freshData = await fetchFn();
      if (!isMountedRef.current) return;

      let cappedData = freshData;
      if (maxItems && Array.isArray(freshData)) {
        cappedData = freshData.slice(0, maxItems) as unknown as T;
      }

      setData(cappedData);
      setIsStale(false);
      setIsFromCache(false);
      await dataCache.set(cacheKey, businessId, cappedData);
    } catch {
      // silently fail on refresh
    }
  }, [businessId, cacheKey, enabled, fetchFn, isConnected, maxItems]);

  return { data, loading, isStale, isFromCache, refresh };
}
