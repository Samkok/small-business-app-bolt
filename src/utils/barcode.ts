/**
 * Code 128 barcode encoder. Pure TypeScript, no dependencies.
 *
 * Code 128 encodes any printable ASCII string, which suits this app's barcodes
 * (short free-text codes such as "FF0001" or "02" as well as real EAN digits).
 * A scanner reads back exactly the stored string, so `productService.searchByBarcode`
 * matches what was printed.
 *
 * Output is a list of bars in "modules" (the narrowest unit); callers scale to pixels.
 */

// Bar/space widths for symbols 0..106. Each string alternates bar, space, bar, space...
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
const START_C = 105;
const STOP = 106;

export interface BarcodeBar {
  /** left edge in modules */
  x: number;
  /** width in modules */
  w: number;
}

export interface EncodedBarcode {
  bars: BarcodeBar[];
  /** total width in modules, including the mandatory quiet zones */
  width: number;
  /** the symbol values (start, data, checksum, stop) */
  symbols: number[];
  text: string;
}

export const QUIET_ZONE = 10;

/** True when the value can be encoded (printable ASCII 32..126). */
export function isEncodable(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[\x20-\x7E]+$/.test(value);
}

function symbolsFor(text: string): number[] {
  // All-digit strings of even length pack two digits per symbol (Code C);
  // everything else uses Code B one character per symbol.
  if (/^\d+$/.test(text) && text.length % 2 === 0 && text.length >= 2) {
    const out = [START_C];
    for (let i = 0; i < text.length; i += 2) out.push(parseInt(text.slice(i, i + 2), 10));
    return out;
  }
  const out = [START_B];
  for (const ch of text) out.push(ch.charCodeAt(0) - 32);
  return out;
}

export function checksum(symbols: number[]): number {
  let sum = symbols[0];
  for (let i = 1; i < symbols.length; i++) sum += symbols[i] * i;
  return sum % 103;
}

/** Encode `text` as Code 128. Throws on an unencodable value. */
export function encodeCode128(text: string): EncodedBarcode {
  if (!isEncodable(text)) throw new Error(`Cannot encode "${text}" as Code 128`);
  const data = symbolsFor(text);
  const symbols = [...data, checksum(data), STOP];

  const bars: BarcodeBar[] = [];
  let x = QUIET_ZONE;
  for (const s of symbols) {
    const pattern = PATTERNS[s];
    for (let i = 0; i < pattern.length; i++) {
      const w = parseInt(pattern[i], 10);
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
  }
  return { bars, width: x + QUIET_ZONE, symbols, text };
}

export interface BarcodeSvgOptions {
  /** height of the bars in pixels */
  height?: number;
  /** pixels per module */
  moduleWidth?: number;
  /** print the value under the bars */
  showText?: boolean;
  fontSize?: number;
  color?: string;
  background?: string;
}

/**
 * SVG markup for a barcode, for HTML/PDF output. Returns '' for values that
 * cannot be encoded, so callers can print the raw text instead.
 */
export function barcodeSvg(text: string | null | undefined, options: BarcodeSvgOptions = {}): string {
  if (!isEncodable(text)) return '';
  const { height = 48, moduleWidth = 2, showText = true, fontSize = 12, color = '#000000', background = '#ffffff' } = options;
  const encoded = encodeCode128(text as string);
  const width = encoded.width * moduleWidth;
  const textHeight = showText ? fontSize + 6 : 0;
  const total = height + textHeight;
  const rects = encoded.bars
    .map(b => `<rect x="${b.x * moduleWidth}" y="0" width="${b.w * moduleWidth}" height="${height}" fill="${color}"/>`)
    .join('');
  const label = showText
    ? `<text x="${width / 2}" y="${height + fontSize + 1}" text-anchor="middle" font-family="Menlo, Consolas, monospace" font-size="${fontSize}" fill="${color}">${escapeXml(text as string)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${total}" viewBox="0 0 ${width} ${total}" shape-rendering="crispEdges"><rect width="${width}" height="${total}" fill="${background}"/>${rects}${label}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
