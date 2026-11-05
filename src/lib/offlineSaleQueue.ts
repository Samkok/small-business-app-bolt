import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase';

// One queue per account: a sale queued by user A must never be shown to, failed by or
// replayed as user B on the same device. Builds before 2.12 used a single shared key; its
// entries are moved into the queue of the account that recorded them on first read.
const LEGACY_QUEUE_KEY = 'offline_sale_queue';
const queueKeyFor = (userId: string) => `offline_sale_queue:${userId}`;

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function readQueue(key: string): Promise<OfflineSalePayload[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

let legacyMigrated = false;
async function migrateLegacyQueue(): Promise<void> {
  if (legacyMigrated) return;
  legacyMigrated = true;
  const legacy = await readQueue(LEGACY_QUEUE_KEY);
  if (legacy.length === 0) {
    await AsyncStorage.removeItem(LEGACY_QUEUE_KEY).catch(() => {});
    return;
  }
  const byUser = new Map<string, OfflineSalePayload[]>();
  for (const sale of legacy) {
    if (!sale?.createdBy) continue;
    const list = byUser.get(sale.createdBy) ?? [];
    list.push(sale);
    byUser.set(sale.createdBy, list);
  }
  for (const [userId, sales] of byUser) {
    const existing = await readQueue(queueKeyFor(userId));
    const ids = new Set(existing.map(s => s.id));
    await AsyncStorage.setItem(queueKeyFor(userId), JSON.stringify([...existing, ...sales.filter(s => !ids.has(s.id))]));
  }
  await AsyncStorage.removeItem(LEGACY_QUEUE_KEY).catch(() => {});
}

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
  /** PAID or COD, chosen at checkout; absent on sales queued by older app versions */
  paymentStatus?: 'paid' | 'cod';
  saleDate: string;
  totalAmount: number;
  businessId: string;
  createdBy: string;
  deliveryCost?: number;
  /** delivery fee charged to the customer (carts.delivery_charge); absent on older queued sales */
  deliveryCharge?: number;
  notes?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  queuedAt: string;
  status: 'pending' | 'syncing' | 'failed';
  failureReason?: string;
  cartId?: string;
}

export const offlineSaleQueue = {
  /** The signed-in account's queue; empty when nobody is signed in. */
  async getAll(): Promise<OfflineSalePayload[]> {
    const userId = await currentUserId();
    if (!userId) return [];
    await migrateLegacyQueue();
    return readQueue(queueKeyFor(userId));
  },

  async save(queue: OfflineSalePayload[]): Promise<void> {
    const userId = await currentUserId();
    if (!userId) return;
    await AsyncStorage.setItem(queueKeyFor(userId), JSON.stringify(queue));
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
    await this.save(queue);
    return entry;
  },

  async updateStatus(id: string, status: OfflineSalePayload['status'], failureReason?: string): Promise<void> {
    const queue = await this.getAll();
    const idx = queue.findIndex(s => s.id === id);
    if (idx >= 0) {
      queue[idx].status = status;
      if (failureReason) queue[idx].failureReason = failureReason;
      await this.save(queue);
    }
  },

  async remove(id: string): Promise<void> {
    const queue = await this.getAll();
    const filtered = queue.filter(s => s.id !== id);
    await this.save(filtered);
  },

  async clear(): Promise<void> {
    const userId = await currentUserId();
    if (userId) await AsyncStorage.removeItem(queueKeyFor(userId));
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
