import { useState, useCallback } from 'react';
import { AppError, logger } from '../lib';

interface UseApiMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData | null>;
  data: TData | null;
  error: AppError | null;
  loading: boolean;
  reset: () => void;
}

interface UseApiMutationOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: AppError) => void;
}

export function useApiMutation<TData = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseApiMutationOptions<TData> = {}
): UseApiMutationResult<TData, TVariables> {
  const { onSuccess, onError } = options;
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables);
        setData(result);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const appError = err instanceof AppError ? err : new AppError(
          err instanceof Error ? err.message : 'Unknown error',
          'UNKNOWN_ERROR'
        );
        setError(appError);
        onError?.(appError);
        logger.error('Mutation failed', appError);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    mutate,
    data,
    error,
    loading,
    reset,
  };
}
