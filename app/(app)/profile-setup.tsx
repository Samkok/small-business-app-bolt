import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { Input } from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Building2, User } from 'lucide-react-native';

export default function ProfileSetupScreen() {
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { user, updateProfile } = useAuth();

  const handleSaveProfile = async () => {
    if (!businessName.trim() || !fullName.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await updateProfile({
        business_name: businessName.trim(),
        full_name: fullName.trim(),
        role: 'admin'
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        // Navigate to the main app
        router.replace('/(app)/(tabs)');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Complete Your Profile
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Please provide your business information to continue
            </Text>
          </View>

          <Card style={styles.card}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Building2 size={20} color="#2563eb" />
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
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <User size={20} color="#059669" />
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
            </View>

            <Button
              title="Save Profile"
              onPress={handleSaveProfile}
              loading={loading}
              style={styles.button}
            />

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Your email: {user?.email}
              </Text>
            </View>
          </Card>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    padding: 24,
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
  button: {
    marginTop: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
});