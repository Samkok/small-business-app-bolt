import React, { useState, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { supabase } from '@/src/config/supabase';
import { Lock, CheckCircle } from 'lucide-react-native';
import * as Linking from 'expo-linking';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleDeepLink();
  }, []);

  const handleDeepLink = async () => {
    try {
      console.log('Handling password reset deep link...');
      console.log('URL params:', params);

      // Get the initial URL that opened the app
      const url = await Linking.getInitialURL();
      console.log('Initial URL:', url);

      // Try to extract access_token and refresh_token from URL
      let accessToken = params.access_token as string;
      let refreshToken = params.refresh_token as string;
      let type = params.type as string;

      // If not in params, try parsing the URL
      if (!accessToken && url) {
        const parsedUrl = Linking.parse(url);
        console.log('Parsed URL:', parsedUrl);

        if (parsedUrl.queryParams) {
          accessToken = parsedUrl.queryParams.access_token as string;
          refreshToken = parsedUrl.queryParams.refresh_token as string;
          type = parsedUrl.queryParams.type as string;
        }
      }

      console.log('Tokens found:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, type });

      // If we have tokens, set the session
      if (accessToken && refreshToken && type === 'recovery') {
        console.log('Setting session with recovery tokens...');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Error setting session:', error);
          throw error;
        }

        console.log('Session set successfully');
        setIsValidSession(true);
      } else {
        // If no tokens in URL, check if there's an existing session
        await checkSession();
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
      Alert.alert(
        'Invalid Reset Link',
        'This password reset link is invalid or has expired. Please request a new one.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(auth)/forgot-password')
          }
        ]
      );
    }
  };

  const checkSession = async () => {
    try {
      console.log('Checking for existing password reset session...');
      const { data: { session }, error } = await supabase.auth.getSession();

      console.log('Session check result:', { hasSession: !!session, error });

      if (session) {
        console.log('Valid session found for password reset');
        setIsValidSession(true);
      } else {
        console.log('No valid session found');
        Alert.alert(
          'Invalid Reset Link',
          'This password reset link is invalid or has expired. Please request a new one.',
          [
            {
              text: 'OK',
              onPress: () => router.push('/(auth)/forgot-password')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error checking session:', error);
      Alert.alert(
        'Error',
        'Unable to verify reset link. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(auth)/forgot-password')
          }
        ]
      );
    }
  };

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
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Password update error:', error);
        Alert.alert(t('common.error'), error.message);
      } else {
        setResetComplete(true);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert(t('common.error'), 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!isValidSession) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.inner}>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Checking reset link...
          </Text>
        </View>
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
                  onPress={() => router.push('/(auth)/signin')}
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
                  required
                />

                <Input
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
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
