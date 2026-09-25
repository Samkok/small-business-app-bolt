// Run with: npx tsx src/utils/__tests__/barcode128.test.ts
import assert from 'node:assert/strict';
import { code128Widths, code128Bars, code128Svg, parseReceiptNumber } from '../barcode128';

// Known encoding: "A" in subset B = Start B (104) + 33 + check ((104 + 33*1) % 103 = 34) + Stop
{
  const w = code128Widths('A');
  assert.deepEqual(w.slice(0, 6), [2, 1, 1, 2, 1, 4], 'start B');
  assert.deepEqual(w.slice(6, 12), [1, 1, 1, 3, 2, 3], 'A');
  assert.deepEqual(w.slice(12, 18), [1, 3, 1, 1, 2, 3], 'checksum 34');
  assert.deepEqual(w.slice(18), [2, 3, 3, 1, 1, 1, 2], 'stop');
}

// A receipt number encodes and every symbol is 11 modules wide (stop is 13)
{
  const w = code128Widths('R-000412');
  const symbols = 1 + 8 + 1; // start, 8 characters, checksum
  const modules = w.reduce((a, b) => a + b, 0);
  assert.equal(modules, symbols * 11 + 13);
  const { bars, totalWidth } = code128Bars('R-000412');
  assert.equal(bars.length, symbols * 3 + 4, 'three bars per symbol, four in the stop');
  assert.equal(totalWidth, modules + 20);
  assert.ok(code128Svg('R-000412').startsWith('<svg'));
}

// Text outside subset B is refused rather than mis-encoded
assert.deepEqual(code128Widths('ខ្មែរ'), []);
assert.equal(code128Svg(''), '');

// scanner parsing
assert.equal(parseReceiptNumber('R-000412'), 412);
assert.equal(parseReceiptNumber('r000412'), 412);
assert.equal(parseReceiptNumber(' 412 '), 412);
assert.equal(parseReceiptNumber('0'), null);
assert.equal(parseReceiptNumber('8850123456789'), null, 'a product EAN is not a receipt');
assert.equal(parseReceiptNumber('abc'), null);

console.log('barcode128: all assertions passed');
