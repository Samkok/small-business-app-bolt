import React from 'react';
import { Stack } from 'expo-router';

export default function InventoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen key="index" name="index" />
      <Stack.Screen key="low-stock" name="low-stock" />
    </Stack>
  );
}