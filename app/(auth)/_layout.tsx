import React from 'react';
import { Redirect, Stack, useSegments, useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { View, Text, StyleSheet, Alert } from 'react-native';

export default function AuthLayout() {
  const { session, loading, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  
  console.log('AuthLayout rendering with loading:', loading, 'session:', session ? 'exists' : 'null', 'profile:', profile ? 'exists' : 'null');

  // Determine if we're on a protected route
  const isProtectedRoute = segments[0] === '(app)';

  // Show loading state while authentication is in progress
  if (loading && !isProtectedRoute) {
    console.log('AuthLayout: Showing loading spinner while authenticating');
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner text="Preparing your account..." />
        <Text style={styles.loadingText}>Please wait while we load your data</Text>
      </View>
    );
  }

  // If we have a session and profile, redirect to the app
  if (session && profile) {
    console.log('AuthLayout: Session and profile found, redirecting to app');
    return <Redirect href="/(app)/(tabs)" replace={true} />;
  }

  // If we have a session but no profile, show a loading state
  if (session && !profile && !loading) {
    console.log('AuthLayout: Session found but no profile, showing error state');
    // Instead of showing an error state, redirect to sign-in
    Alert.alert(
      'Account Setup Incomplete',
      'We couldn\'t load your profile information. Please sign in again.',
      [{ text: 'OK' }]
    );
    return <Redirect href="/(auth)/signin" replace={true} />;
  }

  // If no session and not loading, show auth screens
  console.log('AuthLayout: No session, showing auth screens');
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  }
});