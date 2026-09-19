/**
 * Whether the customer has paid for a sale or will pay on delivery.
 * Stored in sales.payment_status ('paid' | 'cod'); NULL on sales made before the
 * field existed, which the app shows as "not set" rather than guessing.
 */
export type PaymentStatus = 'paid' | 'cod';

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string; title: string; hint: string }[] = [
  { value: 'paid', label: 'PAID', title: 'Paid', hint: 'The customer has already paid' },
  { value: 'cod', label: 'COD', title: 'Cash on delivery', hint: 'Collect the money when the parcel arrives' },
];

export const isPaymentStatus = (v: unknown): v is PaymentStatus => v === 'paid' || v === 'cod';

/** 'PAID' / 'COD', or null when the sale has no status recorded. */
export const paymentStatusLabel = (v: unknown): string | null =>
  isPaymentStatus(v) ? (v === 'paid' ? 'PAID' : 'COD') : null;
