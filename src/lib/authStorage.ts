import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

export async function clearAuthStorage(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const supabaseKeys = allKeys.filter(
      key =>
        key.includes('supabase') ||
        key.includes('sb-') ||
        key.includes('auth-token') ||
        key.includes('auth.token'),
    );
    if (supabaseKeys.length > 0) {
      await AsyncStorage.multiRemove(supabaseKeys);
    }
  } catch (error) {
    console.error('clearAuthStorage: Error clearing storage:', error);
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
