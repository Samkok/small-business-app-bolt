import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { loginRateLimiter, RateLimiter } from '@/src/lib/rateLimiter';
import { getRememberMeCredentials, setRememberMeCredentials, clearRememberMeCredentials } from '@/src/lib/secureStorage';
import { signInSchema } from '@/src/lib/validation';
import { Square, SquareCheck as CheckSquare } from 'lucide-react-native';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const { email: savedEmail, rememberMe: savedRememberMe } = await getRememberMeCredentials();

        if (savedEmail && savedRememberMe) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch (error) {
        console.error('Error loading saved credentials:', error);
      }
    };

    loadSavedCredentials();
  }, []);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), 'Please fill in all fields');
      return;
    }

    const validation = signInSchema.safeParse({ email, password });
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      Alert.alert(t('common.error'), firstError.message);
      return;
    }

    const rateLimitCheck = await loginRateLimiter.checkLimit(email.toLowerCase());
    if (!rateLimitCheck.allowed) {
      const blockDuration = rateLimitCheck.blockedUntil
        ? RateLimiter.formatBlockDuration(rateLimitCheck.blockedUntil - Date.now())
        : '30 minutes';
      Alert.alert(
        'Too Many Attempts',
        `Account temporarily locked due to multiple failed login attempts. Please try again in ${blockDuration}.`
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(validation.data.email, validation.data.password);

      if (error) {
        await loginRateLimiter.recordAttempt(email.toLowerCase());

        const remainingCheck = await loginRateLimiter.checkLimit(email.toLowerCase());
        let errorMessage = error.message;

        if (remainingCheck.remainingAttempts > 0) {
          errorMessage += `\n\nRemaining attempts: ${remainingCheck.remainingAttempts}`;
        }

        Alert.alert(t('common.error'), errorMessage);
      } else {
        await loginRateLimiter.resetLimit(email.toLowerCase());

        if (rememberMe) {
          await setRememberMeCredentials(email);
        } else {
          await clearRememberMeCredentials();
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert(t('common.error'), 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleRememberMe = () => {
    setRememberMe(!rememberMe);
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
              Business Manager Pro
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {t('auth.signIn')}
            </Text>
          </View>

          <Card style={styles.card}>
            <Input
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              required
            />

            <Input
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              required
            />

            <View style={styles.rememberForgotRow}>
              <TouchableOpacity 
                style={styles.rememberMeContainer} 
                onPress={toggleRememberMe}
                activeOpacity={0.7}
              >
                {rememberMe ? (
                  <CheckSquare size={20} color="#2563eb" />
                ) : (
                  <Square size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                )}
                <Text style={[styles.rememberMeText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Remember me
                </Text>
              </TouchableOpacity>

              <Link href="/(auth)/forgot-password" style={styles.forgotPasswordLink}>
                {t('auth.forgotPassword')}
              </Link>
            </View>

            <Button
              title={t('auth.signIn')}
              onPress={handleSignIn}
              loading={loading}
              style={styles.button}
            />

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('auth.dontHaveAccount')}{' '}
                <Link href="/(auth)/signup" style={styles.link}>
                  {t('auth.signUp')}
                </Link>
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  card: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    padding: 24,
  },
  rememberForgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberMeText: {
    marginLeft: 8,
    fontSize: 14,
  },
  forgotPasswordLink: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
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
});