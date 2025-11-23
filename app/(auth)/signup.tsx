import React, { useState } from 'react';
import { signUpSchema, validatePasswordStrength } from '@/src/lib/validation';
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
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword || !fullName) {
      Alert.alert(t('common.error'), 'Please fill in all fields');
      return;
    }

    const validation = signUpSchema.safeParse({
      email,
      password,
      confirmPassword,
      fullName,
    });

    if (!validation.success) {
      const errors = validation.error.errors.map(e => e.message).join('\n');
      Alert.alert(t('common.error'), errors);
      return;
    }

    const passwordStrength = validatePasswordStrength(password);
    if (!passwordStrength.isValid) {
      Alert.alert(
        'Weak Password',
        `Your password needs improvement:\n\n${passwordStrength.feedback.join('\n')}\n\nPassword strength: ${passwordStrength.score}/100`
      );
      return;
    }

    setLoading(true);
    const { error } = await signUp(validation.data.email, validation.data.password, validation.data.fullName);
    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      Alert.alert(
        t('common.success'),
        'Account created successfully! Please sign in to create your business.'
      );
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
              {t('app.name')}
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {t('auth.signUp')}
            </Text>
          </View>

          <Card style={styles.card}>
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
              showPasswordToggle
              required
            />

            <Input
              label={t('auth.confirmPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              showPasswordToggle
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