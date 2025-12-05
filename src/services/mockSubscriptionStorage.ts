import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const MOCK_MODE_KEY = 'mock_iap_enabled';

export const mockSubscriptionStorage = {
  async isMockModeEnabled(): Promise<boolean> {
    try {
      let value: string | null;
      if (Platform.OS === 'web') {
        value = localStorage.getItem(MOCK_MODE_KEY);
      } else {
        value = await SecureStore.getItemAsync(MOCK_MODE_KEY);
      }
      return value === 'true';
    } catch (error) {
      console.error('Error checking mock mode:', error);
      return false;
    }
  },

  async setMockModeEnabled(enabled: boolean): Promise<void> {
    try {
      const value = enabled ? 'true' : 'false';
      if (Platform.OS === 'web') {
        localStorage.setItem(MOCK_MODE_KEY, value);
      } else {
        await SecureStore.setItemAsync(MOCK_MODE_KEY, value);
      }
    } catch (error) {
      console.error('Error setting mock mode:', error);
    }
  },
};
