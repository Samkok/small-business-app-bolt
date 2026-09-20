/**
 * Who pays the courier.
 *  - 'shop'     : free delivery for the customer. The fee is carts.delivery_cost, it is deducted
 *                 from the sale and reported as a fee, and the receipt says FREE.
 *  - 'customer' : the customer is charged. The fee is carts.delivery_charge, nothing is deducted
 *                 from the shop (money-wise the sale is as if delivery were 0), and the receipt
 *                 adds the fee to the total.
 * Only one of the two amounts is ever positive.
 */
export type DeliveryPayer = 'shop' | 'customer';

export const DELIVERY_PAYERS: DeliveryPayer[] = ['customer', 'shop'];

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Read the payer and the amount back from what is stored. No fee at all reads as 'shop'. */
export function readDelivery(deliveryCost: unknown, deliveryCharge: unknown): { payer: DeliveryPayer; amount: number } {
  const charge = num(deliveryCharge);
  if (charge > 0) return { payer: 'customer', amount: charge };
  return { payer: 'shop', amount: num(deliveryCost) };
}

/** The two stored columns for a payer and an amount. */
export function deliveryColumns(payer: DeliveryPayer, amount: unknown): { delivery_cost: number; delivery_charge: number } {
  const value = Math.round(num(amount) * 100) / 100;
  return payer === 'customer'
    ? { delivery_cost: 0, delivery_charge: value }
    : { delivery_cost: value, delivery_charge: 0 };
}
