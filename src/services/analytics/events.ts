/**
 * The fixed catalogue of events the app reports to outside tools. Screens call
 * `analytics.track(...)` with one of these names only, so the list stays small and the
 * names never drift between the app, PostHog and Meta.
 *
 * Two audiences:
 *  - Meta ads: only the steps of OUR funnel (install → sign-up → business → first sale →
 *    paywall → checkout → trial → subscribe), so Meta can find more people like our best
 *    users. Never anything about a shop's own sales, products or customers.
 *  - PostHog (when connected): the same events plus product usage, for our own reporting.
 */

export const ANALYTICS_EVENTS = {
  /** account created (sign-up form accepted) */
  signUpCompleted: 'sign_up_completed',
  /** first business created in onboarding */
  businessCreated: 'business_created',
  /** the first completed sale of a business */
  firstSale: 'first_sale',
  /** the paywall was shown */
  paywallViewed: 'paywall_viewed',
  /** the store purchase sheet is about to open */
  checkoutStarted: 'checkout_started',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Properties allowed on events. Nothing personal: no names, phones, emails or free text. */
export interface AnalyticsProps {
  business_id?: string;
  plan?: string;
  product_id?: string;
  role?: 'owner' | 'member';
  platform?: string;
  app_version?: string;
}

/** Which Meta standard event each of ours maps to; events not listed are never sent to Meta. */
export const META_EVENT_NAMES: Partial<Record<AnalyticsEvent, { standard?: 'CompletedRegistration' | 'ViewedContent' | 'InitiatedCheckout'; custom?: string }>> = {
  sign_up_completed: { standard: 'CompletedRegistration' },
  business_created: { custom: 'BusinessCreated' },
  first_sale: { custom: 'FirstSale' },
  paywall_viewed: { standard: 'ViewedContent' },
  checkout_started: { standard: 'InitiatedCheckout' },
};
