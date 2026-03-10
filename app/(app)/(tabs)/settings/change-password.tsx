import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { supabase } from '@/src/config/supabase';
import { Card } from '@/src/components/ui/Card';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('User not found');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setErrors({ currentPassword: 'Current password is incorrect' });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      Alert.alert(
        'Password Changed',
        'Your password has been updated successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return null;
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { label: 'Weak', color: '#ef4444', bars: 1 };
    if (score <= 3) return { label: 'Fair', color: '#f59e0b', bars: 2 };
    if (score <= 4) return { label: 'Good', color: '#3b82f6', bars: 3 };
    return { label: 'Strong', color: '#10b981', bars: 5 };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Change Password
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.infoCard, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff', borderColor: isDark ? '#1d4ed8' : '#bfdbfe', borderWidth: 1 }]}>
          <View style={styles.infoRow}>
            <ShieldCheck size={20} color="#2563eb" />
            <Text style={[styles.infoText, { color: isDark ? '#93c5fd' : '#1d4ed8' }]}>
              Choose a strong password with at least 8 characters, including uppercase letters, numbers, and symbols.
            </Text>
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={[styles.sectionLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            CURRENT PASSWORD
          </Text>

          <Input
            label="Current Password"
            value={currentPassword}
            onChangeText={(text) => {
              setCurrentPassword(text);
              if (errors.currentPassword) setErrors(prev => ({ ...prev, currentPassword: undefined }));
            }}
            secureTextEntry
            showPasswordToggle
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.currentPassword}
          />

          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]} />

          <Text style={[styles.sectionLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
            NEW PASSWORD
          </Text>

          <Input
            label="New Password"
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              if (errors.newPassword) setErrors(prev => ({ ...prev, newPassword: undefined }));
            }}
            secureTextEntry
            showPasswordToggle
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.newPassword}
          />

          {newPassword.length > 0 && strength && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <View
                    key={level}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor: level <= strength.bars
                          ? strength.color
                          : (isDark ? '#374151' : '#e5e7eb'),
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}

          <Input
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: undefined }));
            }}
            secureTextEntry
            showPasswordToggle
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.confirmPassword}
          />
        </Card>

        <Button
          title={loading ? 'Updating Password...' : 'Update Password'}
          onPress={handleChangePassword}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerRight: {
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    padding: 14,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  formCard: {
    padding: 16,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginBottom: 20,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  strengthBars: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'right',
  },
  submitButton: {
    marginTop: 4,
  },
});
