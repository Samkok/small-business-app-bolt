import React from 'react';
import { Stack } from 'expo-router';

export default function CustomersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="customer-sales-report" />
    </Stack>
  );
}