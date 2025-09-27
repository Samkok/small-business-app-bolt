import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Upload, X, Camera, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

interface ImageUploadProps {
  value?: string;
  onImageSelect: (file: File | { uri: string; type: string; name: string }) => void;
  onImageRemove: () => void;
  loading?: boolean;
  error?: string;
  placeholder?: string;
  label?: string;
}

export function ImageUpload({
  value,
  onImageSelect,
  onImageRemove,
  loading = false,
  error,
  placeholder = "Upload product image",
  label = "Product Image"
}: ImageUploadProps) {
  const { isDark } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);

  const handleFileSelect = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      // For mobile platforms, show image picker options
      Alert.alert(
        'Select Image',
        'Choose image source',
        [
          { text: 'Camera', onPress: () => await openCamera() },
          { text: 'Gallery', onPress: () => await openGallery() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const openCamera = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPreviewUrl(asset.uri);
        
        // Create file-like object for mobile
        const file = {
          uri: asset.uri,
          type: 'image/jpeg',
          name: `image_${Date.now()}.jpg`
        };
        
        onImageSelect(file);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const openGallery = async () => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is required to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPreviewUrl(asset.uri);
        
        // Create file-like object for mobile
        const file = {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `image_${Date.now()}.jpg`
        };
        
        onImageSelect(file);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const handleFileChange = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      Alert.alert('Invalid File', 'Please select a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      Alert.alert('File Too Large', 'Please select an image smaller than 5MB.');
      return;
    }

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Call parent handler
    onImageSelect(file);
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    onImageRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const containerStyle = {
    backgroundColor: isDark ? '#374151' : '#f9fafb',
    borderColor: error ? '#dc2626' : (isDark ? '#4b5563' : '#d1d5db'),
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
        {label}
      </Text>

      <View style={[styles.uploadContainer, containerStyle]}>
        {previewUrl ? (
          <View style={styles.imagePreview}>
            <Image
              source={{ uri: previewUrl }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemoveImage}
              disabled={loading}
            >
              <X size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleFileSelect}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <>
                <View style={styles.uploadIcon}>
                  {Platform.OS === 'web' ? (
                    <Upload size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
                  ) : (
                    <Camera size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
                  )}
                </View>
                <Text style={[styles.uploadText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {placeholder}
                </Text>
                <Text style={[styles.uploadSubtext, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                  {Platform.OS === 'web' 
                    ? 'JPEG, PNG, GIF, WebP up to 5MB'
                    : 'Take photo or choose from gallery'
                  }
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Web file input */}
        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        )}
      </View>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <View style={styles.helpText}>
        <Text style={[styles.helpTextContent, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          • Recommended size: 800x800px or larger
        </Text>
        <Text style={[styles.helpTextContent, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          • Square images work best for product listings
        </Text>
        <Text style={[styles.helpTextContent, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
          • High quality images improve customer engagement
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  uploadContainer: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadButton: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  uploadIcon: {
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 12,
  },
  imagePreview: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
  helpText: {
    marginTop: 8,
  },
  helpTextContent: {
    fontSize: 11,
    lineHeight: 16,
  },
});