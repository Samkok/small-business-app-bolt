import React from 'react';
import { 
  TextInput, 
  Text, 
  View, 
  StyleSheet,
  TextInputProps
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
}

export function Input({
  label,
  error,
  required = false,
  style,
  ...props
}: InputProps) {
  const { isDark } = useTheme();

  const containerStyle = {
    backgroundColor: isDark ? '#374151' : '#f9fafb',
    borderColor: error ? '#dc2626' : (isDark ? '#4b5563' : '#d1d5db'),
    color: isDark ? '#f9fafb' : '#111827',
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          containerStyle,
          style,
        ]}
        placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  required: {
    color: '#dc2626',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
});