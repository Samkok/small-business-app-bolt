import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { X, Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { processBulkInventoryImportFromFile } from '@/src/utils/bulkImportProcessor';
import { processBulkInventoryImport } from '@/src/utils/bulkImportProcessor';

interface ImportCSVModalProps {
  onClose: () => void;
  onComplete: () => void;
}

export default function ImportCSVModal({ onClose, onComplete }: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      let result;
      
      if (file) {
        result = await processBulkInventoryImportFromFile(file, profile.id);
      } else if (csvContent) {
        result = await processBulkInventoryImport(csvContent, profile.id);
      } else {
        throw new Error('No file or content to import');
      }
      
      setImportResult(result);
      
      if (result.failureCount === 0) {
        Alert.alert('Success', `Successfully imported ${result.successCount} records`);
      } else {
        Alert.alert(
          'Import Completed with Errors',
          `Successfully imported ${result.successCount} records, but ${result.failureCount} records failed`
        );
      }
      
      // Only call onComplete if at least some records were successful
      if (result.successCount > 0) {
        onComplete();
      }
    } catch (error) {
      console.error('Error importing data:', error);
      Alert.alert('Error', 'Failed to import data');
    } finally {
      setLoading(false);
    }
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
              {importResult.totalRecords}
            </Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={[styles.resultLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Successful:
            </Text>
            <Text style={[styles.resultValue, { color: '#059669' }]}>
              {importResult.successCount}
            </Text>
          </View>
          
          <View style={styles.resultItem}>
            <Text style={[styles.resultLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Failed:
            </Text>
            <Text style={[styles.resultValue, { color: '#dc2626' }]}>
              {importResult.failureCount}
            </Text>
          </View>
        </View>
        
        {importResult.failureCount > 0 && (
          <View style={styles.errorList}>
            <Text style={[styles.errorListTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Failed Records:
            </Text>
            
            <ScrollView style={styles.errorScroll}>
              {importResult.results
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
                      <AlertTriangle size={16} color="#dc2626" />
                      <Text style={[styles.errorProductId, { color: isDark ? '#f9fafb' : '#111827' }]}>
                        Product ID: {result.productId}
                      </Text>
                    </View>
                    <Text style={[styles.errorMessage, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {result.message}
                    </Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Import Inventory from CSV
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={24} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
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
                The file should contain inventory import data
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
                  <X size={16} color="#dc2626" />
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
              • product_id - The ID of the product to import
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • quantity - The quantity to import
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • cost_type, amount, calculation_type - For each additional cost
            </Text>
            <Text style={[styles.instructionItem, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              • base_unit_cost - The base cost per unit
            </Text>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={onClose}
          style={styles.footerButton}
          disabled={loading}
        />
        <Button
          title={loading ? 'Importing...' : 'Import Data'}
          onPress={handleImport}
          loading={loading}
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 8,
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
    marginLeft: 8,
  },
  errorMessage: {
    fontSize: 12,
    marginLeft: 24,
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
});