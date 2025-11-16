import { useCallback, useRef, useEffect } from 'react';

interface BatchUpdateOptions<T> {
  delay: number;
  onFlush: (updates: Map<string, T>) => Promise<void>;
}

export function useBatchUpdate<T>({ delay, onFlush }: BatchUpdateOptions<T>) {
  const updatesRef = useRef<Map<string, T>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFlushing = useRef(false);

  const flush = useCallback(async () => {
    if (isFlushing.current || updatesRef.current.size === 0) {
      return;
    }

    isFlushing.current = true;
    const updates = new Map(updatesRef.current);
    updatesRef.current.clear();

    try {
      await onFlush(updates);
    } catch (error) {
      console.error('Error flushing batch updates:', error);
      updatesRef.current = new Map([...updatesRef.current, ...updates]);
    } finally {
      isFlushing.current = false;
    }
  }, [onFlush]);

  const scheduleFlush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      flush();
    }, delay);
  }, [delay, flush]);

  const addUpdate = useCallback((key: string, value: T) => {
    updatesRef.current.set(key, value);
    scheduleFlush();
  }, [scheduleFlush]);

  const flushNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    return flush();
  }, [flush]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (updatesRef.current.size > 0) {
        flush();
      }
    };
  }, [flush]);

  return {
    addUpdate,
    flushNow,
    hasPendingUpdates: () => updatesRef.current.size > 0
  };
}
