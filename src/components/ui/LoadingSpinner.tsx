import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface LoadingSpinnerProps {
  text?: string;
  size?: 'small' | 'large';
}

export function LoadingSpinner({ text, size = 'large' }: LoadingSpinnerProps) {
  const { isDark } = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color="#2563eb" />
      {text && (
        <Text style={[styles.text, { color: isDark ? '#f9fafb' : '#374151' }]}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
});