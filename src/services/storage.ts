import { supabase } from '../config/supabase';
import { Platform } from 'react-native';

export interface UploadResult {
  url: string;
  path: string;
}

export const storageService = {
  async uploadProductImage(file: File | { uri: string; type: string; name: string }, productId?: string): Promise<UploadResult> {
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    
    let fileName: string;
    let contentType: string;

    if (Platform.OS === 'web' && 'size' in file) {
      // Web file upload
      const webFile = file as File;
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(webFile.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (webFile.size > maxSize) {
        throw new Error('File size too large. Please upload an image smaller than 5MB.');
      }

      const fileExtension = webFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      fileName = `${productId || 'temp'}_${timestamp}_${randomString}.${fileExtension}`;
      contentType = webFile.type;

      const filePath = `products/${fileName}`;

      // Upload using Supabase client for web
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, webFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        path: filePath
      };
    } else {
      // Mobile file upload using direct API call
      const mobileFile = file as { uri: string; type: string; name: string };

      // Before using mobileFile.uri, type, name
      if (
        !mobileFile ||
        typeof mobileFile.uri !== 'string' ||
        !mobileFile.uri ||
        typeof mobileFile.type !== 'string' ||
        !mobileFile.type ||
        typeof mobileFile.name !== 'string' ||
        !mobileFile.name
      ) {
        throw new Error('Invalid file object: uri, type, or name is missing or not a string.');
      }
      
      // Extract file extension from type or name
      let fileExtension = 'jpg';
      if (mobileFile.type && mobileFile.type.includes('/')) {
        fileExtension = mobileFile.type.split('/')[1] || 'jpg';
      } else if (mobileFile.name && mobileFile.name.includes('.')) {
        fileExtension = mobileFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      }

      fileName = `${productId || 'temp'}_${timestamp}_${randomString}.${fileExtension}`;

      // Set proper content type based on file extension or provided type
      if (mobileFile.type && mobileFile.type.includes('/')) {
        contentType = mobileFile.type;
      } else {
        // Map file extensions to MIME types
        const mimeTypeMap: { [key: string]: string } = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp'
        };
        contentType = mimeTypeMap[fileExtension] || 'image/jpeg';
      }

      const filePath = `products/${fileName}`;

      try {
        // Get Supabase session for auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No authentication session found');
        }

        // Create FormData for mobile upload
        const formData = new FormData();
        formData.append('file', {
          uri: mobileFile.uri,
          type: contentType,
          name: fileName,
        } as any);

        // Get Supabase URL and project reference
        const supabaseUrl = supabase.supabaseUrl;
        const uploadUrl = `${supabaseUrl}/storage/v1/object/product-images/${filePath}`;

        // Upload using fetch with FormData
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            // Don't set Content-Type header - let FormData set it with boundary
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload response error:', errorText);
          throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        return {
          url: urlData.publicUrl,
          path: filePath
        };
      } catch (error) {
        console.error('Mobile upload error:', error);
        throw error;
      }
    }
  },

  async deleteProductImage(imageUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const imagePath = this.getImagePath(imageUrl);
      if (!imagePath) {
        console.warn('Could not extract image path from URL:', imageUrl);
        return;
      }

      const { error } = await supabase.storage
        .from('product-images')
        .remove([imagePath]);

      if (error) {
        console.error('Delete error:', error);
        throw new Error(`Failed to delete image: ${error.message}`);
      }
    } catch (error) {
      console.error('Storage delete error:', error);
      throw error;
    }
  },

  async updateProductImage(oldImageUrl: string | null, newFile: File | { uri: string; type: string; name: string }, productId: string): Promise<UploadResult> {
    // Upload new image first
    const uploadResult = await this.uploadProductImage(newFile, productId);

    // Delete old image if it exists and is from our storage
    if (oldImageUrl && oldImageUrl.includes('product-images')) {
      try {
        await this.deleteProductImage(oldImageUrl);
      } catch (error) {
        console.warn('Failed to delete old image:', error);
        // Don't throw error here as the new image was uploaded successfully
      }
    }

    return uploadResult;
  },

  getImagePath(imageUrl: string): string | null {
    try {
      if (!imageUrl.includes('product-images')) return null;
      
      // Extract path from Supabase storage URL
      const urlParts = imageUrl.split('/storage/v1/object/public/product-images/');
      if (urlParts.length > 1) {
        return urlParts[1].split('?')[0]; // Remove query parameters
      }
      
      // Fallback for different URL formats
      const pathParts = imageUrl.split('/product-images/');
      if (pathParts.length > 1) {
        return urlParts[1].split('?')[0]; // Remove query parameters
      }
      
      return null;
    } catch {
      return null;
    }
  }
};