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
import { ImageUpload } from '@/src/components/ui/ImageUpload';
import { X, User, Phone, MapPin, Briefcase } from 'lucide-react-native';
import { storageService } from '@/src/services/storage';
import { Database } from '@/src/types/database';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

interface ProfileFormProps {
  onSave: () => void;
  onCancel: () => void;
}

export default function ProfileForm({ onSave, onCancel }: ProfileFormProps) {
  const { userProfile, user, updateUserProfile } = useAuth();
  const { isDark } = useTheme();

  const [fullName, setFullName] = useState(userProfile?.full_name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [address, setAddress] = useState(userProfile?.address || '');
  const [avatarFile, setAvatarFile] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.full_name || '');
      setPhone(userProfile.phone || '');
      setEmail(userProfile.email || '');
      setAddress(userProfile.address || '');
      setAvatarUrl(userProfile.avatar_url || '');
    }
  }, [userProfile]);

  const handleImageSelect = (uri: string | File) => {
    // Handle file object properly for both web and mobile
    if (typeof uri === 'string') {
      // Mobile: uri is a string path
      const file = {
        uri: uri,
        type: 'image/jpeg', // Default type
        name: `profile_${Date.now()}.jpg`
      };
      setAvatarFile(file);
      setAvatarUrl(uri); // For preview
    } else {
      // Web: uri is actually a File object
      const file = uri as File;
      setAvatarFile(file);
      setAvatarUrl(URL.createObjectURL(file)); // For preview
    }
  };

  const handleImageRemove = () => {
    setAvatarFile(null);
    setAvatarUrl('');
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Full name is required');
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
      } else if (avatarUrl === '' && userProfile?.avatar_url) {
        // If image was removed and there was an old one, delete it from storage
        try {
          await storageService.deleteProfileImage(userProfile.avatar_url);
        } catch (error) {
          console.error('Error deleting old profile image:', error);
        }
      }

      const updates: Partial<UserProfile> = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        avatar_url: finalAvatarUrl || null,
      };

      const { error } = await updateUserProfile(updates);

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
                User Profile
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
            
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Your email address"
              keyboardType="email-address"
              editable={false}
              style={{ opacity: 0.7 }}
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