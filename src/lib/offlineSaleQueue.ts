import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const QUEUE_KEY = 'offline_sale_queue';

export interface OfflineSalePayload {
  id: string;
  cartItems: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    cost_per_unit: number;
    subtotal: number;
    original_subtotal: number;
    item_discount_type?: 'percentage' | 'fixed';
    item_discount_value?: number;
    item_discount_amount?: number;
    item_discount_scope?: 'per_unit' | 'total';
    unit_id?: string | null;
    currency_id?: string | null;
  }>;
  customerId: string;
  customerName?: string;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'other';
  saleDate: string;
  totalAmount: number;
  businessId: string;
  createdBy: string;
  deliveryCost?: number;
  notes?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  queuedAt: string;
  status: 'pending' | 'syncing' | 'failed';
  failureReason?: string;
  cartId?: string;
}

export const offlineSaleQueue = {
  async getAll(): Promise<OfflineSalePayload[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async getByBusiness(businessId: string): Promise<OfflineSalePayload[]> {
    const all = await this.getAll();
    return all.filter(s => s.businessId === businessId);
  },

  async getCount(): Promise<number> {
    const all = await this.getAll();
    return all.filter(s => s.status === 'pending').length;
  },

  async add(sale: Omit<OfflineSalePayload, 'id' | 'queuedAt' | 'status'>): Promise<OfflineSalePayload> {
    const entry: OfflineSalePayload = {
      ...sale,
      id: uuidv4(),
      queuedAt: new Date().toISOString(),
      status: 'pending',
    };
    const queue = await this.getAll();
    queue.push(entry);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return entry;
  },

  async updateStatus(id: string, status: OfflineSalePayload['status'], failureReason?: string): Promise<void> {
    const queue = await this.getAll();
    const idx = queue.findIndex(s => s.id === id);
    if (idx >= 0) {
      queue[idx].status = status;
      if (failureReason) queue[idx].failureReason = failureReason;
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  },

  async remove(id: string): Promise<void> {
    const queue = await this.getAll();
    const filtered = queue.filter(s => s.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },

  async getPendingSales(): Promise<OfflineSalePayload[]> {
    const all = await this.getAll();
    return all.filter(s => s.status === 'pending');
  },

  async getFailedSales(): Promise<OfflineSalePayload[]> {
    const all = await this.getAll();
    return all.filter(s => s.status === 'failed');
  },
};
