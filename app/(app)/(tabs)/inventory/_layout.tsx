import React from 'react';
import { Stack } from 'expo-router';

export default function InventoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="low-stock" />
      <Stack.Screen name="product-details" />
    </Stack>
  );
}