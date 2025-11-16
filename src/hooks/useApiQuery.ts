import { useState, useEffect, useCallback } from 'react';
import { AppError, logger } from '../lib';

interface UseApiQueryResult<T> {
  data: T | null;
  error: AppError | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

interface UseApiQueryOptions {
  enabled?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: AppError) => void;
}

export function useApiQuery<T>(
  queryFn: () => Promise<T>,
  deps: React.DependencyList = [],
  options: UseApiQueryOptions = {}
): UseApiQueryResult<T> {
  const { enabled = true, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await queryFn();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const appError = err instanceof AppError ? err : new AppError(
        err instanceof Error ? err.message : 'Unknown error',
        'UNKNOWN_ERROR'
      );
      setError(appError);
      onError?.(appError);
      logger.error('Query failed', appError);
    } finally {
      setLoading(false);
    }
  }, [enabled, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    error,
    loading,
    refetch: fetchData,
  };
}
