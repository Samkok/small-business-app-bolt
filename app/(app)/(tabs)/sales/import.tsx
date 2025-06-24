import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ArrowLeft, FileUp, Download, FileText, Upload, CircleCheck as CheckCircle } from 'lucide-react-native';
import { importService } from '@/src/services/importService';

export default function ImportSalesScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importComplete, setImportComplete] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const router = useRouter();
  const { isDark } = useTheme();
  const { profile } = useAuth();

  const handleFileSelect = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      Alert.alert('Not Supported', 'CSV import is currently only supported on web platform');
    }
  };

  const handleFileChange = (event: any) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      Alert.alert('Invalid File', 'Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    
    // Read file content for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!profile?.id) {
      Alert.alert('Error', 'No business profile found');
      return;
    }

    if (!file && !csvContent) {
      Alert.alert('Error', 'Please select a CSV file to import');
      return;
    }

    setLoading(true);
    try {
      let results;
      
      if (file) {
        results = await importService.importSalesFromFile(file, profile.id);
      } else if (csvContent) {
        results = await importService.importSalesFromCsv(csvContent!, profile.id);
      } else {
        throw new Error('No file or content to import');
      }
      
      setImportResult(results);
      
      const successCount = results.filter((r: any) => r.success).length;
      const failureCount = results.filter((r: any) => !r.success).length;
      
      if (failureCount === 0) {
        Alert.alert('Success', `Successfully imported ${successCount} sales records`);
      } else {
        Alert.alert(
          'Import Completed with Errors',
          `Successfully imported ${successCount} sales records, but ${failureCount} records failed`
        );
      }
      
      setImportComplete(successCount > 0);
    } catch (error) {
      console.error('Error importing data:', error);
      Alert.alert('Error', 'Failed to import sales data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Not Supported', 'Template download is only available on web platform');
      return;
    }

    const template = importService.generateSalesCsvTemplate();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderPreview = () => {
    if (!csvContent) return null;
    
    const lines = csvContent.split('\n').slice(0, 6); // Show first 5 lines + header
    
    return (
      <View style={styles.previewContainer}>
        <Text style={[styles.previewTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          File Preview
        </Text>
        <ScrollView 
          horizontal 
          style={styles.previewScroll}
          showsHorizontalScrollIndicator={true}
        >
          <View>
            {lines.map((line, index) => (
              <Text 
                key={index} 
                style={[
                  styles.previewLine, 
                  index === 0 && styles.previewHeader,
                  { color: isDark ? '#d1d5db' : '#374151' }
                ]}
                numberOfLines={1}
              >
                {line}
              </Text>
            ))}
            {csvContent.split('\n').length > 6 && (
              <Text style={[styles.previewMore, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                ... {csvContent.split('\n').length - 6} more rows
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderResults = () => {
    if (!importResult) return null;
    
    const successCount = importResult.filter((r: any) => r.success).length;
    const failureCount = importResult.filter((r: any) => !r.success).length;
    
    return (
      <View style={styles.resultsContainer}>
        <Text style={[styles.resultsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Import Results
        </Text>
        
        <View style={styles.resultsSummary}>
          <View style={styles.resultItem}>
            <Text style={[styles.resultLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Total Records:
            </Text>
            <Text style={[styles.resultValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {importResult.length}
            </Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={[styles.resultLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Successful:
            </Text>
            <Text style={[styles.resultValue, { color: '#059669' }]}>
              {successCount}
            </Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={[styles.resultLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Failed:
            </Text>
            <Text style={[styles.resultValue, { color: '#dc2626' }]}>
              {failureCount}
            </Text>
          </View>
        </View>
        
        {failureCount > 0 && (
          <View style={styles.errorList}>
            <Text style={[styles.errorListTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Failed Records:
            </Text>
            
            <ScrollView style={styles.errorScroll}>
              {importResult
                .filter((result: any) => !result.success)
                .map((result: any, index: number) => (
                  <View 
                    key={index} 
                    style={[
                      styles.errorItem, 
                      { backgroundColor: isDark ? '#4b5563' : '#f3f4f6' }
                    ]}
                  >
                    <View style={styles.errorHeader}>
                      <Text style={[styles.errorProductId, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        Error on row {index + 1}
                      </Text>
                    </View>
                    <Text style={[styles.errorMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {result.message || 'Unknown error occurred'}
                    </Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Import Sales
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <LoadingSpinner text="Importing sales data..." />
      </View>
    );
  }

  if (importComplete) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Import Complete
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.successContainer}>
          <CheckCircle size={64} color="#059669" />
          <Text style={[styles.successTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Import Successful
          </Text>
          <Text style={[styles.successText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            Your sales data has been successfully imported
          </Text>
          
          {renderResults()}
          
          <View style={styles.successActions}>
            <Button
              title="Import More"
              variant="outline"
              onPress={() => {
                setFile(null);
                setCsvContent(null);
                setImportResult(null);
                setImportComplete(false);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              style={styles.successButton}
            />
            <Button
              title="View Sales"
              onPress={() => router.push('/sales')}
              style={styles.successButton}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Import Sales
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.uploadCard}>
          {!file && !csvContent ? (
            <TouchableOpacity
              style={[
                styles.uploadArea,
                { 
                  backgroundColor: isDark ? '#374151' : '#f9fafb',
                  borderColor: isDark ? '#4b5563' : '#d1d5db'
                }
              ]}
              onPress={handleFileSelect}
              disabled={loading}
            >
              <Upload size={48} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={[styles.uploadText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Click to select a CSV file
              </Text>
              <Text style={[styles.uploadSubtext, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                The file should contain sales data in the correct format
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.fileInfo}>
              <View style={styles.fileHeader}>
                <FileText size={24} color="#2563eb" />
                <View style={styles.fileDetails}>
                  <Text style={[styles.fileName, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    {file ? file.name : 'CSV Data'}
                  </Text>
                  {file && (
                    <Text style={[styles.fileSize, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      {(file.size / 1024).toFixed(2)} KB
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => {
                    setFile(null);
                    setCsvContent(null);
                    setImportResult(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  disabled={loading}
                >
                  <Text style={{ color: '#dc2626' }}>Remove</Text>
                </TouchableOpacity>
              </View>
              
              {renderPreview()}
            </View>
          )}
          
          {/* Web file input */}
          {Platform.OS === 'web' && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          )}
        </Card>
        
        <TouchableOpacity
          style={styles.templateButton}
          onPress={handleDownloadTemplate}
        >
          <Download size={16} color="#2563eb" />
          <Text style={styles.templateText}>Download CSV Template</Text>
        </TouchableOpacity>
        
        {renderResults()}
        
        <Card style={styles.instructionsCard}>
          <Text style={[styles.instructionsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            CSV Format Instructions
          </Text>
          <Text style={[styles.instructionsText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
            The CSV file should have the following columns:
          </Text>
          <View style={styles.instructionsList}>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • created_at - The date of the sale (YYYY-MM-DD)
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • created_by - The profile ID of the user who created the sale
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • business_id - The ID of the business
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • customer_id - The ID of the customer
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • product_id - The ID of the product
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • quantity - The quantity sold
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • unit_price - The price per unit
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • original_subtotal - The original subtotal (quantity * unit_price)
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • discount_type - The type of discount (percentage or fixed)
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • discount_value - The discount value
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • item_discount_value - The item-level discount value
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • item_discount_amount - The calculated discount amount
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • delivery_cost - The delivery cost
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • subtotal - The final subtotal after discounts
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • notes - Any notes for the sale
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • payment_method - The payment method (cash, card, transfer, other)
            </Text>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => router.back()}
          style={styles.footerButton}
        />
        <Button
          title="Import Sales"
          onPress={handleImport}
          style={styles.footerButton}
          disabled={!file && !csvContent}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  uploadCard: {
    padding: 20,
    marginBottom: 16,
  },
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 14,
  },
  fileInfo: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  fileDetails: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  templateText: {
    color: '#2563eb',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  previewScroll: {
    maxHeight: 150,
  },
  previewLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
    whiteSpace: 'nowrap',
  },
  previewHeader: {
    fontWeight: 'bold',
  },
  previewMore: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  resultsContainer: {
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  resultsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  resultItem: {
    alignItems: 'center',
    flex: 1,
  },
  resultLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  errorList: {
    marginTop: 8,
  },
  errorListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorScroll: {
    maxHeight: 200,
  },
  errorItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  errorProductId: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorMessage: {
    fontSize: 12,
  },
  instructionsCard: {
    padding: 16,
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    marginBottom: 8,
  },
  instructionsList: {
    marginLeft: 8,
  },
  instructionItem: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerButton: {
    flex: 1,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  successActions: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  successButton: {
    minWidth: 120,
  },
});