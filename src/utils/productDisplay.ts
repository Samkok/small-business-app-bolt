import type { ProductUnit, Unit } from '@/src/services/units';

type NameLike = { name?: string | null };

/**
 * Renders a product's display name. For single-unit products this is just the
 * product name. For multi-unit products with a specific unit selected, it
 * returns "Family (Variant)" — e.g. "Coca-Cola 500ml (Box)". When no specific
 * unit is provided but the product has variants, it lists them joined by " / ".
 */
export function formatProductDisplayName(
  product: NameLike,
  options?: {
    productUnit?: Pick<ProductUnit, 'name'> | null;
    variants?: Array<Pick<ProductUnit, 'name'>> | null;
    unitFallback?: Pick<Unit, 'name'> | null;
  },
): string {
  const family = (product?.name ?? '').toString().trim() || 'Unnamed product';
  const variantName =
    (options?.productUnit?.name ?? '').toString().trim() ||
    (options?.unitFallback?.name ?? '').toString().trim();

  if (variantName) return `${family} (${variantName})`;

  const variants = (options?.variants ?? [])
    .map(v => (v?.name ?? '').toString().trim())
    .filter(Boolean);
  if (variants.length > 0) return `${family} (${variants.join(' / ')})`;
  return family;
}
