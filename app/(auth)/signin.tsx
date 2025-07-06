import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  TouchableOpacity
} from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { Input } from '@/src/components/ui/Input';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Square, SquareCheck as CheckSquare } from 'lucide-react-native';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { signIn, session } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  // Load saved credentials if "Remember Me" was checked
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('savedEmail');
        const savedRememberMe = await AsyncStorage.getItem('rememberMe');
        
        if (savedEmail && savedRememberMe === 'true') {
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
      setAuthError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setAuthError(null);
    
    try {
      // Save or remove credentials based on "Remember Me" checkbox
      if (rememberMe) {
        await AsyncStorage.setItem('savedEmail', email);
        await AsyncStorage.setItem('rememberMe', 'true');
      } else {
        await AsyncStorage.removeItem('savedEmail');
        await AsyncStorage.removeItem('rememberMe');
      }

      const { error } = await signIn(email, password);
      
      if (error) {
        Alert.alert(t('common.error'), error.message);
        setAuthError(error.message);
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
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
            {authError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{authError}</Text>
              </View>
            )}
            
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
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
});