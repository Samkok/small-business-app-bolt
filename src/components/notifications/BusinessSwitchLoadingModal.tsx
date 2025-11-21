import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface BusinessSwitchLoadingModalProps {
  visible: boolean;
  businessName?: string;
  loading: boolean;
  error?: {
    type: string;
    message: string;
  } | null;
  onDismiss: () => void;
  onRetry?: () => void;
}

export default function BusinessSwitchLoadingModal({
  visible,
  businessName,
  loading,
  error,
  onDismiss,
  onRetry,
}: BusinessSwitchLoadingModalProps) {
  const { isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { backgroundColor: isDark ? '#1f2937' : '#ffffff' },
          ]}
        >
          {loading ? (
            <>
              <ActivityIndicator
                size="large"
                color="#2563eb"
                style={styles.spinner}
              />
              <Text
                style={[
                  styles.title,
                  { color: isDark ? '#f9fafb' : '#111827' },
                ]}
              >
                Loading Business Data
              </Text>
              <Text
                style={[
                  styles.message,
                  { color: isDark ? '#d1d5db' : '#6b7280' },
                ]}
              >
                {businessName
                  ? `Switching to ${businessName}...`
                  : 'Preparing your business...'}
              </Text>
              <Text
                style={[
                  styles.subMessage,
                  { color: isDark ? '#9ca3af' : '#9ca3af' },
                ]}
              >
                This may take a few moments
              </Text>
            </>
          ) : error ? (
            <>
              <View
                style={[
                  styles.errorIconContainer,
                  { backgroundColor: isDark ? '#374151' : '#fee2e2' },
                ]}
              >
                <AlertCircle size={48} color="#dc2626" />
              </View>
              <Text
                style={[
                  styles.title,
                  { color: isDark ? '#f9fafb' : '#111827' },
                ]}
              >
                Unable to Load Business
              </Text>
              <Text
                style={[
                  styles.message,
                  { color: isDark ? '#d1d5db' : '#6b7280' },
                ]}
              >
                {error.message}
              </Text>
              <View style={styles.buttonContainer}>
                {onRetry && (
                  <TouchableOpacity
                    style={[styles.button, styles.retryButton]}
                    onPress={onRetry}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.dismissButton,
                    { backgroundColor: isDark ? '#374151' : '#e5e7eb' },
                  ]}
                  onPress={onDismiss}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dismissButtonText,
                      { color: isDark ? '#f9fafb' : '#111827' },
                    ]}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
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
  container: {
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  spinner: {
    marginBottom: 24,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  subMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#2563eb',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    flex: 1,
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
