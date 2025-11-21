import AsyncStorage from '@react-native-async-storage/async-storage';

const BUSINESS_ACCESS_HISTORY_KEY = '@business_access_history';

export interface BusinessAccessHistory {
  [businessId: string]: number;
}

export const businessAccessHistoryService = {
  async getHistory(): Promise<BusinessAccessHistory> {
    try {
      const historyJson = await AsyncStorage.getItem(BUSINESS_ACCESS_HISTORY_KEY);
      if (historyJson) {
        return JSON.parse(historyJson);
      }
      return {};
    } catch (error) {
      console.error('Error loading business access history:', error);
      return {};
    }
  },

  async updateAccess(businessId: string): Promise<void> {
    try {
      const history = await this.getHistory();
      history[businessId] = Date.now();
      await AsyncStorage.setItem(BUSINESS_ACCESS_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error updating business access history:', error);
    }
  },

  async removeBusinessFromHistory(businessId: string): Promise<void> {
    try {
      const history = await this.getHistory();
      delete history[businessId];
      await AsyncStorage.setItem(BUSINESS_ACCESS_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error removing business from history:', error);
    }
  },

  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BUSINESS_ACCESS_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing business access history:', error);
    }
  },

  getMostRecentBusiness(
    availableBusinessIds: string[],
    history: BusinessAccessHistory
  ): string | null {
    if (availableBusinessIds.length === 0) {
      return null;
    }

    const businessesWithAccess = availableBusinessIds
      .map(id => ({
        id,
        lastAccess: history[id] || 0,
      }))
      .sort((a, b) => b.lastAccess - a.lastAccess);

    return businessesWithAccess[0].id;
  },
};
