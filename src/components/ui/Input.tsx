import React, { useState, forwardRef } from 'react';
import {
  TextInput,
  Text,
  View,
  StyleSheet,
  TextInputProps,
  TouchableOpacity
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
  showPasswordToggle?: boolean;
}

const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  required = false,
  showPasswordToggle = false,
  style,
  secureTextEntry,
  ...props
}, ref) => {
  const { isDark } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const containerStyle = {
    backgroundColor: isDark ? '#374151' : '#f9fafb',
    borderColor: error ? '#dc2626' : (isDark ? '#4b5563' : '#d1d5db'),
    color: isDark ? '#f9fafb' : '#111827',
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const isSecure = secureTextEntry && !isPasswordVisible;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View style={styles.inputWrapper}>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            containerStyle,
            showPasswordToggle && styles.inputWithIcon,
            style,
          ]}
          placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
          secureTextEntry={isSecure}
          {...props}
        />
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={togglePasswordVisibility}
            activeOpacity={0.7}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            ) : (
              <Eye size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
});

export default Input;

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
  inputWrapper: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  iconButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
});
