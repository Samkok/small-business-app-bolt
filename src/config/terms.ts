/**
 * The version of the Terms of Service the app currently shows (app/(auth)/terms.tsx and
 * settings/terms.tsx print the same number). Raise it together with the terms text: users
 * whose profile records an older accepted version are asked to read and accept again on
 * their next launch (src/components/TermsUpdatePrompt.tsx).
 */
export const TERMS_VERSION = '1.4.0';
export const TERMS_UPDATED_ON = 'September 21, 2026';

/** What changed since the previous version, shown in the prompt. Keep it to a few lines. */
export const TERMS_CHANGE_SUMMARY = [
  'A new section 21 covers the Online Menu and web orders.',
  'BizManage only passes an order to the shop. It takes no payment and is not a party to the sale.',
  'Any payment, delivery, refund or dispute is between the shop and its customer.',
];
