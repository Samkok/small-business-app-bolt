import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { CheckCircle, Eye, Plus, X } from 'lucide-react-native';

interface PostSaleActionModalProps {
  visible: boolean;
  saleId: string;
  saleAmount: number;
  customerName: string;
  onDismiss: () => void;
  onViewSale: () => void;
  onNewSale: () => void;
}

export function PostSaleActionModal({
  visible,
  saleId,
  saleAmount,
  customerName,
  onDismiss,
  onViewSale,
  onNewSale,
}: PostSaleActionModalProps) {
  const { isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Card style={[styles.modalCard, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDismiss}
          >
            <X size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
          </TouchableOpacity>

          <View style={styles.successHeader}>
            <CheckCircle size={64} color="#10b981" />
            <Text style={[styles.successTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Sale Completed!
            </Text>
          </View>

          <View style={[styles.saleInfoCard, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
            <View style={styles.saleInfoRow}>
              <Text style={[styles.saleInfoLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Amount:
              </Text>
              <Text style={[styles.saleInfoValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                ${saleAmount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.saleInfoRow}>
              <Text style={[styles.saleInfoLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Customer:
              </Text>
              <Text style={[styles.saleInfoValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>
                {customerName}
              </Text>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <Button
              title="Create New Sale"
              onPress={onNewSale}
              icon={<Plus size={20} color="#ffffff" />}
              style={styles.primaryButton}
            />

            <TouchableOpacity
              style={[
                styles.secondaryButton,
                {
                  borderColor: isDark ? '#4b5563' : '#d1d5db',
                  backgroundColor: isDark ? '#374151' : '#ffffff',
                }
              ]}
              onPress={onViewSale}
            >
              <Eye size={20} color="#2563eb" />
              <Text style={styles.secondaryButtonText}>View Sale Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={onDismiss}
            >
              <Text style={[styles.tertiaryButtonText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                Dismiss
              </Text>
            </TouchableOpacity>
          </View>
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
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  saleInfoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  saleInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saleInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  saleInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryButton: {
    width: '100%',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  tertiaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
