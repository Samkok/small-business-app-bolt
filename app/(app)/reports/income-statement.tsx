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
import { SkeletonLoader, SkeletonCard } from '@/src/components/ui/SkeletonLoader';
import { ArrowLeft, Download, DollarSign, TrendingDown, TrendingUp } from 'lucide-react-native';
import { supabase } from '@/src/config/supabase';
import { salesService } from '@/src/services/sales';
import { expenseService } from '@/src/services/expenses';
import { exportService } from '@/src/services/exportService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function IncomeStatementScreen() {
  const [loading, setLoading] = useState(true);
  const [incomeData, setIncomeData] = useState<any>(null);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { startDate, endDate } = params;
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();

  useEffect(() => {
    if (currentBusiness?.id && startDate && endDate) {
      loadIncomeStatement();
    } else {
      setLoading(false);
    }
  }, [currentBusiness?.id, startDate, endDate]);

  const loadIncomeStatement = async () => {
    try {
      setLoading(true);
      
      // Get sales data with COGS
      const salesData = await salesService.getSalesWithCOGS(
        currentBusiness!.id, 
        startDate as string, 
        endDate as string
      );
      
      // Get sales data that matches dashboard calculation (including partially returned)
      const { data: revenueData, error: revenueError } = await supabase
        .from('sales')
        .select(`
          total_amount,
          sale_actions!left(amount, action_type)
        `)
        .eq('business_id', currentBusiness!.id)
        .in('status', ['completed', 'partially_returned'])
        .gte('sale_date', startDate as string)
        .lte('sale_date', endDate as string);

      if (revenueError) throw revenueError;

      // Calculate total revenue (subtracting returned amounts) to match dashboard
      const totalRevenue = revenueData?.reduce((sum, sale) => {
        const returnedAmount = sale.sale_actions
          ?.filter(action => action.action_type === 'return')
          ?.reduce((sum, action) => sum + (action.amount || 0), 0) || 0;
        return sum + (sale.total_amount - returnedAmount);
      }, 0) || 0;

      // Calculate totals
      const totalCOGS = salesData.reduce((sum, sale) => sum + sale.cogs, 0);
      const grossProfit = totalRevenue - totalCOGS;
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      
      // Get expense data grouped by category
      const expenseCategories = await expenseService.getExpensesByCategory(
        currentBusiness!.id,
        startDate as string,
        endDate as string
      );
      
      // Fix: Use 'amount' property instead of 'total'
      const totalExpenses = expenseCategories.reduce((sum, category) => sum + parseFloat(category.total), 0);
      const netIncome = grossProfit - totalExpenses;
      const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
      
      setIncomeData({
        period: {
          start: new Date(startDate as string).toLocaleDateString(),
          end: new Date(endDate as string).toLocaleDateString()
        },
        revenue: {
          total: totalRevenue
        },
        cogs: {
          total: totalCOGS
        },
        grossProfit,
        grossMargin,
        expenses: {
          categories: expenseCategories,
          total: totalExpenses
        },
        netIncome,
        netMargin
      });
      
    } catch (error) {
      console.error('Error loading income statement:', error);
      Alert.alert('Error', 'Failed to load income statement');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!currentBusiness?.id) {
      Alert.alert('Error', 'No business currentBusiness found');
      return;
    }

    try {
      const csvData = await exportService.exportIncomeStatementToCsv(
        currentBusiness.id, 
        startDate as string, 
        endDate as string
      );
      
      if (Platform.OS === 'web') {
        // Web platform - use browser download
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `income_statement_${startDate}_to_${endDate}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Mobile platform - use expo-file-system and expo-sharing
        const fileUri = `${FileSystem.documentDirectory}income_statement_${startDate}_to_${endDate}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: FileSystem.EncodingType.UTF8 });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Income Statement',
            UTI: 'public.comma-separated-values-text'
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
      
      Alert.alert('Success', 'Income statement exported successfully');
    } catch (error) {
      console.error('Error exporting income statement:', error);
      Alert.alert('Error', 'Failed to export income statement');
    }
  };

  const renderSkeleton = () => (
    <View style={styles.content}>
      <SkeletonCard style={styles.periodCard}>
        <SkeletonLoader height={16} width="60%" />
      </SkeletonCard>

      {/* Revenue Section */}
      <SkeletonCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <TrendingUp size={20} color="#059669" />
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Revenue
          </Text>
        </View>
        
        <View style={[styles.row, styles.totalRow]}>
          <SkeletonLoader height={16} width="40%" />
          <SkeletonLoader height={18} width="30%" />
        </View>
      </SkeletonCard>

      {/* COGS Section */}
      <SkeletonCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <TrendingDown size={20} color="#dc2626" />
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Cost of Goods Sold
          </Text>
        </View>
        
        <View style={[styles.row, styles.totalRow]}>
          <SkeletonLoader height={16} width="40%" />
          <SkeletonLoader height={18} width="30%" />
        </View>
      </SkeletonCard>

      {/* Gross Profit Section */}
      <SkeletonCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <DollarSign size={20} color="#2563eb" />
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Gross Profit
          </Text>
        </View>
        
        <View style={styles.row}>
          <SkeletonLoader height={14} width="40%" />
          <SkeletonLoader height={14} width="30%" />
        </View>
        
        <View style={styles.row}>
          <SkeletonLoader height={14} width="40%" />
          <SkeletonLoader height={14} width="30%" />
        </View>
      </SkeletonCard>

      {/* Expenses Section */}
      <SkeletonCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <TrendingDown size={20} color="#ea580c" />
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Operating Expenses
          </Text>
        </View>
        
        {[1, 2, 3].map(index => (
          <View key={index} style={styles.row}>
            <SkeletonLoader height={14} width="40%" />
            <SkeletonLoader height={14} width="30%" />
          </View>
        ))}
        
        <View style={[styles.row, styles.totalRow]}>
          <SkeletonLoader height={16} width="40%" />
          <SkeletonLoader height={18} width="30%" />
        </View>
      </SkeletonCard>

      {/* Net Income Section */}
      <SkeletonCard style={styles.section}>
        <View style={styles.sectionHeader}>
          <DollarSign size={20} color="#059669" />
          <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Net Income
          </Text>
        </View>
        
        <View style={styles.row}>
          <SkeletonLoader height={14} width="40%" />
          <SkeletonLoader height={14} width="30%" />
        </View>
        
        <View style={styles.row}>
          <SkeletonLoader height={14} width="40%" />
          <SkeletonLoader height={14} width="30%" />
        </View>
      </SkeletonCard>
    </View>
  );

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
            Income Statement
          </Text>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
          >
            <Download size={20} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderSkeleton()}
        </ScrollView>
      </View>
    );
  }

  if (!incomeData) {
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
            Income Statement
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
          Income Statement
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
            Period: {incomeData.period.start} - {incomeData.period.end}
          </Text>
        </Card>

        {/* Revenue Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={20} color="#059669" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Revenue
            </Text>
          </View>
          
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Total Revenue
            </Text>
            <Text style={[styles.totalValue, { color: '#059669' }]}>
              ${incomeData.revenue.total.toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* COGS Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingDown size={20} color="#dc2626" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Cost of Goods Sold
            </Text>
          </View>
          
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Total COGS
            </Text>
            <Text style={[styles.totalValue, { color: '#dc2626' }]}>
              ${incomeData.cogs.total.toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Gross Profit Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <DollarSign size={20} color="#2563eb" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Gross Profit
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Gross Profit
            </Text>
            <Text style={[styles.value, { color: incomeData.grossProfit >= 0 ? '#059669' : '#dc2626' }]}>
              ${incomeData.grossProfit.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Gross Margin
            </Text>
            <Text style={[styles.value, { color: incomeData.grossMargin >= 0 ? '#059669' : '#dc2626' }]}>
              {incomeData.grossMargin.toFixed(2)}%
            </Text>
          </View>
        </Card>

        {/* Expenses Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingDown size={20} color="#ea580c" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Operating Expenses
            </Text>
          </View>
          
          {incomeData.expenses.categories.map((category: any, index: number) => (
            <View key={index} style={styles.row}>
              <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                {category.category}
              </Text>
              <Text style={[styles.value, { color: '#dc2626' }]}>
                ${Number(category.total || 0).toFixed(2)}
              </Text>
            </View>
          ))}
          
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Total Expenses
            </Text>
            <Text style={[styles.totalValue, { color: '#dc2626' }]}>
              ${incomeData.expenses.total.toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Net Income Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <DollarSign size={20} color={incomeData.netIncome >= 0 ? "#059669" : "#dc2626"} />
            <Text style={[styles.sectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Net Income
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Net Income
            </Text>
            <Text style={[styles.value, { color: incomeData.netIncome >= 0 ? '#059669' : '#dc2626' }]}>
              ${incomeData.netIncome.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.row}>
            <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Net Margin
            </Text>
            <Text style={[styles.value, { color: incomeData.netMargin >= 0 ? '#059669' : '#dc2626' }]}>
              {incomeData.netMargin.toFixed(2)}%
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
  section: {
    padding: 16,
    marginBottom: 16,
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
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
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