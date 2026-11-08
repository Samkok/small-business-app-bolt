import { supabase } from '../config/supabase';

export interface ProductTransactionCheck {
  hasTransactions: boolean;
  salesCount: number;
  importCount: number;
  cartItemsCount: number;
  adjustmentCount: number;
  costEventCount: number;
  details: {
    inCompletedSales: number;
    inActiveCarts: number;
    totalImports: number;
    stockAdjustments: number;
    costChanges: number;
  };
}

export const productTransactionService = {
  async checkProductTransactions(productId: string): Promise<ProductTransactionCheck> {
    try {
      const [cartItemsResult, importsResult, adjustmentsResult, costEventsResult] = await Promise.all([
        supabase
          .from('cart_items')
          .select('id, cart_id, carts!inner(status)')
          .eq('product_id', productId),

        supabase
          .from('inventory_imports')
          .select('id')
          .eq('product_id', productId),

        // Write-offs and found stock: deleting the product would erase them from past profit
        supabase
          .from('stock_adjustments')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId),

        // Cost history beyond the opening entry (receipts, reversals, corrections)
        supabase
          .from('product_cost_events')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId)
          .neq('event_type', 'opening'),
      ]);

      if (cartItemsResult.error) throw cartItemsResult.error;
      if (importsResult.error) throw importsResult.error;
      if (adjustmentsResult.error) throw adjustmentsResult.error;
      if (costEventsResult.error) throw costEventsResult.error;
      const adjustmentCount = adjustmentsResult.count || 0;
      const costEventCount = costEventsResult.count || 0;

      const cartItems = cartItemsResult.data || [];
      const imports = importsResult.data || [];

      const completedSalesCount = cartItems.filter(
        (item: any) => item.carts?.status === 'completed'
      ).length;

      const activeCartsCount = cartItems.filter(
        (item: any) => item.carts?.status === 'active'
      ).length;

      const hasTransactions =
        cartItems.length > 0 ||
        imports.length > 0 ||
        adjustmentCount > 0 ||
        costEventCount > 0;

      return {
        hasTransactions,
        salesCount: completedSalesCount,
        importCount: imports.length,
        cartItemsCount: cartItems.length,
        adjustmentCount,
        costEventCount,
        details: {
          inCompletedSales: completedSalesCount,
          inActiveCarts: activeCartsCount,
          totalImports: imports.length,
          stockAdjustments: adjustmentCount,
          costChanges: costEventCount,
        },
      };
    } catch (error) {
      console.error('Error checking product transactions:', error);
      throw error;
    }
  },

  getTransactionSummary(check: ProductTransactionCheck): string {
    const parts: string[] = [];

    if (check.details.inCompletedSales > 0) {
      parts.push(`${check.details.inCompletedSales} completed sale${check.details.inCompletedSales !== 1 ? 's' : ''}`);
    }

    if (check.details.inActiveCarts > 0) {
      parts.push(`${check.details.inActiveCarts} active cart${check.details.inActiveCarts !== 1 ? 's' : ''}`);
    }

    if (check.details.totalImports > 0) {
      parts.push(`${check.details.totalImports} inventory import${check.details.totalImports !== 1 ? 's' : ''}`);
    }

    if (check.details.stockAdjustments > 0) {
      parts.push(`${check.details.stockAdjustments} stock adjustment${check.details.stockAdjustments !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0 && check.details.costChanges > 0) {
      parts.push('cost history');
    }

    if (parts.length === 0) {
      return 'No transaction history';
    }

    return parts.join(', ');
  },
};
