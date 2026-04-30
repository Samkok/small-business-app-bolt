import React, { useState, useEffect, useCallback } from 'react';
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
import { X, User, Percent, Truck, Search, Check } from 'lucide-react-native';
import { Button } from '@/src/components/ui/Button';
import { customerService } from '@/src/services/customers';
import { useDebounce } from '@/src/hooks/useDebounce';

interface SaleEditModalProps {
  visible: boolean;
  sale: any;
  saleDetails: any;
  businessId: string;
  onConfirm: (updates: {
    customerId?: string | null;
    discountType?: 'percentage' | 'fixed' | null;
    discountValue?: number | null;
    deliveryCost?: number | null;
  }) => Promise<void>;
  onCancel: () => void;
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

  // Discount
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(null);
  const [discountValue, setDiscountValue] = useState('');

  // Delivery
  const [deliveryCost, setDeliveryCost] = useState('');

  // Submission
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const debouncedSearch = useDebounce(customerSearch, 300);

  // Initialise fields from sale data when modal opens
  useEffect(() => {
    if (visible && sale) {
      setSelectedCustomer(sale.customers || null);
      setCustomerSearch(sale.customers?.name || '');
      setDiscountType(saleDetails?.cart_discount_type || null);
      setDiscountValue(saleDetails?.cart_discount_value != null ? String(saleDetails.cart_discount_value) : '');
      setDeliveryCost(saleDetails?.delivery_cost != null && saleDetails.delivery_cost > 0 ? String(saleDetails.delivery_cost) : '');
      setErrors({});
      setShowCustomerList(false);
    }
  }, [visible, sale, saleDetails]);

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
    if (!validate()) return;
    setSaving(true);
    try {
      const parsedDiscount = discountValue.trim() ? parseFloat(discountValue) : null;
      const parsedDelivery = deliveryCost.trim() ? parseFloat(deliveryCost) : 0;
      await onConfirm({
        customerId: selectedCustomer?.id ?? null,
        discountType: discountType && parsedDiscount != null ? discountType : null,
        discountValue: discountType && parsedDiscount != null ? parsedDiscount : null,
        deliveryCost: parsedDelivery,
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
              {selectedCustomer && (
                <View style={[styles.selectedBadge, { backgroundColor: '#2563eb15' }]}>
                  <Check size={13} color="#2563eb" />
                  <Text style={[styles.selectedBadgeText, { color: '#2563eb' }]}>{selectedCustomer.name}</Text>
                </View>
              )}
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
                <Text style={[styles.sectionTitle, { color: textColor }]}>Delivery Cost (deducted)</Text>
              </View>
              <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor }]}>
                <Text style={[styles.inputPrefix, { color: labelColor }]}>$</Text>
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
                Delivery cost is subtracted from the sale total.
              </Text>
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
