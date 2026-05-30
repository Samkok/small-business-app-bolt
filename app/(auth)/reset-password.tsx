import React, { useState, useEffect, useRef } from 'react';
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
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { supabase } from '@/src/config/supabase';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { Lock, CheckCircle } from 'lucide-react-native';
import * as Linking from 'expo-linking';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [waitingForSession, setWaitingForSession] = useState(true);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isPasswordRecovery, clearPasswordRecovery, session } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptedTokenExtraction = useRef(false);

  useEffect(() => {
    if (isPasswordRecovery || session) {
      setWaitingForSession(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [isPasswordRecovery, session]);

  useEffect(() => {
    if (Platform.OS !== 'web' && !attemptedTokenExtraction.current) {
      attemptedTokenExtraction.current = true;
      Linking.getInitialURL().then(async (url) => {
        if (!url) return;
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) return;

        const hash = url.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken && type === 'recovery') {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      });
    } else if (Platform.OS === 'web' && !attemptedTokenExtraction.current) {
      attemptedTokenExtraction.current = true;
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken && type === 'recovery') {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    }
  }, []);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!isPasswordRecovery && !session) {
        setWaitingForSession(false);
        Alert.alert(
          'Invalid Reset Link',
          'This password reset link is invalid or has expired. Please request a new one.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/forgot-password') }]
        );
      }
    }, 5000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert(t('common.error'), 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error'), 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        Alert.alert(t('common.error'), error.message);
      } else {
        clearPasswordRecovery();
        setResetComplete(true);
      }
    } catch (error) {
      Alert.alert(t('common.error'), 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (waitingForSession) {
    return (
      <View style={[styles.container, styles.inner, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <LoadingSpinner text="Verifying reset link..." />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Reset Password
            </Text>
          </View>

          <Card style={styles.card}>
            {resetComplete ? (
              <View style={styles.successContainer}>
                <CheckCircle size={48} color="#10b981" />
                <Text style={[styles.successTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Password Reset Successful
                </Text>
                <Text style={[styles.successText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Your password has been successfully reset. You can now sign in with your new password.
                </Text>
                <Button
                  title="Go to Sign In"
                  onPress={() => router.replace('/(auth)/signin')}
                  style={styles.button}
                />
              </View>
            ) : (
              <>
                <View style={styles.iconContainer}>
                  <Lock size={32} color="#2563eb" />
                </View>

                <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Enter your new password below. Make sure it's at least 6 characters long.
                </Text>

                <Input
                  label="New Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  showPasswordToggle
                  required
                />

                <Input
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  showPasswordToggle
                  required
                />

                <Button
                  title="Reset Password"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={styles.button}
                />
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
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  card: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
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
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});
