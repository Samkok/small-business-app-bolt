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
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword || !businessName || !fullName) {
      Alert.alert(t('common.error'), 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.passwordsDontMatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, businessName, fullName);
    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      Alert.alert(t('common.success'), 'Account created successfully! Please sign in.');
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
              Business Manager Pro
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {t('auth.signUp')}
            </Text>
          </View>

          <Card style={styles.card}>
            <Input
              label={t('auth.businessName')}
              value={businessName}
              onChangeText={setBusinessName}
              autoCapitalize="words"
              required
            />

            <Input
              label={t('auth.fullName')}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              required
            />

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

            <Input
              label={t('auth.confirmPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              required
            />

            <Button
              title={t('auth.signUp')}
              onPress={handleSignUp}
              loading={loading}
              style={styles.button}
            />

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('auth.alreadyHaveAccount')}{' '}
                <Link href="/(auth)/signin" style={styles.link}>
                  {t('auth.signIn')}
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
  },
  button: {
    marginTop: 8,
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