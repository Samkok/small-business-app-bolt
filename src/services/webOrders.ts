import { Alert } from 'react-native';
import { supabase } from '../config/supabase';
import i18n from '../locales';

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
   * Where a "new online order" notification should land:
   *  - the cart, while the order is still waiting in Active Carts
   *  - the sale, once the shop has checked it out
   *  - Active Carts with a short explanation, when the cart was deleted or expired
   */
  async notificationTarget(cartId: string | null | undefined, kind?: string | null): Promise<string> {
    // The daily "unusual number of online orders" alert is about no order in particular
    if (kind === 'spike') return ACTIVE_CARTS_ROUTE;
    if (cartId) {
      try {
        const { data: cart } = await supabase.from('carts').select('id, status').eq('id', cartId).maybeSingle();
        const status = (cart as any)?.status;
        if (status === 'active') return `/(app)/(tabs)/sales/cart/${cartId}`;
        if (status === 'completed') {
          const { data: sale } = await supabase.from('sales').select('id').eq('cart_id', cartId).maybeSingle();
          if ((sale as any)?.id) return `/(app)/(tabs)/sales/details/${(sale as any).id}`;
        }
      } catch (error) {
        console.error('Error checking web order cart:', error);
      }
    }
    // Say why the order is not opening, once the destination screen is up
    setTimeout(() => {
      Alert.alert(i18n.t('onlineMenu.orderGoneTitle'), i18n.t('onlineMenu.orderGone'));
    }, 600);
    return ACTIVE_CARTS_ROUTE;
  },

  /** Numbers this business has blocked from web ordering, newest first. */
  async listBlockedPhones(businessId: string): Promise<{ phone: string; created_at: string }[]> {
    const { data, error } = await supabase
      .from('web_order_blocked_phones' as any)
      .select('phone, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as any[]) || [];
  },

  /** Whether this phone number is on the business's block list. */
  async isPhoneBlocked(businessId: string, phone: string | null | undefined): Promise<boolean> {
    const normalized = normalizeMenuPhone(phone);
    if (!normalized) return false;
    const { data, error } = await supabase
      .from('web_order_blocked_phones' as any)
      .select('phone')
      .eq('business_id', businessId)
      .eq('phone', normalized)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  },

  /** Let a blocked number order from the online menu again. */
  async unblockPhone(businessId: string, phone: string): Promise<void> {
    const { error } = await supabase
      .from('web_order_blocked_phones' as any)
      .delete()
      .eq('business_id', businessId)
      .eq('phone', phone);
    if (error) throw error;
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
