export function formatCurrency(amount: number, symbol: string = '$', decimals: number = 2): string {
  const absAmount = Math.abs(amount);
  const [intPart, decPart] = absAmount.toFixed(decimals).split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = decimals > 0 ? `${formattedInt}.${decPart}` : formattedInt;
  const prefix = amount < 0 ? '-' : '';
  return `${prefix}${symbol}${formatted}`;
}
