import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Custom storage adapter that uses SecureStore on native platforms
// and falls back to AsyncStorage on web
class CustomStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = Platform.OS === 'web'
        ? await AsyncStorage.getItem(key)
        : await SecureStore.getItemAsync(key);

      console.log(`CustomStorageAdapter.getItem(${key}):`, value ? 'found' : 'not found');
      return value;
    } catch (error) {
      console.error(`CustomStorageAdapter.getItem(${key}) error:`, error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
      console.log(`CustomStorageAdapter.setItem(${key}): success`);
    } catch (error) {
      console.error(`CustomStorageAdapter.setItem(${key}) error:`, error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
      console.log(`CustomStorageAdapter.removeItem(${key}): success`);
    } catch (error) {
      console.error(`CustomStorageAdapter.removeItem(${key}) error:`, error);
    }
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: new CustomStorageAdapter(),
  },
});