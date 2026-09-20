/**
 * The public online-menu website (separate project: bizmanage_menu).
 * EXPO_PUBLIC_MENU_URL is its address without a trailing slash. While it is empty the
 * site is not deployed, so everything that would hand out a link stays hidden.
 */
export const MENU_URL = (process.env.EXPO_PUBLIC_MENU_URL || '').trim().replace(/\/+$/, '');

export const isMenuSiteConfigured = MENU_URL.length > 0;

/** What the shop shares with customers. */
export const menuLink = (slug: string) => `${MENU_URL}/${slug}`;
/** 1024 px PNG of the QR code, rendered by the site (404 until the menu is enabled). */
export const menuQrImageUrl = (slug: string) => `${MENU_URL}/${slug}/qr.png`;
/** Printable poster page with the QR code. */
export const menuPosterUrl = (slug: string) => `${MENU_URL}/${slug}/qr`;
