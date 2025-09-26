import { Tabs } from 'expo-router';
import React from 'react';

import { TabBarIcon } from '@/src/components/navigation/TabBarIcon';
import { useColorScheme } from '@/src/hooks/useColorScheme';
import { tabBarStyle } from '@/src/styles/tabBarStyle';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
      }}
    >
      <Tabs.Screen
        name="customers"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="top-customers"
        options={{
          title: 'Top Customers',
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="users" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}