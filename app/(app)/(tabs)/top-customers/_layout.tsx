@@ .. @@
-import { TabBarIcon } from '@/src/components/navigation/TabBarIcon';
-import { useColorScheme } from '@/src/hooks/useColorScheme';
-import { tabBarStyle } from '@/src/styles/tabBarStyle';
+import React from 'react';
+import { Stack } from 'expo-router';
 
-export default function TabLayout() {
-  const colorScheme = useColorScheme();
-
+export default function TopCustomersLayout() {
   return (
-    <Tabs
-      screenOptions={{
-        headerShown: false,
-        tabBarStyle,
-      }}
-    >
-      <Tabs.Screen
-        name="customers"
-        options={{
-          href: null,
-        }}
-      />
-      <Tabs.Screen
-        name="top-customers"
-        options={{
-          title: 'Top Customers',
-          tabBarIcon: ({ color }) => (
-            <TabBarIcon name="users" color={color} />
-          ),
-        }}
-      />
-    </Tabs>
+    <Stack screenOptions={{ headerShown: false }}>
+      <Stack.Screen name="index" />
+      <Stack.Screen name="customer-sales-report" />
+    </Stack>
   );
 }