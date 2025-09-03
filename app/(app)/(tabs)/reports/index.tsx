```diff
--- a/app/(app)/(tabs)/reports/index.tsx
+++ b/app/(app)/(tabs)/reports/index.tsx
@@ -500,7 +500,7 @@
         const fileUri = \`${FileSystem.documentDirectory}${file.name}`;
         await FileSystem.writeAsStringAsync(fileUri, file.content, { encoding: FileSystem.EncodingType.UTF8 });
         
-        if (await Sharing.isAvailableAsync()) {
+        if (Sharing && await Sharing.isAvailableAsync()) {
           await Sharing.shareAsync(fileUri, {
             mimeType: 'text/csv',
             dialogTitle: \`Export ${file.name}`,
```