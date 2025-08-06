@@ .. @@
       if (item.base_unit_cost_per_item === null || item.base_unit_cost_per_item < 0) {
         const product = getProductById(item.product_id);
-        Alert.alert('Error', `Please enter a valid base cost for ${product?.name || 'selected product'}`);
+        Alert.alert('Error', 'Please enter a valid base cost for ' + (product?.name || 'selected product'));
         return;
       }
     }

@@ .. @@
       if (cost.amount === null || cost.amount < 0) {
-        Alert.alert('Error', 'Please enter valid amounts for all additional costs');
+        Alert.alert('Error', 'Please enter valid amounts for all additional costs');
         return;
       }
     }