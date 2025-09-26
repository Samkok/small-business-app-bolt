import React from 'react';
import { Redirect } from 'expo-router';

export default function TopCustomersIndex() {
  // Redirect to the customer sales report as the default view
  return <Redirect href="/(app)/(tabs)/top-customers/customer-sales-report" />;
}