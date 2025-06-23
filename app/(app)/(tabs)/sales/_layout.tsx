import React from 'react';
import { Stack } from 'expo-router';

export default function SalesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="customer-selection" />
      <Stack.Screen name="product-selection" />
      <Stack.Screen name="cart/[cartId]" />
      <Stack.Screen name="checkout/[cartId]" />
    </Stack>
  );
}