import React, { useState, useCallback } from 'react';
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
  ScrollView,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import Input from '@/src/components/ui/Input';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { PasswordStrengthIndicator } from '@/src/components/ui/PasswordStrengthIndicator';
import { FormSuccessMessage } from '@/src/components/ui/FormSuccessMessage';
import { Square, SquareCheck as CheckSquare } from 'lucide-react-native';
import { useFormValidation } from '@/src/hooks/useFormValidation';
import { signUpSchema, emailSchema, nameSchema, passwordSchema } from '@/src/lib/validation';
import { FieldStatus } from '@/src/hooks/useFormValidation';

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const { signUp } = useAuth();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const form = useFormValidation({
    schema: signUpSchema,
    initialValues: {
      email: params.email || '',
      password: '',
      confirmPassword: '',
      fullName: '',
    },
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 400,
  });

  const getFieldStatus = (fieldName: string): FieldStatus => {
    const field = form.fields[fieldName];
    if (!field || !field.touched) return 'idle';
    return field.status;
  };

  const handleSignUp = async () => {
    if (!agreedToTerms) {
      setTermsError(t('auth.mustAgreeToTerms'));
      return;
    }
    setTermsError('');

    const isValid = form.validateAll();
    if (!isValid) return;

    setLoading(true);
    const values = form.getValues();
    const { error } = await signUp(values.email, values.password, values.fullName);
    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      setSignUpSuccess(true);
    }
  };

  const toggleAgreedToTerms = () => {
    setAgreedToTerms(!agreedToTerms);
    if (!agreedToTerms) {
      setTermsError('');
    }
  };

  const validateEmailFormat = useCallback((value: string): string | undefined => {
    if (!value) return undefined;
    const result = emailSchema.safeParse(value);
    if (!result.success) return result.error.errors[0]?.message;
    return undefined;
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('app.name')}
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {t('auth.signUp')}
            </Text>
          </View>

          <Card style={styles.card}>
            <FormSuccessMessage
              visible={signUpSuccess}
              message="Account created successfully! Signing you in..."
            />

            <Input
              label={t('auth.fullName')}
              value={form.fields.fullName?.value || ''}
              onChangeText={(v) => form.setValue('fullName', v)}
              onBlur={() => form.setTouched('fullName')}
              autoCapitalize="words"
              required
              error={form.fields.fullName?.touched ? form.fields.fullName?.error || undefined : undefined}
              validationStatus={getFieldStatus('fullName')}
              hint="Your first and last name"
              successMessage="Looks good!"
            />

            <Input
              label={t('auth.email')}
              value={form.fields.email?.value || ''}
              onChangeText={(v) => form.setValue('email', v)}
              onBlur={() => form.setTouched('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              required
              error={form.fields.email?.touched ? form.fields.email?.error || undefined : undefined}
              validationStatus={getFieldStatus('email')}
              hint="We'll use this to sign you in"
              successMessage="Valid email"
            />

            <Input
              label={t('auth.password')}
              value={form.fields.password?.value || ''}
              onChangeText={(v) => form.setValue('password', v)}
              onBlur={() => form.setTouched('password')}
              secureTextEntry
              autoComplete="password"
              showPasswordToggle
              required
              error={form.fields.password?.touched ? form.fields.password?.error || undefined : undefined}
              validationStatus={getFieldStatus('password')}
            />

            <PasswordStrengthIndicator
              password={form.fields.password?.value || ''}
              visible={!!form.fields.password?.value}
            />

            <Input
              label={t('auth.confirmPassword')}
              value={form.fields.confirmPassword?.value || ''}
              onChangeText={(v) => form.setValue('confirmPassword', v)}
              onBlur={() => form.setTouched('confirmPassword')}
              secureTextEntry
              showPasswordToggle
              required
              error={form.fields.confirmPassword?.touched ? form.fields.confirmPassword?.error || undefined : undefined}
              validationStatus={getFieldStatus('confirmPassword')}
              successMessage="Passwords match"
            />

            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={toggleAgreedToTerms}
                activeOpacity={0.7}
              >
                {agreedToTerms ? (
                  <CheckSquare size={20} color="#2563eb" />
                ) : (
                  <Square size={20} color={termsError ? '#dc2626' : (isDark ? '#9ca3af' : '#6b7280')} />
                )}
              </TouchableOpacity>
              <View style={styles.termsTextContainer}>
                <Text style={[styles.termsText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {t('auth.agreeToTermsPrefix')}{' '}
                  <Link href="/(auth)/terms" style={styles.termsLink}>
                    {t('auth.termsAndConditions')}
                  </Link>
                </Text>
              </View>
            </View>
            {termsError ? (
              <Text style={styles.termsError}>{termsError}</Text>
            ) : null}

            <Button
              title={t('auth.signUp')}
              onPress={handleSignUp}
              loading={loading}
              disabled={!agreedToTerms || loading}
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
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 4,
  },
  checkboxContainer: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsTextContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 12,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  termsLink: {
    color: '#2563eb',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  termsError: {
    color: '#dc2626',
    fontSize: 12,
    marginLeft: 44,
    marginBottom: 8,
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
