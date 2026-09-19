import { ReceiptModel } from './receipt';
import { RECEIPT_BRAND_LABEL, RECEIPT_BRAND_LOGO_DATA_URI } from './receiptBrand';

/**
 * HTML for the PDF and the system print dialog. A dumb renderer: every number
 * comes from the ReceiptModel, nothing is calculated here. All text is escaped
 * because customer names, notes and business details are typed by users.
 */

export const RECEIPT_WIDTH_PT = 320;

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const pad = (x: number) => String(x).padStart(2, '0');
export const formatReceiptDate = (d: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Rough page height so the PDF is one tall page instead of a letter sheet with a strip on it. */
export function estimateReceiptHeightPt(model: ReceiptModel): number {
  const lineRows = model.lines.reduce((sum, l) => sum + 34 + (l.discountAmount > 0 ? 15 : 0) + (l.name.length > 34 ? 14 : 0), 0);
  const refundRows = model.refund ? 70 + model.refund.items.length * 16 : 0;
  const header = 150 + (model.business.logoUrl ? 70 : 0) + [model.business.phone, model.business.address, model.business.pageName].filter(Boolean).length * 14;
  const footer = 70 + (model.notes ? 40 : 0) + (model.footer ? 34 : 0) + (model.stamp ? 40 : 0) + 34; // + the Powered By line
  return Math.ceil(header + model.meta.length * 16 + lineRows + 150 + refundRows + footer);
}

export function renderReceiptHtml(
  model: ReceiptModel,
  formatAmount: (amount: number) => string,
  options: { logoDataUri?: string | null } = {}
): string {
  const money = (x: number) => esc(formatAmount(x));
  const logo = options.logoDataUri || model.business.logoUrl;
  const contact = [model.business.phone, model.business.address, model.business.pageName].filter(Boolean) as string[];

  const row = (label: string, value: string, cls = '') =>
    `<div class="row ${cls}"><span>${label}</span><span>${value}</span></div>`;

  const lines = model.lines
    .map(l => {
      const qty = `${esc(l.quantity)}${l.unitLabel ? ` ${esc(l.unitLabel)}` : ''} x ${money(l.unitPrice)}`;
      return `
        <div class="item">
          <div class="item-name">${esc(l.name)}</div>
          ${row(qty, money(l.amount), 'sub')}
          ${l.discountAmount > 0 ? row(esc(l.discountLabel || 'Item discount'), `-${money(l.discountAmount)}`, 'sub disc') : ''}
        </div>`;
    })
    .join('');

  const deliveryRow =
    model.delivery.kind === 'none' ? '' : row(esc(model.delivery.label), esc(model.delivery.value), model.delivery.kind === 'free' ? 'strong-value' : 'small-value');

  const refund = model.refund
    ? `
      <div class="rule"></div>
      <div class="section-title">Returned</div>
      ${model.refund.items.map(i => row(`${i.quantity > 0 ? `${esc(i.quantity)} x ` : ''}${esc(i.name)}`, money(i.amount), 'sub')).join('')}
      ${model.refund.deductions > 0 ? row('Deduction kept', `-${money(model.refund.deductions)}`, 'sub') : ''}
      ${row('Refunded', `-${money(model.refund.refunded)}`)}
      ${row('Net paid', money(model.refund.netPaid), 'total')}`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #ffffff; color: #111827; font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; font-size: 12px; line-height: 1.35; }
  .receipt { width: ${RECEIPT_WIDTH_PT}pt; margin: 0 auto; padding: 18pt 16pt 22pt; position: relative; }
  .center { text-align: center; }
  .logo { width: 56pt; height: 56pt; object-fit: contain; border-radius: 8pt; margin-bottom: 6pt; }
  .biz { font-size: 17px; font-weight: 700; }
  .contact { color: #4b5563; font-size: 11px; }
  .rule { border-top: 1px dashed #9ca3af; margin: 10pt 0; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 10pt; margin: 2pt 0; }
  .row span:last-child { text-align: right; white-space: nowrap; }
  .row.small-value span:last-child { white-space: normal; font-size: 11px; color: #4b5563; }
  .row.strong-value span:last-child { font-weight: 700; }
  .head .row span:first-child { font-weight: 700; }
  .meta .row span:first-child { color: #6b7280; }
  .item { margin: 6pt 0; }
  .item-name { font-weight: 600; }
  .sub { color: #374151; padding-left: 8pt; }
  .disc { color: #6b7280; }
  .total { font-size: 16px; font-weight: 800; margin-top: 6pt; }
  .section-title { font-weight: 700; margin-bottom: 3pt; }
  .savings { text-align: right; color: #6b7280; font-size: 11px; }
  .notes { color: #374151; font-size: 11px; white-space: pre-wrap; }
  .footer { text-align: center; color: #374151; margin-top: 4pt; white-space: pre-wrap; }
  .powered { display: flex; align-items: center; justify-content: center; gap: 5pt; margin-top: 14pt; color: #9ca3af; font-size: 10px; }
  .powered img { width: 13pt; height: 13pt; border-radius: 3pt; }
  .stamp { position: absolute; top: 120pt; left: 0; right: 0; text-align: center; font-size: 46px; font-weight: 900; letter-spacing: 4px; color: rgba(220, 38, 38, 0.22); transform: rotate(-18deg); }
  .stamp.provisional { font-size: 30px; color: rgba(217, 119, 6, 0.25); }
</style>
</head>
<body>
  <div class="receipt">
    ${model.stamp ? `<div class="stamp ${model.stamp === 'PROVISIONAL' ? 'provisional' : ''}">${esc(model.stamp)}</div>` : ''}
    <div class="center">
      ${logo ? `<img class="logo" src="${esc(logo)}" onerror="this.style.display='none'" />` : ''}
      <div class="biz">${esc(model.business.name)}</div>
      ${contact.map(c => `<div class="contact">${esc(c)}</div>`).join('')}
    </div>
    <div class="rule"></div>
    <div class="head">${row(`Receipt ${esc(model.numberLabel)}`, esc(formatReceiptDate(model.date)))}</div>
    <div class="meta">${model.meta.map(m => row(esc(m.label), esc(m.value), m.emphasis ? 'strong-value' : '')).join('')}</div>
    <div class="rule"></div>
    ${lines}
    <div class="rule"></div>
    ${model.itemDiscountTotal > 0 || model.orderDiscountAmount > 0 ? row('Subtotal', money(model.subtotal)) : ''}
    ${model.orderDiscountAmount > 0 ? row(esc(model.orderDiscountLabel || 'Order discount'), `-${money(model.orderDiscountAmount)}`) : ''}
    ${model.adjustment !== 0 ? row('Adjustment', `${model.adjustment < 0 ? '-' : ''}${money(Math.abs(model.adjustment))}`) : ''}
    ${deliveryRow}
    ${row(esc(model.totalLabel), money(model.total), 'total')}
    ${model.totalSavings > 0 ? `<div class="savings">You saved ${money(model.totalSavings)}</div>` : ''}
    ${refund}
    ${model.stamp === 'VOID' ? `<div class="rule"></div><div class="center section-title">This sale was voided</div>` : ''}
    ${model.stamp === 'PROVISIONAL' ? `<div class="rule"></div><div class="center contact">Made offline. The receipt number is assigned once the sale syncs.</div>` : ''}
    ${model.notes ? `<div class="rule"></div><div class="notes">Note: ${esc(model.notes)}</div>` : ''}
    ${model.footer ? `<div class="rule"></div><div class="footer">${esc(model.footer)}</div>` : ''}
    <div class="powered"><img src="${RECEIPT_BRAND_LOGO_DATA_URI}" alt="" /><span>${esc(RECEIPT_BRAND_LABEL)}</span></div>
  </div>
</body>
</html>`;
}
