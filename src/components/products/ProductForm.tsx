import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { ImageUpload } from '@/src/components/ui/ImageUpload';
import { X, Package, DollarSign, FileText, ChartBar as BarChart3, Barcode, ChevronDown, Layers, Plus, Pencil } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { storageService } from '@/src/services/storage';
import BarcodeScanner from '@/src/components/inventory/BarcodeScanner';
import { useCurrency } from '@/src/hooks/useCurrency';
import { unitService, UnitGroup, Unit, ProductUnitPrice } from '@/src/services/units';
import { Currency } from '@/src/services/currencies';
import { CurrencyEditorModal } from '@/src/components/settings/CurrencyEditorModal';
import { UnitGroupEditorModal } from '@/src/components/inventory/UnitGroupEditorModal';

interface ProductFormProps {
  product?: any;
  onSave: (product: any) => void;
  onCancel: () => void;
}

export default function ProductForm({ product, onSave, onCancel }: ProductFormProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [barcode, setBarcode] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');
  const [imageFile, setImageFile] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | undefined>(undefined);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [selectedUnitGroupId, setSelectedUnitGroupId] = useState<string | undefined>(undefined);
  const [showUnitGroupPicker, setShowUnitGroupPicker] = useState(false);
  const [unitGroups, setUnitGroups] = useState<UnitGroup[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitPrices, setUnitPrices] = useState<Record<string, string>>({});
  const [unitBarcodes, setUnitBarcodes] = useState<Record<string, string>>({});
  const [scanningUnitId, setScanningUnitId] = useState<string | null>(null);
  const [showCurrencyEditor, setShowCurrencyEditor] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [showUnitGroupEditor, setShowUnitGroupEditor] = useState(false);

  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { currencies, defaultCurrency, formatPrice, refreshCurrencies } = useCurrency(currentBusiness?.id);

  const reloadUnitGroups = async () => {
    if (!currentBusiness?.id) return;
    try {
      const list = await unitService.getUnitGroups(currentBusiness.id);
      setUnitGroups(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setPrice(product.price?.toString() || '');
      setDescription(product.description || '');
      setBarcode(product.barcode || '');
      setCurrentStock(product.current_stock?.toString() || '0');
      setMinStockLevel(product.min_stock_level?.toString() || '0');
      setImageUrl(product.image_url || '');
      setSelectedCurrencyId(product.currency_id || undefined);
      setSelectedUnitGroupId(product.unit_group_id || undefined);
    }
  }, [product]);

  // Load unit groups when business changes
  useEffect(() => {
    if (currentBusiness?.id) {
      unitService.getUnitGroups(currentBusiness.id).then(setUnitGroups).catch(console.error);
    }
  }, [currentBusiness?.id]);

  // Load units when selectedUnitGroupId changes
  useEffect(() => {
    if (selectedUnitGroupId) {
      unitService.getUnits(selectedUnitGroupId).then((loaded) => {
        setUnits(loaded);
        // Pre-fill any existing barcodes from the units themselves
        const barcodeMap: Record<string, string> = {};
        loaded.forEach(u => {
          if (u.barcode) barcodeMap[u.id] = u.barcode;
        });
        setUnitBarcodes(barcodeMap);
      }).catch(console.error);
    } else {
      setUnits([]);
      setUnitPrices({});
      setUnitBarcodes({});
    }
  }, [selectedUnitGroupId]);

  // Load product unit prices when product.id is available
  useEffect(() => {
    if (product?.id) {
      unitService.getProductUnitPrices(product.id).then((prices) => {
        const priceMap: Record<string, string> = {};
        prices.forEach((p) => {
          priceMap[p.unit_id] = p.price.toString();
        });
        setUnitPrices(priceMap);
      }).catch(console.error);
    }
  }, [product?.id]);

  const handleImageSelect = (file: any) => {
    // Handle file object properly for both web and mobile
    if (file instanceof File) {
      // Web: File object from browser
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file)); // For preview
    } else if (file && typeof file === 'object' && 'uri' in file) {
      // Mobile: object with uri property
      setImageFile(file);
      setImageUrl(file.uri); // For preview
    } else if (typeof file === 'string') {
      // Fallback: direct string URI
      const fileObj = {
        uri: file,
        type: 'image/jpeg',
        name: `product_${Date.now()}.jpg`
      };
      setImageFile(fileObj);
      setImageUrl(file);
    }
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setImageUrl('');
  };

  const validateBarcode = (value: string) => {
    if (!value.trim()) {
      setBarcodeError('');
      return true;
    }
    const cleaned = value.trim();
    if (!/^\d+$/.test(cleaned)) {
      setBarcodeError('Barcode must contain only digits');
      return false;
    }
    if (![8, 12, 13, 14].includes(cleaned.length)) {
      setBarcodeError('Barcode must be 8, 12, 13, or 14 digits');
      return false;
    }
    setBarcodeError('');
    return true;
  };

  const handleBarcodeChange = (value: string) => {
    setBarcode(value);
    setBarcodeError('');
    if (value) {
      validateBarcode(value);
    }
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    if (scanningUnitId) {
      setUnitBarcodes(prev => ({ ...prev, [scanningUnitId]: scannedBarcode }));
      setScanningUnitId(null);
    } else {
      setBarcode(scannedBarcode);
      setBarcodeError('');
      validateBarcode(scannedBarcode);
    }
    setShowBarcodeScanner(false);
  };

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Error', 'Product name and price are required');
      return;
    }

    if (barcodeError) {
      Alert.alert('Error', 'Please fix the barcode before saving');
      return;
    }

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const stockValue = parseInt(currentStock) || 0;
    const minStockValue = parseInt(minStockLevel) || 0;

    if (stockValue < 0 || minStockValue < 0) {
      Alert.alert('Error', 'Stock values cannot be negative');
      return;
    }

    if (!currentBusiness?.id) {
      Alert.alert('Error', 'No business currentBusiness found');
      return;
    }

    setLoading(true);
    try {
      let finalImageUrl = imageUrl;

      // Upload new image if selected
      if (imageFile) {
        setImageLoading(true);
        try {
          const uploadResult = await storageService.uploadProductImage(imageFile, product?.id);
          finalImageUrl = uploadResult.url;
        } catch (error) {
          console.error('Image upload error:', error);
          Alert.alert('Warning', 'Failed to upload image, but product will be saved without it');
        } finally {
          setImageLoading(false);
        }
      }

      const productData = {
        name: name.trim(),
        price: priceValue,
        description: description.trim() || undefined,
        barcode: barcode.trim() || undefined,
        current_stock: stockValue,
        min_stock_level: minStockValue,
        image_url: finalImageUrl || undefined,
        business_id: currentBusiness.id,
        currency_id: selectedCurrencyId || undefined,
        unit_group_id: selectedUnitGroupId || undefined,
      };

      let savedProduct;
      if (product) {
        savedProduct = await productService.updateProduct(product.id, productData, currentBusiness.owner_user_id);
      } else {
        savedProduct = await productService.createProduct(productData);
      }

      // Save unit prices if a unit group is selected
      if (selectedUnitGroupId && savedProduct?.id) {
        const pricesToSave = Object.entries(unitPrices)
          .filter(([_, val]) => val && parseFloat(val) > 0)
          .map(([unitId, val]) => ({ unit_id: unitId, price: parseFloat(val) }));
        await unitService.setProductUnitPrices(savedProduct.id, pricesToSave);
      }

      // Save barcodes onto each unit
      if (selectedUnitGroupId && units.length > 0) {
        await Promise.all(
          units.map(unit => {
            const newBarcode = (unitBarcodes[unit.id] || '').trim() || null;
            const oldBarcode = unit.barcode || null;
            if (newBarcode !== oldBarcode) {
              return unitService.updateUnit(unit.id, { barcode: newBarcode });
            }
            return Promise.resolve();
          })
        );
      }

      Alert.alert('Success', `Product ${product ? 'updated' : 'created'} successfully`);
      onSave(savedProduct);
    } catch (error: any) {
      console.error('Error saving product:', error);
      const isDuplicateBarcode =
        error?.code === '23505' ||
        (typeof error?.message === 'string' &&
          (error.message.toLowerCase().includes('duplicate') ||
            error.message.toLowerCase().includes('unique')));
      if (isDuplicateBarcode) {
        setBarcodeError('This barcode is already used by another product');
        Alert.alert('Duplicate Barcode', 'Another product in this business already uses this barcode.');
      } else {
        Alert.alert('Error', `Failed to ${product ? 'update' : 'create'} product`);
      }
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
          {product ? 'Edit Product' : 'Add Product'}
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.form}>
          {/* Image Upload */}
          <ImageUpload
            value={imageUrl}
            onImageSelect={handleImageSelect}
            onImageRemove={handleImageRemove}
            loading={imageLoading}
            placeholder="Upload product image"
          />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Package size={20} color="#2563eb" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Basic Information
              </Text>
            </View>
            
            <Input
              label="Product Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter product name"
              required
            />
            
            <View>
              <Input
                label="Barcode"
                value={barcode}
                onChangeText={handleBarcodeChange}
                onBlur={() => validateBarcode(barcode)}
                placeholder="Scan or enter barcode"
              />
              {barcodeError ? (
                <Text style={styles.barcodeErrorText}>{barcodeError}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.scanButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                onPress={() => setShowBarcodeScanner(true)}
              >
                <Barcode size={20} color="#2563eb" />
                <Text style={[styles.scanButtonText, { color: '#2563eb' }]}>
                  Scan Barcode
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign size={20} color="#059669" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Pricing
              </Text>
            </View>

            <View style={styles.pickerRow}>
              <Text style={[styles.pickerLabel, { color: isDark ? '#d1d5db' : '#374151' }]}>Currency</Text>
              <View style={styles.pickerActions}>
                <TouchableOpacity
                  style={[styles.pickerButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                  onPress={() => setShowCurrencyPicker(true)}
                >
                  <Text style={[styles.pickerButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {selectedCurrencyId
                      ? currencies.find(c => c.id === selectedCurrencyId)?.code || 'Select'
                      : defaultCurrency?.code || 'Default'}
                  </Text>
                  <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                </TouchableOpacity>
                {selectedCurrencyId && (
                  <TouchableOpacity
                    style={[styles.inlineIconButton, { backgroundColor: isDark ? '#374151' : '#eff6ff' }]}
                    onPress={() => {
                      const cur = currencies.find(c => c.id === selectedCurrencyId) || null;
                      setEditingCurrency(cur);
                      setShowCurrencyEditor(true);
                    }}
                    accessibilityLabel="Edit currency"
                  >
                    <Pencil size={16} color="#2563eb" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.inlineIconButton, { backgroundColor: isDark ? '#374151' : '#eff6ff' }]}
                  onPress={() => {
                    setEditingCurrency(null);
                    setShowCurrencyEditor(true);
                  }}
                  accessibilityLabel="Add currency"
                >
                  <Plus size={16} color="#2563eb" />
                </TouchableOpacity>
              </View>
            </View>

            <Input
              label="Price"
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              required
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BarChart3 size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Stock Management
              </Text>
            </View>
            
            <Input
              label="Current Stock"
              value={currentStock}
              onChangeText={setCurrentStock}
              placeholder="0"
            />

            <Input
              label="Minimum Stock Level"
              value={minStockLevel}
              onChangeText={setMinStockLevel}
              placeholder="0"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Layers size={20} color="#0891b2" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Units
              </Text>
            </View>

            <View style={styles.pickerRow}>
              <Text style={[styles.pickerLabel, { color: isDark ? '#d1d5db' : '#374151' }]}>Unit Group</Text>
              <View style={styles.pickerActions}>
                <TouchableOpacity
                  style={[styles.pickerButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                  onPress={() => setShowUnitGroupPicker(true)}
                >
                  <Text style={[styles.pickerButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {selectedUnitGroupId
                      ? unitGroups.find(g => g.id === selectedUnitGroupId)?.name || 'Select'
                      : 'None'}
                  </Text>
                  <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineIconButton, { backgroundColor: isDark ? '#374151' : '#eff6ff' }]}
                  onPress={() => setShowUnitGroupEditor(true)}
                  accessibilityLabel="Add unit group"
                >
                  <Plus size={16} color="#2563eb" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedUnitGroupId && units.length > 0 && (
              <View style={styles.unitPricesSection}>
                {units.map((unit) => (
                  <View
                    key={unit.id}
                    style={[styles.unitCard, { backgroundColor: isDark ? '#1f2937' : '#f8fafc', borderColor: isDark ? '#374151' : '#e2e8f0' }]}
                  >
                    <View style={styles.unitCardHeader}>
                      <Text style={[styles.unitPriceName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        {unit.name}
                      </Text>
                      <Text style={[styles.unitPriceDetail, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        {unit.is_base_unit ? 'Base unit' : `1 ${unit.name} = ${unit.conversion_factor_to_base} base`}
                      </Text>
                    </View>
                    <View style={styles.unitCardFields}>
                      <View style={styles.unitCardField}>
                        <Input
                          label="Price"
                          value={unitPrices[unit.id] || ''}
                          onChangeText={(val: string) => setUnitPrices(prev => ({ ...prev, [unit.id]: val }))}
                          placeholder="0.00"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={styles.unitCardField}>
                        <Input
                          label="Barcode (optional)"
                          value={unitBarcodes[unit.id] || ''}
                          onChangeText={(val: string) => setUnitBarcodes(prev => ({ ...prev, [unit.id]: val }))}
                          placeholder="Scan or enter"
                        />
                        <TouchableOpacity
                          style={[styles.scanButton, { backgroundColor: isDark ? '#374151' : '#eff6ff', marginTop: 4 }]}
                          onPress={() => {
                            setScanningUnitId(unit.id);
                            setShowBarcodeScanner(true);
                          }}
                        >
                          <Barcode size={18} color="#2563eb" />
                          <Text style={[styles.scanButtonText, { color: '#2563eb' }]}>Scan</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FileText size={20} color="#ea580c" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Description
              </Text>
            </View>
            
            <Input
              label="Product Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your product"
              multiline
              numberOfLines={4}
            />
          </View>
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
          title={product ? 'Update Product' : 'Add Product'}
          onPress={handleSave}
          loading={loading}
          style={styles.footerButton}
        />
      </View>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showBarcodeScanner}
        animationType="slide"
        onRequestClose={() => setShowBarcodeScanner(false)}
      >
        <BarcodeScanner
          onBarcodeScan={handleBarcodeScanned}
          onClose={() => setShowBarcodeScanner(false)}
        />
      </Modal>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCurrencyPicker(false)}
        >
          <View style={[styles.pickerModal, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
            <Text style={[styles.pickerModalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Currency
            </Text>
            <ScrollView style={styles.pickerScrollView}>
              {currencies.map((currency) => (
                <TouchableOpacity
                  key={currency.id}
                  style={[
                    styles.pickerOption,
                    { backgroundColor: selectedCurrencyId === currency.id ? (isDark ? '#374151' : '#eff6ff') : 'transparent' },
                  ]}
                  onPress={() => {
                    setSelectedCurrencyId(currency.id);
                    setShowCurrencyPicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {currency.symbol} {currency.code} - {currency.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Unit Group Picker Modal */}
      <Modal
        visible={showUnitGroupPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitGroupPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUnitGroupPicker(false)}
        >
          <View style={[styles.pickerModal, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
            <Text style={[styles.pickerModalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Unit Group
            </Text>
            <ScrollView style={styles.pickerScrollView}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  { backgroundColor: !selectedUnitGroupId ? (isDark ? '#374151' : '#eff6ff') : 'transparent' },
                ]}
                onPress={() => {
                  setSelectedUnitGroupId(undefined);
                  setShowUnitGroupPicker(false);
                }}
              >
                <Text style={[styles.pickerOptionText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  None
                </Text>
              </TouchableOpacity>
              {unitGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[
                    styles.pickerOption,
                    { backgroundColor: selectedUnitGroupId === group.id ? (isDark ? '#374151' : '#eff6ff') : 'transparent' },
                  ]}
                  onPress={() => {
                    setSelectedUnitGroupId(group.id);
                    setShowUnitGroupPicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {group.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={[styles.pickerHint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                Manage unit groups in Inventory - Units
              </Text>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <CurrencyEditorModal
        visible={showCurrencyEditor}
        businessId={currentBusiness?.id || ''}
        currency={editingCurrency}
        onClose={() => setShowCurrencyEditor(false)}
        onSaved={(saved) => {
          refreshCurrencies();
          setSelectedCurrencyId(saved.id);
          setShowCurrencyEditor(false);
        }}
      />

      <UnitGroupEditorModal
        visible={showUnitGroupEditor}
        businessId={currentBusiness?.id || ''}
        onClose={() => setShowUnitGroupEditor(false)}
        onSaved={async (saved) => {
          await reloadUnitGroups();
          setSelectedUnitGroupId(saved.id);
          setShowUnitGroupEditor(false);
        }}
      />
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
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
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
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  barcodeErrorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  pickerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  inlineIconButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerModal: {
    width: '100%',
    maxHeight: 400,
    borderRadius: 12,
    padding: 16,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerScrollView: {
    maxHeight: 320,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  pickerOptionText: {
    fontSize: 15,
  },
  pickerHint: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  unitPricesSection: {
    marginTop: 12,
    gap: 12,
  },
  unitCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 4,
  },
  unitCardHeader: {
    marginBottom: 8,
  },
  unitPriceName: {
    fontSize: 14,
    fontWeight: '600',
  },
  unitPriceDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  unitCardFields: {
    flexDirection: 'row',
    gap: 10,
  },
  unitCardField: {
    flex: 1,
  },
});