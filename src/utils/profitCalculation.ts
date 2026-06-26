interface CartItem {
  quantity?: number;
  unit_price?: number;
  product_id?: string;
  item_discount_amount?: number;
  products?: { cost_per_unit?: number };
}

interface SaleAction {
  action_type?: string;
  amount?: number;
  adjusted_amount?: number;
  items_metadata?: Array<{
    productId?: string;
    quantity?: number;
    originalAmount?: number;
    lossAmount?: number;
  }>;
}

interface SaleCart {
  delivery_cost?: number;
  discount_type?: string;
  discount_value?: number;
  cart_items?: CartItem[];
}

interface SaleData {
  status?: string;
  total_amount?: number;
  carts?: SaleCart;
  sale_actions?: SaleAction[];
  sale_items?: Array<{ quantity?: number }>;
}

export function calculateSaleProfit(sale: SaleData): number {
  if (sale.status === 'voided') return 0;

  const cartItems: CartItem[] = sale.carts?.cart_items || [];
  const cart = sale.carts;
  const deliveryCost = cart?.delivery_cost ?? 0;
  const isPartialReturn = sale.status === 'partially_returned';

  let cartDiscountAmount = 0;
  if (cart?.discount_type && cart?.discount_value) {
    const itemsSubtotal = cartItems.reduce((sum, ci) => {
      const itemTotal = (ci.unit_price ?? 0) * (ci.quantity || 0);
      const itemDiscount = ci.item_discount_amount ?? 0;
      return sum + (itemTotal - itemDiscount);
    }, 0);
    if (cart.discount_type === 'percentage') {
      cartDiscountAmount = itemsSubtotal * (cart.discount_value / 100);
    } else {
      cartDiscountAmount = Math.min(cart.discount_value, itemsSubtotal);
    }
  }

  const costMap = new Map<string, number>();
  cartItems.forEach((ci) => {
    if (ci.product_id) costMap.set(ci.product_id, ci.products?.cost_per_unit ?? 0);
  });

  const grossProfit = cartItems.reduce((sum, ci) => {
    const cost = ci.products?.cost_per_unit ?? 0;
    const itemRevenue = (ci.unit_price ?? 0) * (ci.quantity || 0);
    const itemDiscount = ci.item_discount_amount ?? 0;
    return sum + (itemRevenue - itemDiscount) - cost * (ci.quantity || 0);
  }, 0);

  const netProfit = grossProfit - cartDiscountAmount - deliveryCost;

  if (!isPartialReturn) return netProfit;

  const returnDeduction = (sale.sale_actions || []).reduce((sum, a) => {
    if (a.action_type !== 'return') return sum;
    return sum + (a.items_metadata || []).reduce((s, m) => {
      const cost = costMap.get(m.productId ?? '') ?? 0;
      const returnedProfit = (m.originalAmount || 0) - cost * (m.quantity || 0);
      const loss = m.lossAmount || 0;
      return s + returnedProfit - loss;
    }, 0);
  }, 0);

  return netProfit - returnDeduction;
}

export function calculateSaleDisplayAmount(sale: SaleData): number {
  if (sale.status === 'voided') return 0;
  if (sale.status === 'partially_returned') {
    const returnedAmount = (sale.sale_actions || []).reduce((sum, a) => {
      if (a.action_type !== 'return') return sum;
      return sum + (a.adjusted_amount || a.amount || 0);
    }, 0);
    return (sale.total_amount ?? 0) - returnedAmount;
  }
  return sale.total_amount ?? 0;
}

export function calculateSaleProductCount(sale: SaleData): number {
  if (sale.status === 'voided') return 0;

  const cartItems: CartItem[] = sale.carts?.cart_items || [];
  const saleItems = sale.sale_items || [];

  const grossQty = saleItems.length > 0
    ? saleItems.reduce((sum, si) => sum + (si.quantity || 0), 0)
    : cartItems.reduce((sum, ci) => sum + (ci.quantity || 0), 0);

  if (sale.status !== 'partially_returned') return grossQty;

  const returnedQty = (sale.sale_actions || []).reduce((sum, a) => {
    if (a.action_type !== 'return') return sum;
    return sum + (a.items_metadata || []).reduce((s, m) => s + (m.quantity || 0), 0);
  }, 0);

  return Math.max(0, grossQty - returnedQty);
}
