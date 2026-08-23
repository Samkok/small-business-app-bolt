import React, { useState, forwardRef, useEffect, useRef } from 'react';
import {
  TextInput,
  Text,
  View,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Eye, EyeOff, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Info } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { FieldStatus } from '../../hooks/useFormValidation';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
  showPasswordToggle?: boolean;
  hint?: string;
  validationStatus?: FieldStatus;
  successMessage?: string;
  showValidationIcon?: boolean;
}

const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  required = false,
  showPasswordToggle = false,
  hint,
  validationStatus,
  successMessage,
  showValidationIcon = true,
  style,
  secureTextEntry,
  ...props
}, ref) => {
  const { isDark } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const errorAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      Animated.spring(errorAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(errorAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [error]);

  const getBorderColor = () => {
    if (error || validationStatus === 'error') return '#dc2626';
    if (validationStatus === 'valid') return '#16a34a';
    return isDark ? '#4b5563' : '#d1d5db';
  };

  const containerStyle = {
    backgroundColor: isDark ? '#374151' : '#f9fafb',
    borderColor: getBorderColor(),
    color: isDark ? '#f9fafb' : '#111827',
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const isSecure = secureTextEntry && !isPasswordVisible;

  const showSuccess = validationStatus === 'valid' && !error && showValidationIcon;
  const showError = (validationStatus === 'error' || !!error) && showValidationIcon;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: isDark ? '#f9fafb' : '#374151' }]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      {hint && !error && validationStatus !== 'valid' && (
        <View style={styles.hintRow}>
          <Info size={12} color={isDark ? '#9ca3af' : '#6b7280'} />
          <Text style={[styles.hint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{hint}</Text>
        </View>
      )}
      <Animated.View style={[styles.inputWrapper, { transform: [{ translateX: shakeAnim }] }]}>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            containerStyle,
            (showPasswordToggle || showSuccess || showError) && styles.inputWithIcon,
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
        {!showPasswordToggle && showSuccess && (
          <View style={styles.validationIcon}>
            <CheckCircle size={18} color="#16a34a" />
          </View>
        )}
        {!showPasswordToggle && showError && (
          <View style={styles.validationIcon}>
            <AlertCircle size={18} color="#dc2626" />
          </View>
        )}
      </Animated.View>
      {error && (
        <Animated.View style={[styles.errorRow, { opacity: errorAnim }]}>
          <Text style={styles.error}>{error}</Text>
        </Animated.View>
      )}
      {showSuccess && successMessage && (
        <Text style={styles.success}>{successMessage}</Text>
      )}
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
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
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
  validationIcon: {
    position: 'absolute',
    right: 12,
    top: 14,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    lineHeight: 16,
  },
  success: {
    color: '#16a34a',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
});
