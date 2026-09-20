import { z } from 'zod';

/** Names the menu website keeps for its own pages (mirrors businesses_menu_slug_not_reserved). */
export const RESERVED_MENU_SLUGS = [
  'api', 'admin', 'app', 'menu', 'order', 'orders', 'refer', 'privacy', 'terms',
  'contact', 'about', 'login', 'signup', 'www', 'static', 'help', 'support',
  'bizmanage', 'delete-guide',
];

export const MENU_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const MENU_TELEGRAM_RE = /^[A-Za-z0-9_]{4,32}$/;
export const MENU_NOTE_MAX = 500;

/**
 * "Heng Dy Mart" -> "heng-dy-mart". A name with no latin letters or digits (Khmer only)
 * gives '', and the field is then left for the owner to fill in.
 */
export function suggestMenuSlug(businessName: string | null | undefined): string {
  const slug = (businessName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return MENU_SLUG_RE.test(slug) && !RESERVED_MENU_SLUGS.includes(slug) ? slug : '';
}

/** "@shop", "https://t.me/shop" and "t.me/shop" all become "shop". */
export function normalizeTelegram(input: string): string {
  return input.trim().replace(/^https?:\/\//i, '').replace(/^t\.me\//i, '').replace(/^@+/, '').replace(/\/+$/, '');
}

/** Error messages are translation keys under onlineMenu.errors */
export const onlineMenuSchema = z
  .object({
    menu_enabled: z.boolean(),
    menu_slug: z
      .string()
      .regex(MENU_SLUG_RE, 'slugFormat')
      .refine(v => !RESERVED_MENU_SLUGS.includes(v), 'slugReserved')
      .nullable(),
    menu_telegram: z.string().regex(MENU_TELEGRAM_RE, 'telegramFormat').nullable(),
    menu_note: z.string().max(MENU_NOTE_MAX, 'noteTooLong').nullable(),
  })
  .refine(v => !v.menu_enabled || !!v.menu_slug, { message: 'slugRequired', path: ['menu_slug'] });

export type OnlineMenuSettings = z.infer<typeof onlineMenuSchema>;

/** Postgres error from saving businesses.menu_* -> translation key under onlineMenu.errors */
export function onlineMenuErrorKey(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message || '';
  if (error?.code === '23505' || message.includes('businesses_menu_slug_key')) return 'slugTaken';
  if (message.includes('businesses_menu_slug_not_reserved')) return 'slugReserved';
  if (message.includes('businesses_menu_slug_format')) return 'slugFormat';
  if (message.includes('businesses_menu_enabled_needs_slug')) return 'slugRequired';
  if (message.includes('businesses_menu_telegram_format')) return 'telegramFormat';
  if (message.includes('businesses_menu_note_length')) return 'noteTooLong';
  if (error?.code === '42501' || message.toLowerCase().includes('permission')) return 'notAllowed';
  return 'saveFailed';
}
