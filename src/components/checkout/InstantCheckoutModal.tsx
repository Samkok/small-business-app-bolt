import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useInstantCheckout } from '@/src/context/InstantCheckoutContext';
import { instantCheckoutService } from '@/src/services/instantCheckout';
import { useRouter } from 'expo-router';
import { X, CreditCard, Save, Check } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { InstantCheckoutProductList } from './InstantCheckoutProductList';
import { InstantCheckoutCustomerSelector } from './InstantCheckoutCustomerSelector';
import { InstantCheckoutSummary } from './InstantCheckoutSummary';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'other', label: 'Other' },
] as const;

export function InstantCheckoutModal() {
  const { isDark } = useTheme();
  const { currentBusiness, user } = useAuth();
  const {
    session,
    isModalOpen,
    guestCustomer,
    updateQuantity,
    removeProduct,
    setCustomer,
    setPaymentMethod,
    getSessionSummary,
    clearSession,
    closeModal,
  } = useInstantCheckout();

  const router = useRouter();
  const [completing, setCompleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    if (session && session.items.length > 0) {
      Alert.alert(
        'Close Checkout?',
        'Do you want to save this as a draft cart or discard?',
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              clearSession();
              closeModal();
            },
          },
          {
            text: 'Save as Draft',
            onPress: handleSaveToDraft,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } else {
      closeModal();
    }
  };

  const handleCompleteSale = async () => {
    if (!session || !currentBusiness?.id || !user?.id || !guestCustomer?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    if (!session.payment_method) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    const validation = instantCheckoutService.validateCheckoutSession(session);
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }

    setCompleting(true);
    try {
      const result = await instantCheckoutService.completeInstantCheckout({
        session,
        businessId: currentBusiness.id,
        userId: user.id,
        guestCustomerId: guestCustomer.id,
      });

      if (result.success) {
        Alert.alert('Success', 'Sale completed successfully!', [
          {
            text: 'View Sale',
            onPress: () => {
              clearSession();
              closeModal();
              if (result.saleId) {
                router.push(`/(app)/(tabs)/sales/details/${result.saleId}`);
              }
            },
          },
          {
            text: 'New Sale',
            onPress: () => {
              clearSession();
              closeModal();
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to complete sale');
      }
    } catch (error) {
      console.error('Failed to complete sale:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setCompleting(false);
    }
  };

  const handleSaveToDraft = async () => {
    if (!session || !currentBusiness?.id || !user?.id || !guestCustomer?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setSaving(true);
    try {
      const result = await instantCheckoutService.saveToDraftCart({
        session,
        businessId: currentBusiness.id,
        userId: user.id,
        guestCustomerId: guestCustomer.id,
      });

      if (result.success) {
        Alert.alert('Success', 'Draft cart saved!', [
          {
            text: 'View Cart',
            onPress: () => {
              clearSession();
              closeModal();
              if (result.cartId) {
                router.push(`/(app)/(tabs)/sales/cart/${result.cartId}`);
              }
            },
          },
          {
            text: 'OK',
            onPress: () => {
              clearSession();
              closeModal();
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to save draft cart');
      }
    } catch (error) {
      console.error('Failed to save draft cart:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const summary = getSessionSummary();

  if (!isModalOpen) return null;

  return (
    <Modal
      visible={isModalOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#ffffff' }]}>
        <View style={[styles.header, { borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
          <Text style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Quick Checkout
          </Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Products
            </Text>
            <InstantCheckoutProductList
              items={session?.items || []}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeProduct}
            />
          </View>

          {guestCustomer && (
            <View style={styles.section}>
              <InstantCheckoutCustomerSelector
                selectedCustomerId={session?.customer_id}
                guestCustomerId={guestCustomer.id}
                onSelectCustomer={setCustomer}
              />
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Payment Method
            </Text>
            <View style={styles.paymentMethods}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.paymentMethod,
                    {
                      backgroundColor: isDark ? '#1f2937' : '#ffffff',
                      borderColor:
                        session?.payment_method === method.value
                          ? '#2563eb'
                          : isDark
                          ? '#374151'
                          : '#e5e7eb',
                      borderWidth: session?.payment_method === method.value ? 2 : 1,
                    },
                  ]}
                  onPress={() => setPaymentMethod(method.value)}
                >
                  <CreditCard
                    size={20}
                    color={
                      session?.payment_method === method.value
                        ? '#2563eb'
                        : isDark
                        ? '#d1d5db'
                        : '#6b7280'
                    }
                  />
                  <Text
                    style={[
                      styles.paymentMethodText,
                      { color: isDark ? '#f9fafb' : '#111827' },
                    ]}
                  >
                    {method.label}
                  </Text>
                  {session?.payment_method === method.value && (
                    <Check size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <InstantCheckoutSummary summary={summary} />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: isDark ? '#1f2937' : '#ffffff',
              borderTopColor: isDark ? '#374151' : '#e5e7eb',
            },
          ]}
        >
          <Button
            title="Save as Draft"
            onPress={handleSaveToDraft}
            variant="secondary"
            loading={saving}
            icon={<Save size={20} color={isDark ? '#f9fafb' : '#111827'} />}
            style={styles.footerButton}
          />
          <Button
            title="Complete Sale"
            onPress={handleCompleteSale}
            loading={completing}
            disabled={!session?.items || session.items.length === 0}
            icon={<Check size={20} color="#ffffff" />}
            style={styles.footerButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  paymentMethods: {
    gap: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
  },
  paymentMethodText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
  },
});
