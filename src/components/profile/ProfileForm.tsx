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
import { X, User, Phone, MapPin, Briefcase } from 'lucide-react-native';
import { storageService } from '@/src/services/storage';
import { Database } from '@/src/types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProfileFormProps {
  onSave: () => void;
  onCancel: () => void;
}

export default function ProfileForm({ onSave, onCancel }: ProfileFormProps) {
  const { profile, user, updateProfile } = useAuth();
  const { isDark } = useTheme();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [avatarFile, setAvatarFile] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setBusinessName(profile.business_name || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  const handleImageSelect = (file: any) => {
    setAvatarFile(file);
  };

  const handleImageRemove = () => {
    setAvatarFile(null);
    setAvatarUrl('');
  };

  const handleSave = async () => {
    if (!fullName.trim() || !businessName.trim()) {
      Alert.alert('Error', 'Full name and business name are required');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);
    let finalAvatarUrl = avatarUrl;

    try {
      // Upload new image if selected
      if (avatarFile) {
        setImageLoading(true);
        try {
          const uploadResult = await storageService.uploadProfileImage(avatarFile, user.id);
          finalAvatarUrl = uploadResult.url;
        } catch (error) {
          console.error('Profile image upload error:', error);
          Alert.alert('Warning', 'Failed to upload profile image, but profile will be saved without it');
        } finally {
          setImageLoading(false);
        }
      } else if (avatarUrl === '' && profile?.avatar_url) {
        // If image was removed and there was an old one, delete it from storage
        try {
          await storageService.deleteProfileImage(profile.avatar_url);
        } catch (error) {
          console.error('Error deleting old profile image:', error);
        }
      }

      const updates: Partial<Profile> = {
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        avatar_url: finalAvatarUrl || null,
      };

      const { error } = await updateProfile(updates);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Profile updated successfully');
        onSave();
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile');
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
          Edit Profile
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.form}>
          {/* Profile Image Upload */}
          <ImageUpload
            value={avatarUrl}
            onImageSelect={handleImageSelect}
            onImageRemove={handleImageRemove}
            loading={imageLoading}
            placeholder="Upload profile image"
          />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={20} color="#2563eb" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Personal Information
              </Text>
            </View>
            
            <Input
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              required
            />
            
            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Briefcase size={20} color="#059669" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Business Information
              </Text>
            </View>
            
            <Input
              label="Business Name"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Enter your business name"
              required
            />
            
            <Input
              label="Address"
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your business address"
              multiline
              numberOfLines={3}
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