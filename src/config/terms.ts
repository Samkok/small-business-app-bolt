/**
 * The version of the Terms of Service the app currently shows (app/(auth)/terms.tsx and
 * settings/terms.tsx print the same number). Raise it together with the terms text: users
 * whose profile records an older accepted version are asked to read and accept again on
 * their next launch (src/components/TermsUpdatePrompt.tsx).
 */
export const TERMS_VERSION = '1.5.0';
export const TERMS_UPDATED_ON = 'October 6, 2026';
/** The Privacy Policy version that goes with these terms (settings/privacy.tsx prints it). */
export const PRIVACY_VERSION = '2.0.0';

/** What changed since the previous version, shown in the prompt. Keep it to a few lines. */
export const TERMS_CHANGE_SUMMARY = [
  'Privacy Policy 2.0.0: the app reports a few sign-up and subscription steps to our advertising partner to measure our own ads, and explains the usage data we may collect later to improve the app.',
  'Your sales, products, customers and reports are never shared with advertising or analytics partners.',
  'On iOS you will be asked whether to allow tracking. Saying no changes nothing in the app.',
  'The full list of service providers, and how the online menu handles your customers\' data, are now in the Privacy Policy.',
];
