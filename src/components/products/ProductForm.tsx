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
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { ImageUpload } from '@/src/components/ui/ImageUpload';
import { X, Package, DollarSign, FileText, ChartBar as BarChart3 } from 'lucide-react-native';
import { productService } from '@/src/services/products';
import { storageService } from '@/src/services/storage';

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
  
  const { isDark } = useTheme();
  const { profile } = useAuth();

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setPrice(product.price?.toString() || '');
      setDescription(product.description || '');
      setBarcode(product.barcode || '');
      setCurrentStock(product.current_stock?.toString() || '0');
      setMinStockLevel(product.min_stock_level?.toString() || '0');
      setImageUrl(product.image_url || '');
    }
  }, [product]);

  const handleImageSelect = (file: any) => {
    setImageFile(file);
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setImageUrl('');
  };

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Error', 'Product name and price are required');
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

    if (!profile?.id) {
      Alert.alert('Error', 'No business profile found');
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
        description: description.trim() || null,
        barcode: barcode.trim() || null,
        current_stock: stockValue,
        min_stock_level: minStockValue,
        image_url: finalImageUrl || null,
        business_id: profile.id,
      };

      let savedProduct;
      if (product) {
        savedProduct = await productService.updateProduct(product.id, productData);
      } else {
        savedProduct = await productService.createProduct(productData);
      }

      Alert.alert('Success', `Product ${product ? 'updated' : 'created'} successfully`);
      onSave(savedProduct);
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Error', `Failed to ${product ? 'update' : 'create'} product`);
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
            
            <Input
              label="Barcode"
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Scan or enter barcode"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign size={20} color="#059669" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Pricing
              </Text>
            </View>
            
            <Input
              label="Price"
              value={price}
              onChangeText={setPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
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
              keyboardType="number-pad"
            />
            
            <Input
              label="Minimum Stock Level"
              value={minStockLevel}
              onChangeText={setMinStockLevel}
              placeholder="0"
              keyboardType="number-pad"
            />
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
});