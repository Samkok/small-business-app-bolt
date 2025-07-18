@@ .. @@
   };

   return (
-    <View style={style}>
+    <View style={[style, { overflow: 'hidden' }]}>
       <Image
         source={source}
         onLoadStart={handleLoadStart}
         onLoadEnd={handleLoadEnd}
         onError={handleError}
-        style={[StyleSheet.absoluteFillObject]}
+        style={[StyleSheet.absoluteFillObject, StyleSheet.flatten(style)]}
         accessibilityLabel={alt}
         {...props}
       />
       {loading && showPlaceholder && (
-        <View style={[styles.placeholder, placeholderStyle, StyleSheet.absoluteFillObject]}>
+        <View style={[styles.placeholder, placeholderStyle, StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
           <ImageIcon size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
           <Text style={[styles.placeholderText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
             Loading...
           </Text>
         </View>
       )}
     </View>
   );
 }