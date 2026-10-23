import React, { useState, useEffect, useCallback } from 'react';
import { PaymentStatusSelector } from './PaymentStatusSelector';
import { PaymentStatus, isPaymentStatus } from '@/src/utils/paymentStatus';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { X, User, Percent, Truck, Search, Check, UserPlus, Plus, Minus, Trash2, Package } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { unitService, Unit, ProductUnit } from '@/src/services/units';
import type { SaleEditInput, SaleEditLine } from '@/src/services/sales';
import { Button } from '@/src/components/ui/Button';
import { customerService } from '@/src/services/customers';
import { useDebounce } from '@/src/hooks/useDebounce';
import { DeliveryPayerSelector } from './DeliveryPayerSelector';
import { DeliveryPayer, readDelivery } from '@/src/utils/deliveryPayer';
import { useCurrencyContext } from '@/src/context/CurrencyContext';

interface SaleEditModalProps {
  visible: boolean;
  sale: any;
  saleDetails: any;
  businessId: string;
  /** The complete edit: every line the sale should have, plus the header fields */
  onConfirm: (updates: SaleEditInput) => Promise<void>;
  onCancel: () => void;
}

/** A line as edited on screen; the extra fields are for display only */
interface EditLine extends SaleEditLine {
  key: string;
  productName: string;
  unitName: string | null;
  currentStock: number | null;
}

export default function SaleEditModal({
  visible,
  sale,
  saleDetails,
  businessId,
  onConfirm,
  onCancel,
}: SaleEditModalProps) {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  // Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Inline create customer
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerPlatform, setNewCustomerPlatform] = useState<'facebook' | 'instagram' | 'telegram' | 'walk_in' | 'other'>('walk_in');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Discount
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(null);
  const [discountValue, setDiscountValue] = useState('');

  // Delivery: the amount, and who pays it (see src/utils/deliveryPayer.ts)
  const [deliveryCost, setDeliveryCost] = useState('');
  const [deliveryPayer, setDeliveryPayer] = useState<DeliveryPayer>('shop');
  const { getSymbol } = useCurrencyContext();

  // PAID or COD
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);

  // Submission
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Items: the lines the sale will have after saving. Existing lines keep their id; a line
  // added here has none. Stock and totals are settled by the server when saving.
  const [lines, setLines] = useState<EditLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebounce(productSearch, 300);
  const [productResults, setProductResults] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [unitChoice, setUnitChoice] = useState<{ product: any; units: Unit[]; prices: ProductUnit[] } | null>(null);
  const [reason, setReason] = useState('');

  const debouncedSearch = useDebounce(customerSearch, 300);

  // Initialise fields from sale data when modal opens
  useEffect(() => {
    if (visible && sale) {
      setSelectedCustomer(sale.customers || null);
      setCustomerSearch(sale.customers?.name || '');
      setDiscountType(saleDetails?.cart_discount_type || null);
      setDiscountValue(saleDetails?.cart_discount_value != null ? String(saleDetails.cart_discount_value) : '');
      const saved = readDelivery(saleDetails?.delivery_cost ?? sale?.delivery_cost, sale?.carts?.delivery_charge);
      setDeliveryCost(saved.amount > 0 ? String(saved.amount) : '');
      setDeliveryPayer(saved.payer);
      setPaymentStatus(isPaymentStatus(sale.payment_status) ? sale.payment_status : null);
      setErrors({});
      setShowCustomerList(false);
      setLines((sale.carts?.cart_items ?? []).map((ci: any): EditLine => ({
        key: ci.id,
        id: ci.id,
        productId: ci.product_id,
        productName: ci.products?.name ?? '',
        quantity: Number(ci.quantity) || 1,
        unitId: ci.unit_id ?? null,
        unitName: ci.units?.name ?? null,
        unitPrice: Number(ci.unit_price) || 0,
        itemDiscountType: ci.item_discount_type ?? null,
        itemDiscountValue: ci.item_discount_value ?? null,
        itemDiscountScope: ci.item_discount_scope ?? null,
        currentStock: ci.products?.current_stock ?? null,
      })));
      setProductSearch('');
      setProductResults([]);
      setShowProductList(false);
      setUnitChoice(null);
      setReason('');
    }
  }, [visible, sale, saleDetails]);

  // Search products to add
  useEffect(() => {
    if (!visible || !businessId) return;
    if (!debouncedProductSearch.trim()) {
      setProductResults([]);
      setShowProductList(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingProducts(true);
      try {
        const results = await productService.searchProducts(businessId, debouncedProductSearch, 10);
        if (!cancelled) {
          setProductResults(results || []);
          setShowProductList(true);
        }
      } catch {
        if (!cancelled) setProductResults([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedProductSearch, visible, businessId]);

  const addLine = useCallback((product: any, unit: Unit | null, price: number) => {
    setLines(prev => {
      const same = prev.find(l => l.productId === product.id && (l.unitId ?? null) === (unit?.id ?? null));
      if (same) return prev.map(l => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, {
        key: `new-${product.id}-${unit?.id ?? 'base'}-${Date.now()}`,
        id: null,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitId: unit?.id ?? null,
        unitName: unit?.name ?? null,
        unitPrice: price,
        itemDiscountType: null,
        itemDiscountValue: null,
        itemDiscountScope: null,
        currentStock: product.current_stock ?? null,
      }];
    });
    setErrors(e => { const { items, ...rest } = e; return rest; });
    setProductSearch('');
    setProductResults([]);
    setShowProductList(false);
    setUnitChoice(null);
  }, []);

  const handlePickProduct = useCallback(async (product: any) => {
    if (product.unit_group_id) {
      try {
        const [units, prices] = await Promise.all([
          unitService.getUnits(product.unit_group_id),
          unitService.getProductUnits(product.id),
        ]);
        if (units.length > 0) {
          setUnitChoice({ product, units, prices });
          setShowProductList(false);
          return;
        }
      } catch {
        // fall through: sell in the base unit
      }
    }
    addLine(product, null, Number(product.price) || 0);
  }, [addLine]);

  const changeQty = useCallback((key: string, delta: number) => {
    setLines(prev => prev.map(l => (l.key === key ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l)));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines(prev => prev.filter(l => l.key !== key));
  }, []);

  // Search customers
  useEffect(() => {
    if (!visible || !businessId) return;
    if (!debouncedSearch.trim()) {
      setCustomers([]);
      setShowCustomerList(false);
      return;
    }
    const search = async () => {
      setLoadingCustomers(true);
      try {
        const results = await customerService.searchCustomers(businessId, debouncedSearch);
        setCustomers(results);
        setShowCustomerList(true);
      } catch {
        setCustomers([]);
      } finally {
        setLoadingCustomers(false);
      }
    };
    search();
  }, [debouncedSearch, visible, businessId]);

  const handleSelectCustomer = useCallback((c: any) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setShowCustomerList(false);
  }, []);

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setShowCustomerList(false);
  }, []);

  const handleCreateCustomer = useCallback(async () => {
    if (!newCustomerName.trim() || !businessId) return;
    setCreatingCustomer(true);
    try {
      const created = await customerService.createCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
        platform: newCustomerPlatform,
        business_id: businessId,
      });
      setSelectedCustomer(created);
      setCustomerSearch(created.name);
      setShowCreateForm(false);
      setShowCustomerList(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerPlatform('walk_in');
    } catch {
      // silently fail
    } finally {
      setCreatingCustomer(false);
    }
  }, [newCustomerName, newCustomerPhone, newCustomerPlatform, businessId]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (discountType && discountValue.trim()) {
      const v = parseFloat(discountValue);
      if (isNaN(v) || v < 0) errs.discountValue = 'Discount must be a positive number';
      if (discountType === 'percentage' && v > 100) errs.discountValue = 'Percentage cannot exceed 100';
    }
    if (deliveryCost.trim()) {
      const v = parseFloat(deliveryCost);
      if (isNaN(v) || v < 0) errs.deliveryCost = 'Delivery cost must be a positive number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (lines.length === 0) {
      setErrors(e => ({ ...e, items: t('saleEdit.atLeastOne') }));
      return;
    }
    if (!validate()) return;
    setSaving(true);
    try {
      const parsedDiscount = discountValue.trim() ? parseFloat(discountValue) : null;
      const parsedDelivery = deliveryCost.trim() ? parseFloat(deliveryCost) : 0;
      await onConfirm({
        items: lines.map(({ key, productName, unitName, currentStock, ...line }) => line),
        reason: reason.trim() || null,
        customerId: selectedCustomer?.id ?? null,
        discountType: discountType && parsedDiscount != null ? discountType : null,
        discountValue: discountType && parsedDiscount != null ? parsedDiscount : null,
        deliveryCost: parsedDelivery,
        deliveryPayer,
        // Left out when never chosen, so an older sale without a status is not changed by accident
        ...(paymentStatus ? { paymentStatus } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  const bg = isDark ? '#1f2937' : '#ffffff';
  const labelColor = isDark ? '#9ca3af' : '#6b7280';
  const textColor = isDark ? '#f9fafb' : '#111827';
  const inputBg = isDark ? '#374151' : '#f9fafb';
  const borderColor = isDark ? '#4b5563' : '#e5e7eb';
  const overlayBg = isDark ? '#111827' : '#f3f4f6';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <Text style={[styles.headerTitle, { color: textColor }]}>Edit Sale</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <X size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Customer */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <User size={16} color="#2563eb" />
                <Text style={[styles.sectionTitle, { color: textColor }]}>Customer</Text>
              </View>
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor }]}>
                <Search size={16} color={labelColor} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="Search customer..."
                  placeholderTextColor={labelColor}
                  value={customerSearch}
                  onChangeText={(t) => {
                    setCustomerSearch(t);
                    if (selectedCustomer && t !== selectedCustomer.name) setSelectedCustomer(null);
                  }}
                />
                {loadingCustomers && <ActivityIndicator size="small" color="#2563eb" />}
                {selectedCustomer && (
                  <TouchableOpacity onPress={handleClearCustomer}>
                    <X size={16} color={labelColor} />
                  </TouchableOpacity>
                )}
              </View>
              {showCustomerList && customers.length > 0 && (
                <View style={[styles.dropdown, { backgroundColor: bg, borderColor }]}>
                  {customers.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.dropdownItem, { borderBottomColor: borderColor }]}
                      onPress={() => handleSelectCustomer(c)}
                    >
                      <Text style={[styles.dropdownName, { color: textColor }]}>{c.name}</Text>
                      {c.phone && <Text style={[styles.dropdownSub, { color: labelColor }]}>{c.phone}</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {showCustomerList && customers.length === 0 && !loadingCustomers && debouncedSearch.trim().length > 0 && (
                <View style={[styles.noResultsRow, { borderColor }]}>
                  <Text style={[styles.noResultsText, { color: labelColor }]}>No customers found</Text>
                </View>
              )}
              {selectedCustomer && (
                <View style={[styles.selectedBadge, { backgroundColor: '#2563eb15' }]}>
                  <Check size={13} color="#2563eb" />
                  <Text style={[styles.selectedBadgeText, { color: '#2563eb' }]}>{selectedCustomer.name}</Text>
                </View>
              )}

              {!selectedCustomer && !showCreateForm && (
                <TouchableOpacity
                  style={[styles.createCustomerBtn, { borderColor }]}
                  onPress={() => { setShowCreateForm(true); setShowCustomerList(false); }}
                >
                  <UserPlus size={15} color="#2563eb" />
                  <Text style={styles.createCustomerBtnText}>Create New Customer</Text>
                </TouchableOpacity>
              )}

              {showCreateForm && !selectedCustomer && (
                <View style={[styles.createForm, { backgroundColor: inputBg, borderColor }]}>
                  <View style={styles.createFormHeader}>
                    <Text style={[styles.createFormTitle, { color: textColor }]}>New Customer</Text>
                    <TouchableOpacity onPress={() => setShowCreateForm(false)}>
                      <X size={16} color={labelColor} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.createFormInput, { color: textColor, borderColor, backgroundColor: bg }]}
                    placeholder="Name *"
                    placeholderTextColor={labelColor}
                    value={newCustomerName}
                    onChangeText={setNewCustomerName}
                  />
                  <TextInput
                    style={[styles.createFormInput, { color: textColor, borderColor, backgroundColor: bg }]}
                    placeholder="Phone (optional)"
                    placeholderTextColor={labelColor}
                    value={newCustomerPhone}
                    onChangeText={setNewCustomerPhone}
                    keyboardType="phone-pad"
                  />
                  <View style={styles.platformRow}>
                    {(['walk_in', 'facebook', 'instagram', 'telegram', 'other'] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.platformChip,
                          { backgroundColor: newCustomerPlatform === p ? '#2563eb' : bg, borderColor },
                        ]}
                        onPress={() => setNewCustomerPlatform(p)}
                      >
                        <Text style={[styles.platformChipText, { color: newCustomerPlatform === p ? '#fff' : labelColor }]}>
                          {p === 'walk_in' ? 'Walk-in' : p.charAt(0).toUpperCase() + p.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[styles.createConfirmBtn, !newCustomerName.trim() && { opacity: 0.5 }]}
                    onPress={handleCreateCustomer}
                    disabled={!newCustomerName.trim() || creatingCustomer}
                  >
                    {creatingCustomer ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.createConfirmBtnText}>Create & Select</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Items */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Package size={16} color="#7c3aed" />
                <Text style={[styles.sectionTitle, { color: textColor }]}>{t('saleEdit.items')} ({lines.length})</Text>
              </View>
              {lines.map((line) => (
                <View key={line.key} style={[styles.lineRow, { borderColor }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lineName, { color: textColor }]} numberOfLines={1}>
                      {line.productName}{line.unitName ? ` · ${line.unitName}` : ''}
                    </Text>
                    <Text style={[styles.lineMeta, { color: labelColor }]}>
                      {getSymbol(sale?.currency_id ?? undefined)}{line.unitPrice.toFixed(2)}
                      {line.currentStock != null ? ` · ${t('saleEdit.inStock')}: ${line.currentStock}` : ''}
                    </Text>
                  </View>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={[styles.qtyBtn, { borderColor }]}
                      onPress={() => changeQty(line.key, -1)}
                      disabled={saving || line.quantity <= 1}
                    >
                      <Minus size={14} color={line.quantity <= 1 ? borderColor : textColor} />
                    </TouchableOpacity>
                    <Text style={[styles.qtyText, { color: textColor }]}>{line.quantity}</Text>
                    <TouchableOpacity style={[styles.qtyBtn, { borderColor }]} onPress={() => changeQty(line.key, 1)} disabled={saving}>
                      <Plus size={14} color={textColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeLine(line.key)}
                      disabled={saving}
                      accessibilityLabel={t('saleEdit.remove')}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {errors.items && <Text style={styles.errorText}>{errors.items}</Text>}

              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor, marginTop: 8 }]}>
                <Search size={16} color={labelColor} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder={t('saleEdit.searchProduct')}
                  placeholderTextColor={labelColor}
                  value={productSearch}
                  onChangeText={(v) => { setProductSearch(v); setUnitChoice(null); }}
                />
                {loadingProducts && <ActivityIndicator size="small" color="#2563eb" />}
              </View>
              {showProductList && productResults.length > 0 && (
                <View style={[styles.dropdown, { backgroundColor: bg, borderColor }]}>
                  {productResults.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.dropdownItem, { borderBottomColor: borderColor }]}
                      onPress={() => handlePickProduct(p)}
                    >
                      <Text style={[styles.dropdownName, { color: textColor }]}>{p.name}</Text>
                      <Text style={[styles.dropdownSub, { color: labelColor }]}>
                        {getSymbol(p.currency_id ?? undefined)}{Number(p.price ?? 0).toFixed(2)} · {t('saleEdit.inStock')}: {p.current_stock ?? 0}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {showProductList && productResults.length === 0 && !loadingProducts && debouncedProductSearch.trim().length > 0 && (
                <View style={[styles.noResultsRow, { borderColor }]}>
                  <Text style={[styles.noResultsText, { color: labelColor }]}>{t('saleEdit.noProducts')}</Text>
                </View>
              )}
              {unitChoice && (
                <View style={[styles.createForm, { backgroundColor: inputBg, borderColor }]}>
                  <View style={styles.createFormHeader}>
                    <Text style={[styles.createFormTitle, { color: textColor }]}>{t('saleEdit.chooseUnit')}: {unitChoice.product.name}</Text>
                    <TouchableOpacity onPress={() => setUnitChoice(null)}>
                      <X size={16} color={labelColor} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.platformRow}>
                    <TouchableOpacity
                      style={[styles.platformChip, { backgroundColor: bg, borderColor }]}
                      onPress={() => addLine(unitChoice.product, null, Number(unitChoice.product.price) || 0)}
                    >
                      <Text style={[styles.platformChipText, { color: labelColor }]}>
                        {t('saleEdit.basePrice')} {Number(unitChoice.product.price ?? 0).toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                    {unitChoice.units.map((u) => {
                      const price = Number(unitChoice.prices.find(pr => pr.unit_id === u.id)?.price ?? unitChoice.product.price ?? 0);
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[styles.platformChip, { backgroundColor: bg, borderColor }]}
                          onPress={() => addLine(unitChoice.product, u, price)}
                        >
                          <Text style={[styles.platformChipText, { color: labelColor }]}>{u.name} {price.toFixed(2)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
              <Text style={[styles.hint, { color: labelColor }]}>{t('saleEdit.stockNotice')}</Text>
            </View>

            {/* Discount */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Percent size={16} color="#059669" />
                <Text style={[styles.sectionTitle, { color: textColor }]}>Cart Discount</Text>
              </View>
              <View style={styles.discountTypeRow}>
                {(['percentage', 'fixed', null] as const).map((type) => (
                  <TouchableOpacity
                    key={String(type)}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: discountType === type ? '#059669' : inputBg,
                        borderColor: discountType === type ? '#059669' : borderColor,
                      },
                    ]}
                    onPress={() => {
                      setDiscountType(type);
                      if (!type) setDiscountValue('');
                    }}
                  >
                    <Text style={[styles.typeChipText, { color: discountType === type ? '#fff' : labelColor }]}>
                      {type === 'percentage' ? 'Percentage' : type === 'fixed' ? 'Fixed' : 'None'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {discountType && (
                <>
                  <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor }]}>
                    <Text style={[styles.inputPrefix, { color: labelColor }]}>
                      {discountType === 'percentage' ? '%' : '$'}
                    </Text>
                    <TextInput
                      style={[styles.input, { color: textColor }]}
                      placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 5.00'}
                      placeholderTextColor={labelColor}
                      value={discountValue}
                      onChangeText={setDiscountValue}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  {errors.discountValue && (
                    <Text style={styles.errorText}>{errors.discountValue}</Text>
                  )}
                </>
              )}
            </View>

            {/* Delivery */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Truck size={16} color="#ea580c" />
                <Text style={[styles.sectionTitle, { color: textColor }]}>{t('delivery.title')}</Text>
              </View>
              <DeliveryPayerSelector value={deliveryPayer} onChange={setDeliveryPayer} disabled={saving} />
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor, marginTop: 10 }]}>
                <Text style={[styles.inputPrefix, { color: labelColor }]}>{getSymbol(sale?.currency_id ?? undefined)}</Text>
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={labelColor}
                  value={deliveryCost}
                  onChangeText={setDeliveryCost}
                  keyboardType="decimal-pad"
                />
              </View>
              {errors.deliveryCost && (
                <Text style={styles.errorText}>{errors.deliveryCost}</Text>
              )}
              <Text style={[styles.hint, { color: labelColor }]}>
                {deliveryPayer === 'customer'
                  ? 'Added to the receipt on top of the items; nothing is deducted from the shop.'
                  : 'Delivery is free for the customer; the cost is deducted from the shop.'}
              </Text>
            </View>

            {/* PAID or COD */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Paid or Cash on Delivery</Text>
              </View>
              <PaymentStatusSelector value={paymentStatus} onChange={setPaymentStatus} disabled={saving} />
              {!isPaymentStatus(sale?.payment_status) && !paymentStatus && (
                <Text style={[styles.hint, { color: labelColor }]}>
                  This sale was made before PAID / COD existed. Choose one to record it.
                </Text>
              )}
            </View>

            {/* Reason, kept with the edit history */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>{t('saleEdit.reason')}</Text>
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor, marginTop: 8 }]}>
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder={t('saleEdit.reasonPlaceholder')}
                  placeholderTextColor={labelColor}
                  value={reason}
                  onChangeText={setReason}
                  maxLength={200}
                />
              </View>
            </View>

            {/* Recalculation notice */}
            <View style={[styles.notice, { backgroundColor: '#2563eb10', borderColor: '#2563eb30' }]}>
              <Text style={[styles.noticeText, { color: '#2563eb' }]}>
                Changing discount or delivery will recalculate the sale total automatically.
              </Text>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              style={styles.footerBtn}
            />
            <Button
              title="Save Changes"
              onPress={handleSave}
              loading={saving}
              style={styles.footerBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: '500',
    marginRight: 4,
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dropdownName: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownSub: {
    fontSize: 12,
    marginTop: 2,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  selectedBadgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  discountTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  typeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
  },
  notice: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
  noResultsRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 13,
  },
  createCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: 'dashed',
    alignSelf: 'flex-start',
  },
  createCustomerBtnText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '500',
  },
  createForm: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  createFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  createFormTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  createFormInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  platformChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  platformChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  createConfirmBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  createConfirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  lineName: { fontSize: 14, fontWeight: '600' },
  lineMeta: { fontSize: 12, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyText: { minWidth: 26, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  removeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  footerBtn: {
    flex: 1,
  },
});
