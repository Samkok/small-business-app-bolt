import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { UserX, AlertCircle } from 'lucide-react-native';

interface UserAlreadyRemovedModalProps {
  visible: boolean;
  userName: string;
  onClose: () => void;
}

export function UserAlreadyRemovedModal({ visible, userName, onClose }: UserAlreadyRemovedModalProps) {
  const { isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Card style={[styles.modalContent, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
              <AlertCircle size={48} color="#f59e0b" />
            </View>
          </View>

          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            User Already Removed
          </Text>

          <Text style={[styles.message, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            <Text style={styles.userName}>{userName}</Text> is no longer a member of this business. They may have been removed by another admin or may have left the business.
          </Text>

          <View style={styles.infoBox}>
            <UserX size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={[styles.infoText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              The team member list will be refreshed to show the current members.
            </Text>
          </View>

          <Button
            title="Got it"
            onPress={onClose}
            style={styles.button}
          />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  userName: {
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    width: '100%',
  },
});
