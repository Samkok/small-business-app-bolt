import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { X, ShoppingCart, User, CreditCard, DollarSign } from 'lucide-react-native';
import { customerService } from '@/src/services/customers';
import { productService } from '@/src/services/products';
import { cartService } from '@/src/services/carts';
import { salesService } from '@/src/services/sales';
import { useCurrencyContext } from '@/src/context/CurrencyContext';

interface SalesFormProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function SalesForm({ onComplete, onCancel }: SalesFormProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { isDark } = useTheme();
  const { profile } = useAuth();
  const { formatPrice } = useCurrencyContext();

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: '💵' },
    { value: 'card', label: 'Card', icon: '💳' },
    { value: 'transfer', label: 'Transfer', icon: '🏦' },
    { value: 'other', label: 'Other', icon: '💰' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!profile?.id) return;
    
    try {
      const [customersData, productsData] = await Promise.all([
        customerService.getCustomers(profile.id),
        productService.getProducts(profile.id)
      ]);
      
      setCustomers(customersData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const addToCart = (product: any) => {
    const existingItem = cartItems.find(item => item.product_id === product.id);
    
    if (existingItem) {
      setCartItems(cartItems.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCartItems([...cartItems, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        subtotal: product.price
      }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(cartItems.filter(item => item.product_id !== productId));
    } else {
      setCartItems(cartItems.map(item =>
        item.product_id === productId
          ? { ...item, quantity, subtotal: item.unit_price * quantity }
          : item
      ));
    }
  };

  const getTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleCompleteSale = async () => {
    if (!selectedCustomer) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Error', 'Please add items to cart');
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'No business profile found');
      return;
    }

    setLoading(true);
    try {
      // Create cart
      const cart = await cartService.createCart({
        customer_id: selectedCustomer.id,
        business_id: profile.id,
        created_by: profile.id,
        total_amount: getTotal()
      });

      // Add items to cart
      for (const item of cartItems) {
        await cartService.addItemToCart({
          cart_id: cart.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal
        });
      }

      // Complete sale
      await salesService.completeSale({
        cart_id: cart.id,
        customer_id: selectedCustomer.id,
        payment_method: paymentMethod as any,
        notes: notes.trim() || null,
        business_id: profile.id,
        created_by: profile.id
      });

      Alert.alert('Success', 'Sale completed successfully');
      onComplete();
    } catch (error) {
      console.error('Error completing sale:', error);
      Alert.alert('Error', 'Failed to complete sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          New Sale
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer Selection */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color="#2563eb" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Customer
            </Text>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.customerList}>
            {customers.map((customer) => (
              <TouchableOpacity
                key={customer.id}
                style={[
                  styles.customerButton,
                  {
                    backgroundColor: selectedCustomer?.id === customer.id 
                      ? '#2563eb' 
                      : (isDark ? '#374151' : '#f3f4f6'),
                    borderColor: selectedCustomer?.id === customer.id 
                      ? '#2563eb' 
                      : (isDark ? '#4b5563' : '#d1d5db'),
                  }
                ]}
                onPress={() => setSelectedCustomer(customer)}
              >
                <Text style={[
                  styles.customerButtonText,
                  { 
                    color: selectedCustomer?.id === customer.id 
                      ? '#ffffff' 
                      : (isDark ? '#f9fafb' : '#374151') 
                  }
                ]}>
                  {customer.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card>

        {/* Product Selection */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <ShoppingCart size={20} color="#059669" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Add Products
            </Text>
          </View>
          
          <View style={styles.productGrid}>
            {products.slice(0, 6).map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[styles.productButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                onPress={() => addToCart(product)}
              >
                <Text style={[styles.productName, { color: isDark ? '#f9fafb' : '#374151' }]} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={[styles.productPrice, { color: '#059669' }]}>
                  {formatPrice(product.price, product.currency_id)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Cart */}
        {cartItems.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <ShoppingCart size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Cart ({cartItems.length} items)
              </Text>
            </View>
            
            {cartItems.map((item) => (
              <View key={item.product_id} style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text style={[styles.cartItemName, { color: isDark ? '#f9fafb' : '#374151' }]}>
                    {item.product_name}
                  </Text>
                  <Text style={[styles.cartItemPrice, { color: '#059669' }]}>
                    {formatPrice(item.unit_price)} each
                  </Text>
                </View>
                
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: isDark ? '#4b5563' : '#e5e7eb' }]}
                    onPress={() => updateQuantity(item.product_id, item.quantity - 1)}
                  >
                    <Text style={[styles.quantityButtonText, { color: isDark ? '#f9fafb' : '#374151' }]}>-</Text>
                  </TouchableOpacity>
                  
                  <Text style={[styles.quantity, { color: isDark ? '#f9fafb' : '#374151' }]}>
                    {item.quantity}
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: isDark ? '#4b5563' : '#e5e7eb' }]}
                    onPress={() => updateQuantity(item.product_id, item.quantity + 1)}
                  >
                    <Text style={[styles.quantityButtonText, { color: isDark ? '#f9fafb' : '#374151' }]}>+</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={[styles.cartItemTotal, { color: '#059669' }]}>
                  {formatPrice(item.subtotal)}
                </Text>
              </View>
            ))}
            
            <View style={styles.cartTotal}>
              <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#374151' }]}>
                Total:
              </Text>
              <Text style={[styles.totalAmount, { color: '#059669' }]}>
                {formatPrice(getTotal())}
              </Text>
            </View>
          </Card>
        )}

        {/* Payment Method */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <CreditCard size={20} color="#ea580c" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Payment Method
            </Text>
          </View>
          
          <View style={styles.paymentGrid}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.value}
                style={[
                  styles.paymentButton,
                  {
                    backgroundColor: paymentMethod === method.value 
                      ? '#ea580c' 
                      : (isDark ? '#374151' : '#f3f4f6'),
                    borderColor: paymentMethod === method.value 
                      ? '#ea580c' 
                      : (isDark ? '#4b5563' : '#d1d5db'),
                  }
                ]}
                onPress={() => setPaymentMethod(method.value)}
              >
                <Text style={styles.paymentIcon}>{method.icon}</Text>
                <Text style={[
                  styles.paymentButtonText,
                  { 
                    color: paymentMethod === method.value 
                      ? '#ffffff' 
                      : (isDark ? '#f9fafb' : '#374151') 
                  }
                ]}>
                  {method.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Notes */}
        <Card style={styles.section}>
          <Input
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes for this sale"
            multiline
            numberOfLines={3}
          />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={onCancel}
          style={styles.footerButton}
        />
        <Button
          title={`Complete Sale - ${formatPrice(getTotal())}`}
          onPress={handleCompleteSale}
          loading={loading}
          style={styles.footerButton}
          disabled={!selectedCustomer || cartItems.length === 0}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  customerList: {
    marginBottom: 8,
  },
  customerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  customerButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productButton: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  cartItemPrice: {
    fontSize: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantity: {
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'center',
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 60,
    textAlign: 'right',
  },
  cartTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentButton: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  paymentIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  paymentButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
});