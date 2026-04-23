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
import { unitService, UnitGroup, Unit } from '@/src/services/units';
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
  const [unitVariantNames, setUnitVariantNames] = useState<Record<string, string>>({});
  const [unitBarcodes, setUnitBarcodes] = useState<Record<string, string>>({});
  const [unitBarcodeErrors, setUnitBarcodeErrors] = useState<Record<string, string>>({});
  const [unitNameErrors, setUnitNameErrors] = useState<Record<string, string>>({});
  // Per-unit stock inputs (in that unit's own quantity)
  const [unitStock, setUnitStock] = useState<Record<string, string>>({});
  const [unitMinStock, setUnitMinStock] = useState<Record<string, string>>({});
  const [scanningUnitId, setScanningUnitId] = useState<string | null>(null);
  const [showCurrencyEditor, setShowCurrencyEditor] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [showUnitGroupEditor, setShowUnitGroupEditor] = useState(false);

  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { currencies, defaultCurrency, formatPrice, refreshCurrencies } = useCurrency(currentBusiness?.id);
  const isMultiUnit = Boolean(selectedUnitGroupId) && units.length > 0;

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
      unitService.getUnits(selectedUnitGroupId).then(setUnits).catch(console.error);
    } else {
      setUnits([]);
      setUnitPrices({});
      setUnitVariantNames({});
      setUnitBarcodes({});
      setUnitBarcodeErrors({});
      setUnitNameErrors({});
      setUnitStock({});
      setUnitMinStock({});
    }
  }, [selectedUnitGroupId]);

  // Load existing product-unit rows (name, barcode, price) when editing a product
  useEffect(() => {
    if (!product?.id) return;
    unitService.getProductUnits(product.id).then((rows) => {
      const priceMap: Record<string, string> = {};
      const nameMap: Record<string, string> = {};
      const barcodeMap: Record<string, string> = {};
      rows.forEach((r) => {
        if (r.price != null) priceMap[r.unit_id] = r.price.toString();
        if (r.name) nameMap[r.unit_id] = r.name;
        if (r.barcode) barcodeMap[r.unit_id] = r.barcode;
      });
      setUnitPrices(priceMap);
      setUnitVariantNames(nameMap);
      setUnitBarcodes(barcodeMap);
    }).catch(console.error);
  }, [product?.id]);

  // When editing a multi-unit product, initialise per-unit stock from the product's
  // base-unit current_stock / min_stock_level, converted to each unit's own quantity.
  useEffect(() => {
    if (!product?.id || units.length === 0) return;
    const baseStock = product.current_stock ?? 0;
    const baseMin = product.min_stock_level ?? 0;
    const stockMap: Record<string, string> = {};
    const minMap: Record<string, string> = {};
    units.forEach((unit) => {
      const factor = unit.conversion_factor_to_base || 1;
      stockMap[unit.id] = factor > 1
        ? Math.floor(baseStock / factor).toString()
        : baseStock.toString();
      minMap[unit.id] = factor > 1
        ? Math.floor(baseMin / factor).toString()
        : baseMin.toString();
    });
    setUnitStock(stockMap);
    setUnitMinStock(minMap);
  }, [product?.id, units]);

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

  const validateBarcode = (value: string): boolean => {
    const cleaned = value.trim();
    if (!cleaned) {
      setBarcodeError('Barcode is required');
      return false;
    }
    if (!/^[0-9A-Za-z\-]+$/.test(cleaned)) {
      setBarcodeError('Barcode may only contain letters, digits, and hyphens');
      return false;
    }
    if (cleaned.length < 4 || cleaned.length > 50) {
      setBarcodeError('Barcode must be between 4 and 50 characters');
      return false;
    }
    setBarcodeError('');
    return true;
  };

  const validateUnitBarcode = (unitId: string, value: string): boolean => {
    const cleaned = value.trim();
    if (!cleaned) {
      setUnitBarcodeErrors(prev => ({ ...prev, [unitId]: 'Barcode is required' }));
      return false;
    }
    if (!/^[0-9A-Za-z\-]+$/.test(cleaned)) {
      setUnitBarcodeErrors(prev => ({ ...prev, [unitId]: 'Barcode may only contain letters, digits, and hyphens' }));
      return false;
    }
    if (cleaned.length < 4 || cleaned.length > 50) {
      setUnitBarcodeErrors(prev => ({ ...prev, [unitId]: 'Barcode must be between 4 and 50 characters' }));
      return false;
    }
    setUnitBarcodeErrors(prev => ({ ...prev, [unitId]: '' }));
    return true;
  };

  const validateUnitVariantName = (unitId: string, value: string): boolean => {
    const cleaned = value.trim();
    if (!cleaned) {
      setUnitNameErrors(prev => ({ ...prev, [unitId]: 'Variant label is required' }));
      return false;
    }
    setUnitNameErrors(prev => ({ ...prev, [unitId]: '' }));
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
      const unitId = scanningUnitId;
      setUnitBarcodes(prev => ({ ...prev, [unitId]: scannedBarcode }));
      validateUnitBarcode(unitId, scannedBarcode);
      setScanningUnitId(null);
    } else {
      setBarcode(scannedBarcode);
      setBarcodeError('');
      validateBarcode(scannedBarcode);
    }
    setShowBarcodeScanner(false);
  };

  const handleSave = async () => {
    const isMultiUnit = Boolean(selectedUnitGroupId) && units.length > 0;

    if (!name.trim()) {
      Alert.alert('Error', isMultiUnit ? 'Product family name is required' : 'Product name is required');
      return;
    }
    if (!isMultiUnit && !price.trim()) {
      Alert.alert('Error', 'Product price is required');
      return;
    }

    // Single-unit mode: the product itself owns the barcode
    if (!isMultiUnit) {
      if (!validateBarcode(barcode)) {
        Alert.alert('Error', barcodeError || 'Product barcode is required');
        return;
      }
    }

    // Multi-unit mode: each unit needs its own variant label and barcode
    if (isMultiUnit) {
      let allValid = true;
      for (const unit of units) {
        if (!validateUnitVariantName(unit.id, unitVariantNames[unit.id] || '')) allValid = false;
        if (!validateUnitBarcode(unit.id, unitBarcodes[unit.id] || '')) allValid = false;
      }
      if (!allValid) {
        Alert.alert('Error', 'Each unit variant needs a label and barcode');
        return;
      }
      const barcodeList = units.map(u => (unitBarcodes[u.id] || '').trim().toUpperCase());
      if (new Set(barcodeList).size !== barcodeList.length) {
        Alert.alert('Error', 'Each unit variant must have a unique barcode');
        return;
      }
    }

    let priceValue: number;
    if (isMultiUnit) {
      const baseUnit = units.find(u => u.is_base_unit) || units[units.length - 1];
      const basePriceStr = unitPrices[baseUnit.id];
      priceValue = parseFloat(basePriceStr || '0');
      if (isNaN(priceValue) || priceValue < 0) priceValue = 0;
    } else {
      priceValue = parseFloat(price);
      if (isNaN(priceValue) || priceValue < 0) {
        Alert.alert('Error', 'Please enter a valid price');
        return;
      }
    }

    // Compute stock in base units
    let stockValue: number;
    let minStockValue: number;

    if (isMultiUnit) {
      // Sum each unit's entered quantity × its conversion factor to arrive at base-unit totals.
      // Only the base unit contributes directly; larger units multiply up.
      stockValue = units.reduce((sum, unit) => {
        const qty = parseInt(unitStock[unit.id] || '0') || 0;
        return sum + qty * (unit.conversion_factor_to_base || 1);
      }, 0);
      // Min stock: use the base unit's threshold expressed in base units
      const baseUnit = units.find(u => u.is_base_unit) || units[units.length - 1];
      minStockValue = parseInt(unitMinStock[baseUnit.id] || '0') || 0;
    } else {
      stockValue = parseInt(currentStock) || 0;
      minStockValue = parseInt(minStockLevel) || 0;
    }

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

      // In multi-unit mode, the product-level barcode is not used for scanning
      // (each unit variant carries its own). We still persist something to
      // satisfy the NOT NULL column by reusing the base unit's barcode.
      let productBarcode = barcode.trim();
      if (isMultiUnit) {
        const baseUnit = units.find(u => u.is_base_unit) || units[units.length - 1];
        productBarcode = (unitBarcodes[baseUnit.id] || '').trim();
      }

      const productData = {
        name: name.trim(),
        price: priceValue,
        description: description.trim() || undefined,
        barcode: productBarcode,
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

      // Persist per-unit variants (name + barcode + price) when a unit group is assigned
      if (isMultiUnit && savedProduct?.id) {
        const rows = units.map(unit => ({
          unit_id: unit.id,
          name: (unitVariantNames[unit.id] || '').trim() || unit.name,
          barcode: (unitBarcodes[unit.id] || '').trim(),
          price: parseFloat(unitPrices[unit.id] || '') || 0,
          currency_id: selectedCurrencyId || null,
        }));
        await unitService.setProductUnits(savedProduct.id, currentBusiness.id, rows);
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
              label={isMultiUnit ? 'Product family name' : 'Product Name'}
              value={name}
              onChangeText={setName}
              placeholder={isMultiUnit ? 'e.g. Coca-Cola 500ml' : 'Enter product name'}
              required
            />
            {isMultiUnit ? (
              <Text style={[styles.hintText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                This shared name will be shown with each variant, e.g. "{(name || 'Coca-Cola 500ml')} (Box)".
              </Text>
            ) : (
              <View>
                <Input
                  label="Barcode"
                  value={barcode}
                  onChangeText={handleBarcodeChange}
                  onBlur={() => validateBarcode(barcode)}
                  placeholder="Scan or enter barcode"
                  required
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
            )}
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

            {!isMultiUnit && (
              <Input
                label="Price"
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                required
              />
            )}
            {isMultiUnit && (
              <Text style={[styles.hintText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                Prices are set per variant below.
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BarChart3 size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Stock Management
              </Text>
            </View>

            {isMultiUnit ? (
              <>
                <Text style={[styles.hintText, { color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 12 }]}>
                  Enter stock in each unit's own quantity. All quantities are converted to base units internally.
                </Text>
                {units.map((unit) => {
                  const isBase = unit.is_base_unit;
                  const label = (unitVariantNames[unit.id] || unit.name).trim();
                  return (
                    <View key={unit.id} style={[styles.unitStockCard, { backgroundColor: isDark ? '#1f2937' : '#f8fafc', borderColor: isDark ? '#374151' : '#e2e8f0' }]}>
                      <Text style={[styles.unitStockLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        {label}{isBase ? '  (base unit)' : ''}
                      </Text>
                      {!isBase && (
                        <Text style={[styles.unitStockHint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                          1 {label} = {unit.conversion_factor_to_base} base units
                        </Text>
                      )}
                      <View style={styles.unitStockRow}>
                        <View style={styles.unitStockField}>
                          <Input
                            label={`Current stock (${label})`}
                            value={unitStock[unit.id] || ''}
                            onChangeText={(val: string) =>
                              setUnitStock(prev => ({ ...prev, [unit.id]: val.replace(/[^\d]/g, '') }))
                            }
                            placeholder="0"
                            keyboardType="number-pad"
                          />
                        </View>
                        {isBase && (
                          <View style={styles.unitStockField}>
                            <Input
                              label="Min stock (base)"
                              value={unitMinStock[unit.id] || ''}
                              onChangeText={(val: string) =>
                                setUnitMinStock(prev => ({ ...prev, [unit.id]: val.replace(/[^\d]/g, '') }))
                              }
                              placeholder="0"
                              keyboardType="number-pad"
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            ) : (
              <>
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
              </>
            )}
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
                        {unit.is_base_unit ? '  (base)' : ''}
                      </Text>
                      <Text style={[styles.unitPriceDetail, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        {unit.is_base_unit ? 'Smallest sellable unit' : `1 ${unit.name} = ${unit.conversion_factor_to_base} base`}
                      </Text>
                    </View>

                    <Input
                      label={`Variant label for this unit (e.g. ${unit.name})`}
                      value={unitVariantNames[unit.id] || ''}
                      onChangeText={(val: string) => {
                        setUnitVariantNames(prev => ({ ...prev, [unit.id]: val }));
                        validateUnitVariantName(unit.id, val);
                      }}
                      onBlur={() => validateUnitVariantName(unit.id, unitVariantNames[unit.id] || '')}
                      placeholder={unit.name}
                      required
                    />
                    {unitNameErrors[unit.id] ? (
                      <Text style={styles.barcodeErrorText}>{unitNameErrors[unit.id]}</Text>
                    ) : (
                      <Text style={[styles.hintText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        Shown after the family name, e.g. "{(name || 'Coca-Cola').trim()} ({(unitVariantNames[unit.id] || unit.name).trim()})".
                      </Text>
                    )}

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
                          label="Barcode"
                          value={unitBarcodes[unit.id] || ''}
                          onChangeText={(val: string) => {
                            setUnitBarcodes(prev => ({ ...prev, [unit.id]: val }));
                            validateUnitBarcode(unit.id, val);
                          }}
                          onBlur={() => validateUnitBarcode(unit.id, unitBarcodes[unit.id] || '')}
                          placeholder="Scan or enter"
                          required
                        />
                        {unitBarcodeErrors[unit.id] ? (
                          <Text style={styles.barcodeErrorText}>{unitBarcodeErrors[unit.id]}</Text>
                        ) : null}
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
  hintText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 4,
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
  unitStockCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  unitStockLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  unitStockHint: {
    fontSize: 11,
    marginBottom: 8,
  },
  unitStockRow: {
    flexDirection: 'row',
    gap: 10,
  },
  unitStockField: {
    flex: 1,
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