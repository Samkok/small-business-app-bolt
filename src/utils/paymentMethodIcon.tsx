import React from 'react';
import { Banknote, CreditCard, Landmark, Wallet } from 'lucide-react-native';

/**
 * Payment-method icons as vector glyphs. The emoji used before (🏦 for transfer, 💰 for
 * other) render as "?" boxes on devices whose emoji font lacks them.
 */
export function PaymentMethodIcon({ method, size = 18, color = '#6b7280' }: { method: string; size?: number; color?: string }) {
  switch (method) {
    case 'cash':
      return <Banknote size={size} color={color} />;
    case 'card':
      return <CreditCard size={size} color={color} />;
    case 'transfer':
      return <Landmark size={size} color={color} />;
    default:
      return <Wallet size={size} color={color} />;
  }
}
