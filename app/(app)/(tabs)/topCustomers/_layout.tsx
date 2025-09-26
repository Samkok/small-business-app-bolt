import { Tabs } from 'expo-router';
import React from 'react';
import TabBarIcon from '@/app/components/TabBarIcon';

export default function TabLayout() {

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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