import { supabase } from '../config/supabase';
import { Database } from '../types/database';
import { cartService } from './carts';
import { productService } from './products';
import { businessAccessGuard } from '../utils/businessAccessGuard';
import { subscriptionService } from './subscriptionService';
import { unitService } from './units';

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];
type SaleAction = Database['public']['Tables']['sale_actions']['Row'];
type SaleActionInsert = Database['public']['Tables']['sale_actions']['Insert'];
type Business = Database['public']['Tables']['businesses']['Row'];

export const salesService = {
  async completeSale(saleData: Omit<SaleInsert, 'total_amount' | 'subtotal_before_discount' | 'sale_discount_amount'>) {
    if (!saleData.created_by || !saleData.business_id) {
      throw new Error('User ID and Business ID are required');
    }

    const canAccess = await subscriptionService.canAccessFeature(saleData.created_by, saleData.business_id);
    if (!canAccess) {
      throw new Error('SUBSCRIPTION_LIMIT_REACHED');
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('access_state')
      .eq('id', saleData.business_id)
      .maybeSingle();

    if (business?.access_state === 'read_only_sales') {
      throw new Error('BUSINESS_READ_ONLY');
    }

    // Get cart summary with discount details
    const cartSummary = await cartService.getCartSummary(saleData.cart_id);
    const cart = await cartService.getCart(saleData.cart_id);

    // Pre-validate stock for every cart item in base units before creating the sale
    const deductions: Array<{ productId: string; baseQuantity: number; newStock: number }> = [];
    for (const item of cart.cart_items) {
      const product = await productService.getProduct(item.product_id);
      let baseQuantity = item.quantity;
      if (item.unit_id) {
        const conversionFactor = await unitService.getConversionFactor(item.unit_id);
        baseQuantity = item.quantity * conversionFactor;
      }
      const currentStock = product.current_stock ?? 0;
      if (baseQuantity > currentStock) {
        throw new Error(
          `INSUFFICIENT_STOCK:${product.name}:requested ${baseQuantity} base units, available ${currentStock}`,
        );
      }
      deductions.push({
        productId: item.product_id,
        baseQuantity,
        newStock: currentStock - baseQuantity,
      });
    }

    // Snapshot currency and exchange rate at the moment of sale so reports stay accurate
    // even if the business later edits exchange rates.
    let currencyIdForSale: string | null = (saleData as any).currency_id ?? null;
    let exchangeRateAtSale: number = 1;
    if (!currencyIdForSale) {
      const { data: defaultCurrency } = await supabase
        .from('currencies')
        .select('id, exchange_rate_to_usd')
        .eq('business_id', saleData.business_id)
        .eq('is_default', true)
        .maybeSingle();
      if (defaultCurrency) {
        currencyIdForSale = defaultCurrency.id;
        exchangeRateAtSale = Number(defaultCurrency.exchange_rate_to_usd ?? 1);
      }
    } else {
      const { data: cur } = await supabase
        .from('currencies')
        .select('exchange_rate_to_usd')
        .eq('id', currencyIdForSale)
        .maybeSingle();
      exchangeRateAtSale = Number(cur?.exchange_rate_to_usd ?? 1);
    }

    // Create sale record with discount information and currency snapshot
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        ...saleData,
        total_amount: cartSummary.finalTotal,
        subtotal_before_discount: cartSummary.itemsOriginalTotal,
        sale_discount_type: cart.discount_type,
        sale_discount_value: cart.discount_value,
        sale_discount_amount: cartSummary.cartDiscountAmount,
        currency_id: currencyIdForSale,
        exchange_rate_at_sale: exchangeRateAtSale,
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Update cart status to completed
    await cartService.updateCart(saleData.cart_id, { status: 'completed' });

    // Apply pre-validated stock deductions
    for (const d of deductions) {
      await productService.updateStock(d.productId, d.newStock);
    }

    return sale;
  },

  async getSalesCount(
    businessId: string,
    startDate?: string,
    endDate?: string,
    status?: string,
    paymentMethod?: string
  ) {
    if (!businessId) {
      console.warn('salesService.getSalesCount called without businessId');
      return 0;
    }
    
    let query = supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId);
    
    if (startDate) {
      query = query.gte('sale_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('sale_date', endDate);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }
    
    const { count, error } = await query;
    
    if (error) throw error;
    return count || 0;
  },

  async getSalesPaginated(
    businessId: string,
    startDate: string,
    endDate: string,
    offset: number = 0,
    limit: number = 10,
    status?: string,
    paymentMethod?: string
  ) {
    if (!businessId) {
      console.warn('salesService.getSalesPaginated called without businessId');
      return [];
    }

    let query = supabase
      .from('sales')
      .select(`
        *,
        customers(name, phone),
        carts(
          total_amount,
          discount_type,
          discount_value,
          delivery_cost,
          created_by_name,
          cart_items(
            quantity,
            product_id,
            unit_price,
            subtotal,
            original_subtotal,
            item_discount_type,
            item_discount_value,
            item_discount_amount,
            products(name, cost_per_unit)
          )
        ),
        sale_actions(
          id,
          action_type,
          amount,
          adjusted_amount,
          items_metadata,
          reason,
          created_at
        )
      `)
      .eq('business_id', businessId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getSalesByProduct(
    businessId: string,
    productId: string,
    startDate: string,
    endDate: string
  ) {
    if (!businessId || !productId) {
      console.warn('salesService.getSalesByProduct called without required parameters');
      return [];
    }

    // First, get all cart_items for this product within the date range
    const { data: cartItems, error: cartItemsError } = await supabase
      .from('cart_items')
      .select('cart_id')
      .eq('product_id', productId);

    if (cartItemsError) throw cartItemsError;

    if (!cartItems || cartItems.length === 0) {
      return [];
    }

    // Extract unique cart IDs
    const cartIds = [...new Set(cartItems.map(item => item.cart_id))];

    // Now get all sales that use these carts
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        *,
        customers(name, phone),
        carts(
          total_amount,
          discount_type,
          discount_value,
          delivery_cost,
          created_by_name,
          cart_items(
            quantity,
            unit_price,
            subtotal,
            original_subtotal,
            item_discount_type,
            item_discount_value,
            item_discount_amount,
            product_id,
            products(name)
          )
        ),
        sale_actions(
          id,
          action_type,
          amount,
          adjusted_amount,
          items_metadata,
          reason,
          created_at
        )
      `)
      .eq('business_id', businessId)
      .in('cart_id', cartIds)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: false });

    if (salesError) throw salesError;

    return sales || [];
  },

  async getSales(businessId: string, limit?: number) {
    if (!businessId) {
      console.warn('salesService.getSales called without businessId');
      return [];
    }

    let query = supabase
      .from('sales')
      .select(`
        *,
        customers(name, phone),
        carts(
          total_amount,
          discount_type,
          discount_value,
          delivery_cost,
          created_by_name,
          cart_items(
            quantity,
            unit_price,
            subtotal,
            original_subtotal,
            item_discount_type,
            item_discount_value,
            item_discount_amount,
            products(name)
          )
        ),
        sale_actions(action_type, amount, adjusted_amount)
      `)
      .eq('business_id', businessId)
      .order('sale_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Calculate display_amount for each sale based on status
    const salesWithDisplayAmount = data.map(sale => {
      let displayAmount = sale.total_amount;

      if (sale.status === 'voided') {
        // For voided sales, use adjusted_amount from void action
        const voidAction = sale.sale_actions?.find((a: any) => a.action_type === 'void');
        if (voidAction?.adjusted_amount != null) {
          displayAmount = voidAction.adjusted_amount;
        }
      } else if (sale.status === 'partially_returned') {
        // For partially returned, use current_total_amount if available, else calculate
        if (sale.current_total_amount != null) {
          displayAmount = sale.current_total_amount;
        } else {
          // Calculate: total - sum of adjusted return amounts
          const totalReturned = sale.sale_actions
            ?.filter((a: any) => a.action_type === 'return')
            ?.reduce((sum: number, a: any) => sum + (a.adjusted_amount || a.amount || 0), 0) || 0;
          displayAmount = sale.total_amount - totalReturned;
        }
      }

      return {
        ...sale,
        display_amount: displayAmount
      };
    });

    return salesWithDisplayAmount;
  },

  async getSalesWithDiscountDetails(businessId: string, limit?: number) {
    if (!businessId) return [];
    
    let query = supabase
      .from('sales_with_discount_details')
      .select('*')
      .eq('business_id', businessId)
      .order('sale_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getSale(saleId: string) {
    if (!saleId) return null;
    
    let { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customers(*),
        carts(
          *,
          cart_items(
            *,
            products(*)
          )
        ),
        sale_actions(*),
        returned_amount:sale_actions(amount).eq(action_type, 'return')
      `)
      .eq('id', saleId)
      .single();

    if (error) throw error;
    
    // Calculate total returned amount
    const returnedAmount = data.sale_actions
      ?.filter(action => action.action_type === 'return')
      ?.reduce((sum, action) => sum + (action.amount || 0), 0) || 0;
    
    // Add returned_amount to the sale data
    data.returned_amount = returnedAmount;
    
    // If there are sale actions, fetch the performer names separately
    if (data && data.sale_actions && data.sale_actions.length > 0) {
      const performerIds = data.sale_actions.map(action => action.performed_by);
      
      const { data: businesses, error: businessError } = await supabase
        .from('businesses')
        .select('id, owner_user_id')
        .in('id', performerIds);
        
      if (!businessError && businesses) {
        // Map business IDs to owner user IDs
        const businessOwners = businesses.reduce((map, business) => {
          map[business.id] = business.owner_user_id;
          return map;
        }, {});
        
        // Get user profiles for the owner IDs
        const ownerIds = businesses.map(b => b.owner_user_id);
        const { data: profiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id, full_name')
          .in('user_id', ownerIds);
          
        if (!profileError && profiles) {
          // Map user IDs to full names
          const userNames = profiles.reduce((map, profile) => {
            map[profile.user_id] = profile.full_name;
            return map;
          }, {});
          
          // Add performer name to each sale action
          data.sale_actions = data.sale_actions.map(action => {
            const ownerId = businessOwners[action.performed_by];
            return {
              ...action,
              performer_name: ownerId ? userNames[ownerId] || 'Unknown' : 'Unknown'
            };
          });
        }
      }
    }
    
    return data;
  },

  async getSaleWithDiscountBreakdown(saleId: string) {
    if (!saleId) return null;

    const { data, error } = await supabase
      .from('sales_with_discount_details')
      .select('*')
      .eq('id', saleId)
      .single();

    if (error) throw error;
    return data;
  },

  async updateSaleRecord(
    saleId: string,
    updates: {
      customerId?: string | null;
      discountType?: 'percentage' | 'fixed' | null;
      discountValue?: number | null;
      deliveryCost?: number | null;
    }
  ) {
    if (!saleId) throw new Error('saleId is required');

    // Fetch the sale to get cart_id
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select('cart_id')
      .eq('id', saleId)
      .single();
    if (saleErr) throw saleErr;

    const cartId = sale.cart_id;

    // Build cart updates
    const cartUpdates: Record<string, any> = {};
    if (updates.customerId !== undefined) cartUpdates.customer_id = updates.customerId;
    if (updates.discountType !== undefined) cartUpdates.discount_type = updates.discountType;
    if (updates.discountValue !== undefined) cartUpdates.discount_value = updates.discountValue;
    if (updates.deliveryCost !== undefined) cartUpdates.delivery_cost = updates.deliveryCost ?? 0;

    if (Object.keys(cartUpdates).length > 0) {
      const { error: cartErr } = await supabase
        .from('carts')
        .update({ ...cartUpdates, updated_at: new Date().toISOString() })
        .eq('id', cartId);
      if (cartErr) throw cartErr;
    }

    // Recalculate totals from cart summary
    const summary = await cartService.getCartSummary(cartId);

    // Build sales updates
    const salesUpdates: Record<string, any> = {
      total_amount: summary.finalTotal,
      delivery_cost: summary.deliveryCost,
      sale_discount_amount: summary.cartDiscountAmount,
      subtotal_before_discount: summary.itemsOriginalTotal,
    };
    if (updates.customerId !== undefined) salesUpdates.customer_id = updates.customerId;
    if (updates.discountType !== undefined) salesUpdates.sale_discount_type = updates.discountType;
    if (updates.discountValue !== undefined) salesUpdates.sale_discount_value = updates.discountValue;

    const { error: updateErr } = await supabase
      .from('sales')
      .update(salesUpdates)
      .eq('id', saleId);
    if (updateErr) throw updateErr;
  },

  async voidSale(
    saleId: string,
    reason: string,
    performedBy: string,
    currentBusiness?: Business | null,
    userBusinesses?: Business[],
    options?: {
      includeDeliveryCost?: boolean;
      lossAmount?: number;
      lossPercentage?: number;
      lossType?: 'fixed' | 'percentage';
    }
  ) {
    if (!saleId || !reason || !performedBy) return null;

    // Get the sale details first to access cart items
    const sale = await this.getSale(saleId);
    if (!sale) {
      throw new Error('Sale not found');
    }

    // Validate business access if provided
    if (currentBusiness && userBusinesses) {
      const validation = businessAccessGuard.validateActionOnBusinessData(
        sale.business_id,
        currentBusiness,
        userBusinesses
      );

      if (!validation.isValid) {
        throw new Error(validation.error || 'Business access validation failed');
      }
    }

    // Calculate adjusted void amount
    const { adjustedAmount, deliveryCostAmount, lossAmount } = this.calculateVoidAmount(
      sale,
      options
    );

    // Restore stock for all items in the sale
    if (sale.carts?.cart_items) {
      for (const item of sale.carts.cart_items) {
        try {
          // Get current product stock
          const product = await productService.getProduct(item.product_id);

          // Convert quantity to base units if needed
          let baseQuantity = item.quantity;
          if (item.unit_id) {
            const conversionFactor = await unitService.getConversionFactor(item.unit_id);
            baseQuantity = item.quantity * conversionFactor;
          }

          // Add the sold quantity back to stock
          const newStock = product.current_stock + baseQuantity;

          // Update the product stock
          await productService.updateStock(item.product_id, newStock);
        } catch (error) {
          console.error(`Error restoring stock for product ${item.product_id}:`, error);
          // Continue with other items even if one fails
        }
      }
    }

    // Perform the void action with adjustments
    return this.performSaleAction(
      saleId,
      'void',
      reason,
      performedBy,
      sale.total_amount,
      {
        deliveryCostIncluded: options?.includeDeliveryCost ?? true,
        deliveryCostAmount: deliveryCostAmount,
        lossAmount: lossAmount,
        lossPercentage: options?.lossPercentage || 0,
        lossType: options?.lossType,
        adjustedAmount: adjustedAmount,
      }
    );
  },

  calculateVoidAmount(
    sale: any,
    options?: {
      includeDeliveryCost?: boolean;
      lossAmount?: number;
      lossPercentage?: number;
      lossType?: 'fixed' | 'percentage';
    }
  ) {
    let adjustedAmount = sale.total_amount;
    let deliveryCostAmount = 0;
    let lossAmount = 0;

    // Handle delivery cost
    const includeDelivery = options?.includeDeliveryCost ?? true;
    if (!includeDelivery && sale.carts?.delivery_cost) {
      deliveryCostAmount = sale.carts.delivery_cost;
      adjustedAmount -= deliveryCostAmount;
    } else if (includeDelivery && sale.carts?.delivery_cost) {
      deliveryCostAmount = sale.carts.delivery_cost;
    }

    // Handle loss adjustment
    if (options?.lossType === 'fixed' && options.lossAmount) {
      lossAmount = options.lossAmount;
      adjustedAmount -= lossAmount;
    } else if (options?.lossType === 'percentage' && options.lossPercentage) {
      lossAmount = (sale.total_amount * options.lossPercentage) / 100;
      adjustedAmount -= lossAmount;
    }

    // Ensure adjusted amount is not negative
    adjustedAmount = Math.max(0, adjustedAmount);

    return {
      adjustedAmount,
      deliveryCostAmount,
      lossAmount,
    };
  },

  async refundSale(saleId: string, amount: number, reason: string, performedBy: string) {
    if (!saleId || !amount || !reason || !performedBy) return null;

    return this.performSaleAction(saleId, 'refund', reason, performedBy, amount);
  },

  async returnItems(
    saleId: string,
    returnedItems: {
      productId: string;
      quantity: number;
      lossAmount?: number;
      lossPercentage?: number;
      lossType?: 'fixed' | 'percentage';
    }[],
    reason: string,
    performedBy: string,
    options?: {
      includeDeliveryCost?: boolean;
    }
  ) {
    if (!saleId || !returnedItems.length || !reason || !performedBy) return null;

    const sale = await this.getSale(saleId);
    let returnAmount = 0;
    let totalLossAmount = 0;
    const itemsMetadata: any[] = [];

    // Calculate return amount and restore inventory
    for (const returnItem of returnedItems) {
      const cartItem = sale.carts.cart_items.find(item => item.product_id === returnItem.productId);
      if (cartItem) {
        const itemReturnAmount = (cartItem.subtotal / cartItem.quantity) * returnItem.quantity;
        let itemAdjustedAmount = itemReturnAmount;
        let itemLoss = 0;

        // Apply item-level loss adjustment
        if (returnItem.lossType === 'fixed' && returnItem.lossAmount) {
          itemLoss = returnItem.lossAmount;
          itemAdjustedAmount = Math.max(0, itemReturnAmount - itemLoss);
        } else if (returnItem.lossType === 'percentage' && returnItem.lossPercentage) {
          itemLoss = (itemReturnAmount * returnItem.lossPercentage) / 100;
          itemAdjustedAmount = itemReturnAmount - itemLoss;
        }

        returnAmount += itemReturnAmount;
        totalLossAmount += itemLoss;

        // Store metadata for this item
        itemsMetadata.push({
          productId: returnItem.productId,
          productName: cartItem.products?.name || 'Unknown',
          quantity: returnItem.quantity,
          originalAmount: itemReturnAmount,
          lossAmount: itemLoss,
          lossPercentage: returnItem.lossPercentage || 0,
          lossType: returnItem.lossType,
          adjustedAmount: itemAdjustedAmount,
        });

        // Restore inventory
        const product = await productService.getProduct(returnItem.productId);
        await productService.updateStock(returnItem.productId, product.current_stock + returnItem.quantity);
      }
    }

    // Calculate prorated delivery cost if included
    let deliveryCostAmount = 0;
    if (options?.includeDeliveryCost && sale.carts?.delivery_cost) {
      const totalItems = sale.carts.cart_items.reduce((sum, item) => sum + item.quantity, 0);
      const returnedQuantity = returnedItems.reduce((sum, item) => sum + item.quantity, 0);
      const proratedPercentage = returnedQuantity / totalItems;
      deliveryCostAmount = sale.carts.delivery_cost * proratedPercentage;
    }

    // Calculate final adjusted amount
    const adjustedAmount = returnAmount + deliveryCostAmount - totalLossAmount;

    return this.performSaleAction(
      saleId,
      'return',
      reason,
      performedBy,
      returnAmount,
      {
        deliveryCostIncluded: options?.includeDeliveryCost ?? false,
        deliveryCostAmount: deliveryCostAmount,
        lossAmount: totalLossAmount,
        lossPercentage: 0,
        lossType: undefined,
        adjustedAmount: adjustedAmount,
        itemsMetadata: itemsMetadata,
      }
    );
  },

  async performSaleAction(
    saleId: string,
    actionType: 'void' | 'refund' | 'return',
    reason: string,
    performedBy: string,
    amount?: number,
    adjustments?: {
      deliveryCostIncluded?: boolean;
      deliveryCostAmount?: number;
      lossAmount?: number;
      lossPercentage?: number;
      lossType?: 'fixed' | 'percentage';
      adjustedAmount?: number;
      itemsMetadata?: any;
    }
  ) {
    if (!saleId || !reason || !performedBy) return null;

    // Create sale action record with adjustments
    const actionData: any = {
      sale_id: saleId,
      action_type: actionType,
      reason,
      performed_by: performedBy,
      amount,
      delivery_cost_included: adjustments?.deliveryCostIncluded ?? false,
      delivery_cost_amount: adjustments?.deliveryCostAmount ?? 0,
      loss_amount: adjustments?.lossAmount ?? 0,
      loss_percentage: adjustments?.lossPercentage ?? 0,
      loss_type: adjustments?.lossType,
      adjusted_amount: adjustments?.adjustedAmount ?? amount,
      items_metadata: adjustments?.itemsMetadata,
    };

    const { data: action, error: actionError } = await supabase
      .from('sale_actions')
      .insert(actionData)
      .select()
      .single();

    if (actionError) throw actionError;

    // Update sale status
    let newStatus: string;
    switch (actionType) {
      case 'void':
        newStatus = 'voided';
        break;
      case 'refund':
        newStatus = 'refunded';
        break;
      case 'return':
        newStatus = 'partially_returned';
        break;
    }

    const { error: updateError } = await supabase
      .from('sales')
      .update({ status: newStatus })
      .eq('id', saleId);

    if (updateError) throw updateError;

    return action;
  },

  async getSalesReport(businessId: string, startDate: string, endDate: string) {
    if (!businessId || !startDate || !endDate) return [];
    
    const { data, error } = await supabase
      .from('sales_with_discount_details')
      .select('*')
      .eq('business_id', businessId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .eq('status', 'completed')
      .order('sale_date');

    if (error) throw error;
    return data;
  },

  async getSalesWithCOGS(businessId: string, startDate: string, endDate: string) {
    if (!businessId || !startDate || !endDate) return [];
    
    // Get sales with cart items and product costs
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        sale_date,
        status,
        carts(
          cart_items(
            quantity,
            unit_price,
            subtotal,
            product_id,
            products(
              name,
              cost_per_unit
            )
          )
        )
      `)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date');

    if (error) throw error;

    // Calculate COGS and profit for each sale
    return data.map(sale => {
      let totalCOGS = 0;
      let totalRevenue = parseFloat(sale.total_amount);

      // Calculate COGS from cart items
      if (sale.carts?.cart_items) {
        sale.carts.cart_items.forEach(item => {
          const costPerUnit = parseFloat(item.products?.cost_per_unit) || 0;
          totalCOGS += item.quantity * costPerUnit;
        });
      }

      return {
        id: sale.id,
        date: sale.sale_date,
        revenue: totalRevenue,
        cogs: totalCOGS,
        profit: totalRevenue - totalCOGS,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue) * 100 : 0
      };
    });
  },

  async getTotalProductsSoldByStatuses(
    businessId: string, 
    startDate: string, 
    endDate: string,
    statuses: string[] = ['completed', 'partially_returned']
  ) {
    if (!businessId || !startDate || !endDate) return 0;
    
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        quantity,
        carts!inner(
          sales!inner(
            business_id,
            sale_date,
            status
          )
        )
      `)
      .eq('carts.sales.business_id', businessId)
      .gte('carts.sales.sale_date', startDate)
      .lte('carts.sales.sale_date', endDate)
      .in('carts.sales.status', statuses);

    if (error) {
      console.error('Error fetching total products sold:', error);
      return 0;
    }

    // Sum up all quantities
    const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);
    return totalQuantity;
  },

  async getDiscountAnalytics(businessId: string, startDate: string, endDate: string) {
    if (!businessId || !startDate || !endDate) return null;

    const { data, error } = await supabase
      .from('sales_with_discount_details')
      .select(`
        items_original_total,
        items_total_discount,
        cart_discount_amount,
        total_amount,
        sale_date
      `)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    if (error) throw error;

    const analytics = data.reduce((acc, sale) => {
      acc.totalOriginalAmount += sale.items_original_total || 0;
      acc.totalItemDiscounts += sale.items_total_discount || 0;
      acc.totalCartDiscounts += sale.cart_discount_amount || 0;
      acc.totalFinalAmount += sale.total_amount || 0;
      acc.salesCount += 1;
      return acc;
    }, {
      totalOriginalAmount: 0,
      totalItemDiscounts: 0,
      totalCartDiscounts: 0,
      totalFinalAmount: 0,
      salesCount: 0
    });

    analytics.totalDiscounts = analytics.totalItemDiscounts + analytics.totalCartDiscounts;
    analytics.averageDiscountPerSale = analytics.salesCount > 0 ? analytics.totalDiscounts / analytics.salesCount : 0;
    analytics.discountPercentage = analytics.totalOriginalAmount > 0 ? (analytics.totalDiscounts / analytics.totalOriginalAmount) * 100 : 0;

    return analytics;
  },

  async getSalesAnalytics(
    businessId: string,
    startDate: string,
    endDate: string,
    status?: string,
    paymentMethod?: string
  ) {
    if (!businessId || !startDate || !endDate) {
      return {
        totalRevenue: 0,
        averageSale: 0,
        todayRevenue: 0,
        todaySalesCount: 0
      };
    }

    let query = supabase
      .from('sales')
      .select('total_amount, sale_date, status')
      .eq('business_id', businessId)
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    if (status) {
      query = query.eq('status', status);
    }

    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter completed sales for revenue calculations
    const completedSales = (data || []).filter(s => s.status === 'completed');
    const totalRevenue = completedSales.reduce((sum, sale) => sum + parseFloat(sale.total_amount.toString()), 0);
    const averageSale = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;

    // Calculate today's sales
    const today = new Date().toISOString().split('T')[0];
    const todaySales = completedSales.filter(sale =>
      sale.sale_date.split('T')[0] === today
    );
    const todayRevenue = todaySales.reduce((sum, sale) => sum + parseFloat(sale.total_amount.toString()), 0);

    return {
      totalRevenue,
      averageSale,
      todayRevenue,
      todaySalesCount: todaySales.length
    };
  }
};