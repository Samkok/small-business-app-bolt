import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ArrowLeft, Download, DollarSign, TrendingDown, TrendingUp } from 'lucide-react-native';
import { reportsService } from '@/src/services/reports';
import { importService } from '@/src/services/importService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function CashFlowScreen() {
  const [loading, setLoading] = useState(true);
  const [cashFlowData, setCashFlowData] = useState<any>(null);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { month, year } = params;
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { profile } = useAuth();

  useEffect(() => {
    console.log("Showing month and year");
    console.log(month+1);
    console.log(year);
    if (profile?.id && month !== undefined && year !== undefined) {
      
      loadCashFlowStatement();
    } else {
      setLoading(false);
    }
  }, [profile?.id, month, year]);

  const loadCashFlowStatement = async () => {
    try {
      setLoading(true);
      
      const data = await reportsService.getCashFlowStatement(
        profile!.id, 
        parseInt(month as string), 
        parseInt(year as string)
      );
      
      setCashFlowData(data);
    } catch (error) {
      console.error('Error loading cash flow statement:', error);
      Alert.alert('Error', 'Failed to load cash flow statement');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!profile?.id) {
      Alert.alert('Error', 'No business profile found');
      return;
    }

    try {
      const csvData = await importService.exportCashFlowToCsv(
        profile.id, 
        parseInt(month as string),
        parseInt(year as string)
      );
      
      if (Platform.OS === 'web') {
        // Web platform - use browser download
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cash_flow_${month}_${year}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Mobile platform - use expo-file-system and expo-sharing
        const fileUri = `${FileSystem.documentDirectory}cash_flow_${month}_${year}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: FileSystem.EncodingType.UTF8 });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Cash Flow Statement',
            UTI: 'public.comma-separated-values-text'
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
      
      Alert.alert('Success', 'Cash flow statement exported successfully');
    } catch (error) {
      console.error('Error exporting cash flow statement:', error);
      Alert.alert('Error', 'Failed to export cash flow statement');
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading cash flow statement..." />;
  }

  if (!cashFlowData) {
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
            Cash Flow Statement
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            No data available for the selected period
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }

  const monthName = new Date(parseInt(year as string), parseInt(month as string), 1)
    .toLocaleString('default', { month: 'long' });

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
          Cash Flow Statement
        </Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExport}
        >
          <Download size={20} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.periodCard}>
          <Text style={[styles.periodText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {monthName} {year}
          </Text>
        </Card>

        <Card style={styles.cashFlowCard}>
          {/* Operating Activities */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <TrendingUp size={20} color="#059669" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Operating Activities
              </Text>
            </View>
            
            <View style={styles.row}>
              <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Net Income
              </Text>
              <Text style={[styles.value, { color: cashFlowData.netIncome >= 0 ? '#059669' : '#dc2626' }]}>
                ${cashFlowData.netIncome.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.row}>
              <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Inventory Changes
              </Text>
              <Text style={[styles.value, { color: cashFlowData.inventoryChanges >= 0 ? '#059669' : '#dc2626' }]}>
                ${cashFlowData.inventoryChanges.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.row, styles.subtotalRow]}>
              <Text style={[styles.subtotalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Net Cash from Operations
              </Text>
              <Text style={[styles.subtotalValue, { color: cashFlowData.operatingCashFlow >= 0 ? '#059669' : '#dc2626' }]}>
                ${cashFlowData.operatingCashFlow.toFixed(2)}
              </Text>
            </View>
          </View>
          
          {/* Investing Activities */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <TrendingDown size={20} color="#8b5cf6" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Investing Activities
              </Text>
            </View>
            
            <View style={styles.row}>
              <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Equipment Purchases
              </Text>
              <Text style={[styles.value, { color: '#dc2626' }]}>
                ${cashFlowData.equipmentPurchases.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.row, styles.subtotalRow]}>
              <Text style={[styles.subtotalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Net Cash from Investing
              </Text>
              <Text style={[styles.subtotalValue, { color: cashFlowData.investingCashFlow >= 0 ? '#059669' : '#dc2626' }]}>
                ${cashFlowData.investingCashFlow.toFixed(2)}
              </Text>
            </View>
          </View>
          
          {/* Financing Activities */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <DollarSign size={20} color="#ea580c" />
              <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Financing Activities
              </Text>
            </View>
            
            <View style={styles.row}>
              <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Owner Contributions
              </Text>
              <Text style={[styles.value, { color: '#059669' }]}>
                ${cashFlowData.ownerContributions.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.row}>
              <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Owner Withdrawals
              </Text>
              <Text style={[styles.value, { color: '#dc2626' }]}>
                ${cashFlowData.ownerWithdrawals.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.row, styles.subtotalRow]}>
              <Text style={[styles.subtotalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Net Cash from Financing
              </Text>
              <Text style={[styles.subtotalValue, { color: cashFlowData.financingCashFlow >= 0 ? '#059669' : '#dc2626' }]}>
                ${cashFlowData.financingCashFlow.toFixed(2)}
              </Text>
            </View>
          </View>
          
          {/* Net Cash Flow */}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Net Change in Cash
            </Text>
            <Text style={[styles.totalValue, { color: cashFlowData.netCashFlow >= 0 ? '#059669' : '#dc2626' }]}>
              ${cashFlowData.netCashFlow.toFixed(2)}
            </Text>
          </View>
        </Card>
      </ScrollView>
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
  exportButton: {
    padding: 8,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  periodCard: {
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cashFlowCard: {
    padding: 16,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  subtotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtotalValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    minWidth: 120,
  },
});