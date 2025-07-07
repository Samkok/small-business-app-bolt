import React from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Package } from 'lucide-react-native';

interface SplashScreenProps {
  message?: string;
  showSpinner?: boolean;
}

export function SplashScreen({ message = 'Loading your business...', showSpinner = true }: SplashScreenProps) {
  const { isDark } = useTheme();

  return (
    <View style={[
      styles.container, 
      { backgroundColor: isDark ? '#111827' : '#f9fafb' }
    ]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={[styles.logoBackground, { backgroundColor: '#2563eb' }]}>
            <Package size={48} color="#ffffff" />
          </View>
        </View>
        
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Business Manager Pro
        </Text>
        
        <Text style={[styles.subtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Complete business management solution
        </Text>
        
        {showSpinner && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" style={styles.spinner} />
            <Text style={[styles.loadingText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {message}
            </Text>
          </View>
        )}
      </View>
      
      <Text style={[styles.versionText, { color: isDark ? '#6b7280' : '#9ca3af' }]}>
        Version 1.0.0
      </Text>
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
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 300,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoBackground: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 48,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
  },
  versionText: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
  },
});