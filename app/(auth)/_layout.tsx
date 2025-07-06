import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';

export default function AuthLayout() {
  const { session, profile, loading } = useAuth();
  
  console.log('AuthLayout: session:', session ? 'exists' : 'null', 'loading:', loading, 'profile:', profile ? 'exists' : 'null');

  if (loading) {
    return <LoadingSpinner text="Checking authentication..." />;
  }

  // Only redirect to app if both session and profile exist
  if (session && profile) {
    console.log('AuthLayout: Both session and profile exist, redirecting to app');
    return <Redirect href="/(app)/(tabs)" />;
  }

  // If session exists but profile doesn't, we'll stay on auth screens
  // This allows the user to sign in again if their profile failed to load
  if (session && !profile) {
    console.log('AuthLayout: Session exists but profile is missing');
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}