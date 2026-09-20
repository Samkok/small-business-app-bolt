import { supabase } from '../config/supabase';

/**
 * Same normalisation as menu_normalize_phone() on the server: digits only, and a leading
 * Cambodian country code (855) becomes 0, so "+855 12 000 111" and "012000111" match.
 */
export function normalizeMenuPhone(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('855') && digits.length >= 11) return `0${digits.slice(3)}`;
  return digits;
}

export const ACTIVE_CARTS_ROUTE = '/(app)/(tabs)/sales?tab=carts';

export const webOrderService = {
  /**
   * Where a "new online order" notification should land: the cart itself while it is
   * still active, otherwise Active Carts (it was checked out, deleted or expired).
   */
  async notificationTarget(cartId: string | null | undefined): Promise<string> {
    if (!cartId) return ACTIVE_CARTS_ROUTE;
    try {
      const { data } = await supabase.from('carts').select('id, status').eq('id', cartId).maybeSingle();
      if ((data as any)?.status === 'active') return `/(app)/(tabs)/sales/cart/${cartId}`;
    } catch (error) {
      console.error('Error checking web order cart:', error);
    }
    return ACTIVE_CARTS_ROUTE;
  },

  /** Stop this phone number from placing web orders with this business. */
  async blockPhone(businessId: string, phone: string, userId: string | null | undefined): Promise<void> {
    const normalized = normalizeMenuPhone(phone);
    if (!normalized) throw new Error('No phone number to block');
    const { error } = await supabase
      .from('web_order_blocked_phones' as any)
      .upsert(
        { business_id: businessId, phone: normalized, created_by: userId ?? null } as any,
        { onConflict: 'business_id,phone', ignoreDuplicates: true }
      );
    if (error) throw error;
  },
};
