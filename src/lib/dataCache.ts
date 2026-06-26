import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'data_cache_';
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  businessId: string;
}

export const dataCache = {
  async set<T>(key: string, businessId: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      businessId,
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}_${businessId}`, JSON.stringify(entry));
  },

  async get<T>(key: string, businessId: string, maxAge: number = DEFAULT_MAX_AGE): Promise<{ data: T; isStale: boolean } | null> {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}_${businessId}`);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      const age = Date.now() - entry.timestamp;
      return {
        data: entry.data,
        isStale: age > maxAge,
      };
    } catch {
      return null;
    }
  },

  async clear(key: string, businessId: string): Promise<void> {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}_${businessId}`);
  },

  async clearAll(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  },
};
