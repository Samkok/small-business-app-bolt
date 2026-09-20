/**
 * The public online-menu website (separate project: bizmanage_menu).
 *
 * The address is built in. It used to come only from EXPO_PUBLIC_MENU_URL, which lives in the
 * git-ignored .env, so every build not bundled on the developer's machine (EAS, TestFlight,
 * a team member's phone) had no address and silently hid the whole feature.
 * EXPO_PUBLIC_MENU_URL still overrides it, e.g. to point a test build at a staging site.
 */
const DEFAULT_MENU_URL = 'https://bizmanagemenu.vercel.app';

export const MENU_URL = ((process.env.EXPO_PUBLIC_MENU_URL || '').trim() || DEFAULT_MENU_URL).replace(/\/+$/, '');

/** Always true now that a default exists; kept so callers read naturally. */
export const isMenuSiteConfigured = MENU_URL.length > 0;

/** What the shop shares with customers. */
export const menuLink = (slug: string) => `${MENU_URL}/${slug}`;
/** 1024 px PNG of the QR code, rendered by the site (404 until the menu is enabled). */
export const menuQrImageUrl = (slug: string) => `${MENU_URL}/${slug}/qr.png`;
/** Printable poster page with the QR code. */
export const menuPosterUrl = (slug: string) => `${MENU_URL}/${slug}/qr`;
