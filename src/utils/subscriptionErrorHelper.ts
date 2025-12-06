const SUBSCRIPTION_ERROR_CODES = [
  'SUBSCRIPTION_LIMIT_REACHED',
  'BUSINESS_READ_ONLY',
  'BUSINESS_SALES_LIMIT',
  'BUSINESS_LIMIT_EXCEEDED',
];

const SUBSCRIPTION_ERROR_KEYWORDS = [
  'free limit',
  'upgrade',
  'subscription',
  'limit reached',
  'read-only mode',
];

export function isSubscriptionRelatedError(error: string | undefined | null): boolean {
  if (!error) return false;

  const errorLower = error.toLowerCase();

  return SUBSCRIPTION_ERROR_CODES.some(code => error.includes(code)) ||
    SUBSCRIPTION_ERROR_KEYWORDS.some(keyword => errorLower.includes(keyword));
}
