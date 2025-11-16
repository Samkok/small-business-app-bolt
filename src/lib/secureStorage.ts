import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'business-manager-pro-encryption-key-v1';

export class SecureStorage {
  private static encryptData(data: string): string {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  }

  private static decryptData(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  static async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        const encrypted = this.encryptData(value);
        await AsyncStorage.setItem(key, encrypted);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error('SecureStorage setItem error:', error);
      throw new Error('Failed to store secure data');
    }
  }

  static async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        const encrypted = await AsyncStorage.getItem(key);
        if (!encrypted) return null;
        return this.decryptData(encrypted);
      } else {
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error('SecureStorage getItem error:', error);
      return null;
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error('SecureStorage removeItem error:', error);
    }
  }

  static async setObject(key: string, value: any): Promise<void> {
    const jsonString = JSON.stringify(value);
    await this.setItem(key, jsonString);
  }

  static async getObject<T>(key: string): Promise<T | null> {
    const jsonString = await this.getItem(key);
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error('SecureStorage getObject parse error:', error);
      return null;
    }
  }

  static async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.clear();
      } else {
        const keys = ['savedEmail', 'rememberMe', 'lastActivityTimestamp'];
        for (const key of keys) {
          await SecureStore.deleteItemAsync(key);
        }
      }
    } catch (error) {
      console.error('SecureStorage clear error:', error);
    }
  }
}

export async function setRememberMeCredentials(email: string): Promise<void> {
  await SecureStorage.setItem('savedEmail', email);
  await SecureStorage.setItem('rememberMe', 'true');
}

export async function getRememberMeCredentials(): Promise<{
  email: string | null;
  rememberMe: boolean;
}> {
  const email = await SecureStorage.getItem('savedEmail');
  const rememberMe = await SecureStorage.getItem('rememberMe');

  return {
    email,
    rememberMe: rememberMe === 'true',
  };
}

export async function clearRememberMeCredentials(): Promise<void> {
  await SecureStorage.removeItem('savedEmail');
  await SecureStorage.removeItem('rememberMe');
}
