import React from 'react';
import { Modal, ModalProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';

interface SheetModalProps extends ModalProps {
  /** Colour of the strip kept clear on the right; defaults to the screen background. */
  cornerBackground?: string;
}

/**
 * A full-height sheet (pageSheet / fullScreen Modal) whose content stays clear of the iPhone Duo
 * corner pill (camera, clock, signal), so a close button in the top-right corner stays visible.
 * The right inset is measured on the sheet itself: 0 on other iPhones, and 0 when the Duo shows
 * the sheet away from the pill.
 */
export function SheetModal({ children, cornerBackground, ...props }: SheetModalProps) {
  const { isDark } = useTheme();
  return (
    <Modal {...props}>
      <SafeAreaView
        edges={['right']}
        style={{ flex: 1, backgroundColor: cornerBackground ?? (isDark ? '#111827' : '#f9fafb') }}
      >
        {children}
      </SafeAreaView>
    </Modal>
  );
}
