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
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { ImageUpload } from '@/src/components/ui/ImageUpload';
import { storageService } from '@/src/services/storage';
import { ArrowLeft, Building } from 'lucide-react-native';

export default function BusinessSettingsScreen() {
  const [businessName, setBusinessName] = useState('');
  const [businessImageUrl, setBusinessImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness, updateBusiness } = useAuth();

  useEffect(() => {
    if (currentBusiness) {
      setBusinessName(currentBusiness.business_name || '');
      const imageUrl = currentBusiness.business_image_url || '';
      setBusinessImageUrl(imageUrl);
      console.log('Setting business image URL:', imageUrl);
    }
  }, [currentBusiness]);

  const handleImageSelect = (file: any) => {
    if (Platform.OS === 'web') {
      // Web: file is a File object
      setImageFile(file);
      setBusinessImageUrl(URL.createObjectURL(file)); // For preview
    } else {
      // Mobile: file has uri property
      setImageFile(file);
      setBusinessImageUrl(file.uri); // Use URI directly for preview
    }
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setBusinessImageUrl('');
  };

  const handleSave = async () => {
    if (!businessName.trim()) {
      Alert.alert('Error', 'Business name is required');
      return;
    }

    if (!currentBusiness) {
      Alert.alert('Error', 'No business selected');
      return;
    }

    setLoading(true);
    try {
      let newImageUrl = businessImageUrl;
      
      // Handle image upload/removal
      if (imageFile) {
        setImageLoading(true);
        try {
          // Upload new image (this will handle old image deletion)
          const uploadResult = await storageService.updateBusinessImage(
            currentBusiness.business_image_url || null,
            imageFile,
            currentBusiness.id
          );
          newImageUrl = uploadResult.url;
        } catch (imageError) {
          console.error('Error handling image:', imageError);
          Alert.alert('Warning', 'Business updated but image upload failed');
        } finally {
          setImageLoading(false);
        }
      } else if (businessImageUrl === '' && currentBusiness.business_image_url) {
        // Image was removed
        try {
          await storageService.deleteBusinessImage(currentBusiness.business_image_url);
          newImageUrl = '';
        } catch (imageError) {
          console.error('Error deleting image:', imageError);
        }
      }

      const { error } = await updateBusiness(currentBusiness.id, {
        business_name: businessName.trim(),
        business_image_url: newImageUrl
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to update business');
      } else {
        Alert.alert('Success', 'Business updated successfully');
        router.back();
      }
    } catch (error) {
      console.error('Error updating business:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!currentBusiness) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Business Settings
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            No business selected. Please select a business first.
          </Text>
          <Button
            title="Go to Business Selection"
            onPress={() => router.push('/business-selection')}
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Business Settings
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.form}>
          {/* Business Image Upload */}
          <ImageUpload
            value={businessImageUrl || currentBusiness?.business_image_url || ''}
            onImageSelect={handleImageSelect}
            onImageRemove={handleImageRemove}
            loading={imageLoading}
            placeholder="Upload business logo"
            label="Business Logo"
          />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Building size={20} color="#2563eb" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Business Information
              </Text>
            </View>
            
            <Input
              label="Business Name"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Enter business name"
              required
            />
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => router.back()}
          style={styles.footerButton}
        />
        <Button
          title="Save Changes"
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
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    minWidth: 200,
  },
});