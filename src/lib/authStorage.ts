import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;

function getSupabaseStorageKey(): string {
  const url = new URL(supabaseUrl);
  const projectRef = url.hostname.split('.')[0];
  return `sb-${projectRef}-auth-token`;
}

export async function clearAuthStorage(): Promise<void> {
  const supabaseStorageKey = getSupabaseStorageKey();

  if (Platform.OS === 'web') {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const supabaseKeys = allKeys.filter(
        key =>
          key.includes('supabase') ||
          key.includes('sb-') ||
          key.includes('auth-token') ||
          key.includes('auth.token'),
      );
      if (!supabaseKeys.includes(supabaseStorageKey)) {
        supabaseKeys.push(supabaseStorageKey);
      }
      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
      }
      await AsyncStorage.removeItem(supabaseStorageKey);
    } catch (error) {
      console.error('clearAuthStorage: Error clearing web storage:', error);
    }
  } else {
    const possibleKeys = [
      supabaseStorageKey,
      'supabase.auth.token',
      `${supabaseUrl}-auth-token`,
      `sb-${supabaseUrl}-auth-token`,
      'sb-auth-token',
    ];
    for (const key of possibleKeys) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // key doesn't exist
      }
    }
  }
}

export async function verifySessionCleared(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session === null;
  } catch {
    return false;
  }
}

export async function updateLastActivityTimestamp(): Promise<void> {
  try {
    await AsyncStorage.setItem('lastActivityTimestamp', Date.now().toString());
  } catch (error) {
    console.error('Error updating last activity timestamp:', error);
  }
}

export async function getLastActivityTimestamp(): Promise<number | null> {
  try {
    const value = await AsyncStorage.getItem('lastActivityTimestamp');
    return value ? parseInt(value, 10) : null;
  } catch {
    return null;
  }
}
