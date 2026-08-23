import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface PasswordStrengthIndicatorProps {
  password: string;
  visible?: boolean;
}

export function PasswordStrengthIndicator({ password, visible = true }: PasswordStrengthIndicatorProps) {
  const { isDark } = useTheme();

  if (!visible || !password) return null;

  const checks = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = checks.filter(c => c.met).length;
  const strength = metCount / checks.length;

  const getStrengthColor = () => {
    if (strength <= 0.2) return '#dc2626';
    if (strength <= 0.4) return '#ea580c';
    if (strength <= 0.6) return '#d97706';
    if (strength <= 0.8) return '#65a30d';
    return '#16a34a';
  };

  const getStrengthLabel = () => {
    if (strength <= 0.2) return 'Very Weak';
    if (strength <= 0.4) return 'Weak';
    if (strength <= 0.6) return 'Fair';
    if (strength <= 0.8) return 'Good';
    return 'Strong';
  };

  return (
    <View style={styles.container}>
      <View style={styles.barContainer}>
        <View style={[styles.barBackground, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
          <View
            style={[
              styles.barFill,
              { width: `${strength * 100}%`, backgroundColor: getStrengthColor() },
            ]}
          />
        </View>
        <Text style={[styles.strengthLabel, { color: getStrengthColor() }]}>
          {getStrengthLabel()}
        </Text>
      </View>
      <View style={styles.checksContainer}>
        {checks.map((check) => (
          <View key={check.label} style={styles.checkRow}>
            <View style={[styles.dot, { backgroundColor: check.met ? '#16a34a' : (isDark ? '#4b5563' : '#d1d5db') }]} />
            <Text style={[
              styles.checkText,
              { color: check.met ? (isDark ? '#86efac' : '#16a34a') : (isDark ? '#6b7280' : '#9ca3af') }
            ]}>
              {check.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: -8,
    marginBottom: 16,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  barBackground: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 64,
    textAlign: 'right',
  },
  checksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '48%',
    marginBottom: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  checkText: {
    fontSize: 11,
    lineHeight: 14,
  },
});
