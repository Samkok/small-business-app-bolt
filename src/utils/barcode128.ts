/**
 * Code 128 (subset B) encoder for the receipt-number barcode. Returns the bar/space widths
 * (in modules) the renderers draw: receiptHtml.ts as an inline SVG, ReceiptView.tsx with
 * react-native-svg. No library: the receipt must render offline and in the print HTML.
 *
 * Subset B covers ASCII 32..127, enough for "R-000412". The scanner in Sales History
 * reads the value back and opens the sale.
 */

// Each symbol is 3 bars + 3 spaces; the patterns are the module widths b,s,b,s,b,s
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const STOP = 106;

/** Widths of the bars and spaces, alternating, starting with a bar. Empty for text Code 128 B cannot hold. */
export function code128Widths(text: string): number[] {
  if (!text) return [];
  const codes: number[] = [];
  for (const ch of text) {
    const value = ch.charCodeAt(0) - 32;
    if (value < 0 || value > 94) return [];
    codes.push(value);
  }
  let checksum = START_B;
  codes.forEach((c, i) => { checksum += c * (i + 1); });
  const sequence = [START_B, ...codes, checksum % 103, STOP];
  const widths: number[] = [];
  for (const code of sequence) {
    for (const w of PATTERNS[code]) widths.push(Number(w));
  }
  return widths;
}

export interface BarcodeBar { x: number; width: number }

/** The dark bars as x offsets (in modules) for drawing; the total width includes the quiet zones. */
export function code128Bars(text: string, quietZone = 10): { bars: BarcodeBar[]; totalWidth: number } {
  const widths = code128Widths(text);
  const bars: BarcodeBar[] = [];
  let x = quietZone;
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x, width: w });
    x += w;
  });
  return { bars, totalWidth: widths.length ? x + quietZone : 0 };
}

/** Inline SVG for the print HTML. Height is in the same unit as the module width. */
export function code128Svg(text: string, options: { module?: number; height?: number } = {}): string {
  const module = options.module ?? 1.6;
  const height = options.height ?? 40;
  const { bars, totalWidth } = code128Bars(text);
  if (bars.length === 0) return '';
  const rects = bars.map(b => `<rect x="${(b.x * module).toFixed(2)}" y="0" width="${(b.width * module).toFixed(2)}" height="${height}" />`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(totalWidth * module).toFixed(2)}" height="${height}" viewBox="0 0 ${(totalWidth * module).toFixed(2)} ${height}" shape-rendering="crispEdges" fill="#111827">${rects}</svg>`;
}

/** "R-000412" or "000412" or "412" → 412; anything else null. Used by the receipt scanner. */
export function parseReceiptNumber(scanned: string): number | null {
  const m = /^\s*(?:R-?)?(\d{1,9})\s*$/i.exec(scanned);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : null;
}
