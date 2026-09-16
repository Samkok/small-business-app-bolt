import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/src/config/supabase';
import { barcodeSvg } from '@/src/utils/barcode';

export interface ProductExportFields {
  name: boolean;
  price: boolean;
  cost: boolean;
  qty: boolean;
  barcode: boolean;
}

interface ExportRow {
  name: string;
  barcode: string | null;
  price: number;
  cost: number | null;
  qty: number | null;
  /** unit variants with their own barcode, when the product is sold in several units */
  variants: { name: string; barcode: string | null; price: number | null }[];
}

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (n: number | null | undefined, symbol: string) =>
  n === null || n === undefined ? '' : `${symbol}${Number(n).toFixed(2)}`;

export async function fetchProductsForExport(businessId: string): Promise<ExportRow[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, cost_per_unit, current_stock, barcode')
    .eq('business_id', businessId)
    .is('archived_at', null)
    .order('name', { ascending: true });
  if (error) throw error;

  const { data: variants } = await supabase
    .from('product_unit_prices')
    .select('product_id, name, barcode, price, units(name)')
    .eq('business_id', businessId);

  const byProduct = new Map<string, ExportRow['variants']>();
  for (const v of variants || []) {
    const list = byProduct.get((v as any).product_id) || [];
    list.push({
      name: (v as any).name || (v as any).units?.name || 'Unit',
      barcode: (v as any).barcode || null,
      price: (v as any).price ?? null,
    });
    byProduct.set((v as any).product_id, list);
  }

  return (products || []).map((p: any) => ({
    name: p.name || '',
    barcode: p.barcode || null,
    price: Number(p.price) || 0,
    cost: p.cost_per_unit === null || p.cost_per_unit === undefined ? null : Number(p.cost_per_unit),
    qty: p.current_stock === null || p.current_stock === undefined ? null : Number(p.current_stock),
    variants: byProduct.get(p.id) || [],
  }));
}

/** CSV with the chosen columns. Barcode is the stored value; a CSV cannot carry the picture. */
export function buildProductsCsv(rows: ExportRow[], fields: ProductExportFields): string {
  const headers: string[] = [];
  if (fields.name) headers.push('Name');
  if (fields.barcode) headers.push('Barcode');
  if (fields.price) headers.push('Price');
  if (fields.cost) headers.push('Cost');
  if (fields.qty) headers.push('Quantity');
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

  let csv = headers.join(',') + '\n';
  for (const r of rows) {
    const line: string[] = [];
    if (fields.name) line.push(q(r.name));
    if (fields.barcode) line.push(q(r.barcode || ''));
    if (fields.price) line.push(String(r.price));
    if (fields.cost) line.push(String(r.cost ?? 0));
    if (fields.qty) line.push(String(r.qty ?? 0));
    csv += line.join(',') + '\n';
    if (fields.barcode) {
      for (const v of r.variants) {
        const vl: string[] = [];
        if (fields.name) vl.push(q(`${r.name} — ${v.name}`));
        vl.push(q(v.barcode || ''));
        if (fields.price) vl.push(String(v.price ?? r.price));
        if (fields.cost) vl.push('');
        if (fields.qty) vl.push('');
        csv += vl.join(',') + '\n';
      }
    }
  }
  return csv;
}

/** Printable product list. Every row shows its barcode drawn as Code 128 plus the value. */
export function buildProductsBarcodeHtml(
  rows: ExportRow[],
  fields: ProductExportFields,
  options: { businessName?: string; currencySymbol?: string } = {}
): string {
  const symbol = options.currencySymbol ?? '$';
  const cols: string[] = [];
  if (fields.name) cols.push('<th class="l">Product</th>');
  cols.push('<th class="l">Barcode</th>');
  if (fields.price) cols.push('<th class="r">Price</th>');
  if (fields.cost) cols.push('<th class="r">Cost</th>');
  if (fields.qty) cols.push('<th class="r">Qty</th>');

  const barcodeCell = (value: string | null) => {
    const svg = barcodeSvg(value, { height: 44, moduleWidth: 2, fontSize: 11 });
    return svg ? `<td class="bc">${svg}</td>` : `<td class="bc"><span class="nobc">${esc(value) || 'No barcode'}</span></td>`;
  };

  const body = rows.map(r => {
    const cells: string[] = [];
    if (fields.name) cells.push(`<td class="l name">${esc(r.name)}</td>`);
    cells.push(barcodeCell(r.barcode));
    if (fields.price) cells.push(`<td class="r">${money(r.price, symbol)}</td>`);
    if (fields.cost) cells.push(`<td class="r">${money(r.cost, symbol)}</td>`);
    if (fields.qty) cells.push(`<td class="r">${r.qty ?? ''}</td>`);
    const main = `<tr>${cells.join('')}</tr>`;
    const variants = r.variants.map(v => {
      const vc: string[] = [];
      if (fields.name) vc.push(`<td class="l variant">↳ ${esc(v.name)}</td>`);
      vc.push(barcodeCell(v.barcode));
      if (fields.price) vc.push(`<td class="r">${money(v.price ?? r.price, symbol)}</td>`);
      if (fields.cost) vc.push('<td></td>');
      if (fields.qty) vc.push('<td></td>');
      return `<tr class="vrow">${vc.join('')}</tr>`;
    }).join('');
    return main + variants;
  }).join('');

  const date = new Date().toLocaleDateString();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Products</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111827; font-size: 12px; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { color: #6b7280; font-size: 11px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
  th { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #6b7280; text-align: left; }
  th.r, td.r { text-align: right; white-space: nowrap; }
  td.name { font-weight: 600; }
  td.variant { color: #4b5563; padding-left: 18px; }
  td.bc { width: 1%; white-space: nowrap; }
  td.bc svg { display: block; }
  .nobc { color: #9ca3af; font-style: italic; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  tr.vrow td { border-bottom-style: dashed; }
</style></head><body>
<h1>${esc(options.businessName || 'Products')}</h1>
<div class="meta">${rows.length} products · ${esc(date)}</div>
<table><thead><tr>${cols.join('')}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}

/** Render the barcode list to a PDF and hand it to the share sheet (print dialog on web). */
export async function shareProductsBarcodePdf(html: string, fileName: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
  }
}
