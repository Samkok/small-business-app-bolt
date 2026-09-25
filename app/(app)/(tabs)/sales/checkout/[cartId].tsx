import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Checkout lives on the cart screen since 2026-09-25 (one screen: items, delivery, payment,
 * PAID/COD, Complete Sale / Save draft). This route stays so older links and notifications
 * that pointed at /sales/checkout/<cartId> still open the right cart.
 */
export default function CheckoutRedirect() {
  const { cartId } = useLocalSearchParams();
  return <Redirect href={`/sales/cart/${cartId}` as any} />;
}
