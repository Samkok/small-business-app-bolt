import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/src/components/ui/Button';
import { X, UserPlus } from 'lucide-react-native';

interface EmailNotFoundModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
}

export function EmailNotFoundModal({ visible, email, onClose }: EmailNotFoundModalProps) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const handleGoToSignUp = () => {
    onClose();
    router.push({
      pathname: '/(auth)/signup',
      params: { email },
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.modalContainer,
            { backgroundColor: isDark ? '#1f2937' : '#ffffff' },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <X size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: isDark ? '#374151' : '#f3f4f6' },
              ]}
            >
              <UserPlus size={32} color="#ef4444" />
            </View>
          </View>

          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('auth.emailNotFound')}
          </Text>

          <Text style={[styles.message, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            The email <Text style={styles.emailText}>{email}</Text> is not registered.
            Would you like to create a new account?
          </Text>

          <View style={styles.buttonContainer}>
            <Button
              title={t('auth.signUp')}
              onPress={handleGoToSignUp}
              style={styles.signUpButton}
            />
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emailText: {
    fontWeight: '600',
    color: '#2563eb',
  },
  buttonContainer: {
    gap: 12,
  },
  signUpButton: {
    marginBottom: 0,
  },
  cancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
