import React from 'react';
import { Stack } from 'expo-router';

export default function InventoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen key="index-inventory" name="index" />
      <Stack.Screen key="low-stock" name="low-stock" />
      <Stack.Screen key="product-selection" name="product-selection" />
      <Stack.Screen key="import-form" name="import-form" />
    </Stack>
  );
}