import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Alert
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { supabase } from '@/src/config/supabase';
import { ArrowLeft, Mail } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert(t('common.error'), 'Please enter your email address');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(t('common.error'), t('auth.invalidEmail'));
      return;
    }

    setLoading(true);
    try {
      const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
      const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME || 'businessmanager';

      let redirectTo: string;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.location?.origin) {
          redirectTo = `${window.location.origin}/reset-password`;
        } else {
          redirectTo = `${appUrl}/reset-password`;
        }
      } else {
        redirectTo = `${appScheme}://reset-password`;
      }

      console.log('Password reset redirect URL:', redirectTo);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error("Password reset error from Supabase:", error);
        Alert.alert(t('common.error'), error.message || 'Failed to send reset email');
      } else {
        console.log("Password reset email sent successfully to:", email);
        setResetSent(true);
      }
    } catch (error: any) {
      console.error('Unexpected password reset error:', error);
      const errorMessage = error?.message || error?.toString() || 'An unexpected error occurred';
      Alert.alert(t('common.error'), errorMessage);
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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Reset Password
            </Text>
          </View>

          <Card style={styles.card}>
            {resetSent ? (
              <View style={styles.successContainer}>
                <Mail size={48} color="#2563eb" />
                <Text style={[styles.successTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Check Your Email
                </Text>
                <Text style={[styles.successText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  We've sent password reset instructions to {email}. Please check your inbox and follow the link to reset your password.
                </Text>
                <Button
                  title="Back to Sign In"
                  onPress={() => router.push('/(auth)/signin')}
                  style={styles.button}
                />
              </View>
            ) : (
              <>
                <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>

                <Input
                  label={t('auth.email')}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  required
                />

                <Button
                  title="Send Reset Link"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={styles.button}
                />

                <View style={styles.footer}>
                  <Text style={[styles.footerText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                    Remember your password?{' '}
                    <Link href="/(auth)/signin" style={styles.link}>
                      Sign In
                    </Link>
                  </Text>
                </View>
              </>
            )}
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // To balance the back button
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    padding: 24,
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
  link: {
    color: '#2563eb',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    padding: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  touchableOpacity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});