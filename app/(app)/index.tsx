@@ .. @@
   const handleViewCustomerSalesReport = () => {
-    router.push(`/(app)/(tabs)/top-customers/customer-sales-report`);
+    router.push(`/(app)/top-customers/customer-sales-report`);
   };
 
   const TopCustomerCard = ({ customer }: { customer: TopCustomer }) => (
     <TouchableOpacity 
       style={styles.topItemRow}
-      onPress={() => router.push(`/(app)/(tabs)/top-customers/customer-sales-report?customerName=${encodeURIComponent(customer.name)}`)}
+      onPress={() => router.push(`/(app)/top-customers/customer-sales-report?customerName=${encodeURIComponent(customer.name)}`)}
       activeOpacity={0.7}
     >