import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from '@/src/locales';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ShieldAlert } from 'lucide-react-native';

interface UnauthorizedDeleteModalProps {
  visible: boolean;
  onClose: () => void;
}

export function UnauthorizedDeleteModal({ visible, onClose }: UnauthorizedDeleteModalProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Card style={[styles.modal, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <ShieldAlert size={48} color="#ef4444" />
            </View>
          </View>

          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('settings.deleteBusinessUnauthorized')}
          </Text>

          <Text style={[styles.message, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            {t('settings.deleteBusinessUnauthorizedMessage')}
          </Text>

          <Button
            title={t('common.ok')}
            onPress={onClose}
            style={styles.button}
          />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fee2e2',
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
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    marginTop: 8,
  },
});
