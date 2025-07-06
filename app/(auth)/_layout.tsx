import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SplashScreen } from '@/src/components/ui/SplashScreen';

export default function AuthLayout() {
  const { session, loading, splashLoading } = useAuth();

  if (splashLoading) {
    return <SplashScreen />;
  }

  if (loading) {
    return <LoadingSpinner text="Loading..." />;
  }

  if (session) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}