export function formatCurrency(amount: number, symbol: string = '$', decimals: number = 2): string {
  const formatted = Math.abs(amount).toFixed(decimals);
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}${symbol}${formatted}`;
}
