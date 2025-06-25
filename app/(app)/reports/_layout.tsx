import React from 'react';
import { Stack } from 'expo-router';

export default function ReportsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="income-statement" />
      <Stack.Screen name="cash-flow" />
    </Stack>
  );
}