import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonCard, SkeletonLoader } from '@/src/components/ui/SkeletonLoader';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, TrendingDown, ChartBar as BarChart, ChartPie as PieChart, FileText, ChevronDown, Download } from 'lucide-react-native';
import { LineChart, PieChart as PieChartKit } from 'react-native-chart-kit';
import { reportsService } from '@/src/services/reports';
import { importService } from '@/src/services/importService';
import { format, subDays, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, isSameMonth, formatISO, startOfWeek, endOfWeek, endOfDay, startOfYear, endOfYear } from 'date-fns';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import * as FileSystem from 'expo-file-system';

const screenWidth = Dimensions.get('window').width;
const EXPORT_FILE_PREFIX = 'BizManage_Report';

export default function ReportsScreen() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'cash-flow'>('overview');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [expensesData, setExpensesData] = useState<any>(null);
  const [profitData, setProfitData] = useState<any>(null);
  const [expenseCategoriesData, setExpenseCategoriesData] = useState<any>(null);
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showCustomDateRangePicker, setShowCustomDateRangePicker] = useState(false);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();

  useEffect(() => {
    if (currentBusiness?.id) {
      loadReportData();
    } else {
      setInitialLoading(false);
    }
  }, [currentBusiness?.id, dateRange, customStartDate, customEndDate]);

  const getDateRange = () => {
    const now = new Date();
    // Set end time to 23:59:59
    const endDate = endOfDay(now);
    
    let startDate: Date;
    
    switch (dateRange) {
      case 'week':
        // Start from the beginning of the current week
        startDate = startOfWeek(now, { weekStartsOn: 0 }); // 0 = Sunday
        break;
      case 'month':
        // Start from the beginning of the current month
        startDate = startOfMonth(now);
        break;
      case 'quarter':
        // Start from 3 months ago, beginning of that month
        startDate = startOfMonth(subDays(now, 90));
        break;
      case 'year':
        // Start from the beginning of the current year
        startDate = startOfYear(now);
        break;
      case 'custom':
        // Use custom date range
        startDate = customStartDate ? new Date(customStartDate) : startOfMonth(now);
        startDate.setHours(0, 0, 0, 0);
        
        // For custom range, also set the end date
        const customEnd = customEndDate ? endOfDay(new Date(customEndDate)) : endOfDay(now);
        return {
          startDate: startDate,
          endDate: customEnd
        };
      default:
        // Default to month
        startDate = startOfMonth(now);
    }
    
    // Ensure startDate is always a valid Date object
    if (!startDate || isNaN(startDate.getTime())) {
      startDate = startOfMonth(now);
    }
    
    return {
      startDate: startDate,
      endDate: endDate
    };
  };

  const getDateRangeText = () => {
    const now = new Date();
    
    switch (dateRange) {
      case 'week':
        return t('reports.thisWeek');
      case 'month':
        return t('reports.thisMonth');
      case 'quarter':
        return t('reports.last3Months');
      case 'year':
        return t('reports.thisYear');
      case 'custom':
        return `${format(customStartDate, 'MMM d, yyyy')} - ${format(customEndDate, 'MMM d, yyyy')}`;
      default:
        return t('reports.thisMonth');
    }
  };

  const handleLowStockPress = () => {
    router.push('/(app)/(tabs)/inventory/low-stock');
  };

  const loadReportData = async () => {
    if (!currentBusiness?.id) return;
    
    if (initialLoading) {
      setInitialLoading(true);
    } else {
      setChartsLoading(true);
    }
    
    try {
      const { startDate, endDate } = getDateRange();
      
      // Load revenue data
      const revenueChartData = await reportsService.getRevenueChart(currentBusiness.id, startDate, endDate);
      setRevenueData(revenueChartData);
      
      // Load expenses data
      const expensesChartData = await reportsService.getExpenseChart(currentBusiness.id, startDate, endDate);
      setExpensesData(expensesChartData);
      
      // Load profit data
      const profitChartData = await reportsService.getProfitChart(currentBusiness.id, startDate, endDate);
      setProfitData(profitChartData);
      
      // Load expense categories data
      const expenseCategoriesChartData = await reportsService.getExpensesByCategory(currentBusiness.id, startDate, endDate);
      setExpenseCategoriesData(expenseCategoriesChartData);
    } catch (error) {
      console.error('Error loading report data:', error);
      if (Platform.OS !== 'web') {
        Alert.alert('Error', 'Failed to load report data');
      }
    } finally {
      setInitialLoading(false);
      setChartsLoading(false);
    }
  };

  const handleDownloadAllReports = async () => {
    if (!currentBusiness?.id) {
      Alert.alert('Error', 'No business selected');
      return;
    }

    setChartsLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const formattedStartDate = startDate;
      const formattedEndDate = endDate;
      const dateRangeLabel = `${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`;

      const salesCsv = await importService.exportSalesToCsv(currentBusiness.id, formattedStartDate, formattedEndDate);
      const incomeCsv = await importService.exportIncomeStatementToCsv(currentBusiness.id, formattedStartDate, formattedEndDate);
      const cashFlowCsv = await importService.exportCashFlowToCsv(currentBusiness.id, startDate.getMonth(), startDate.getFullYear());
      const productsCsv = await importService.exportProductsToCsv(currentBusiness.id);

      const filesToExport = [
        { name: `${EXPORT_FILE_PREFIX}_Sales_${dateRangeLabel}.csv`, content: salesCsv },
        { name: `${EXPORT_FILE_PREFIX}_IncomeStatement_${dateRangeLabel}.csv`, content: incomeCsv },
        { name: `${EXPORT_FILE_PREFIX}_CashFlow_${format(startDate, 'yyyyMM')}.csv`, content: cashFlowCsv },
        { name: `${EXPORT_FILE_PREFIX}_Products.csv`, content: productsCsv },
      ];

      if (Platform.OS === 'web') {
        // For web, trigger individual downloads
        filesToExport.forEach(file => {
          const blob = new Blob([file.content], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
        Alert.alert('Success', 'Reports downloaded successfully. Check your downloads folder.');
      } else {
        // For mobile, share each file individually
        for (const file of filesToExport) {
          const fileUri = `${FileSystem.documentDirectory}${file.name}`;
          await FileSystem.writeAsStringAsync(fileUri, file.content, { encoding: FileSystem.EncodingType.UTF8 });
          
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'text/csv',
              dialogTitle: `Export ${file.name}`,
              UTI: 'public.comma-separated-values-text'
            });
          } else {
            Alert.alert('Error', 'Sharing is not available on this device');
            break; // Stop if sharing is not available
          }
        }
        Alert.alert('Success', 'Reports prepared for sharing.');
      }
    } catch (error) {
      console.error('Error downloading all reports:', error);
      Alert.alert('Error', 'Failed to download reports.');
    } finally {
      setChartsLoading(false);
    }
  };

  const handleViewIncomeStatement = () => {
    const { startDate, endDate } = getDateRange();
    router.push(`/reports/income-statement?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
  };

  const handleViewCashFlow = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    router.push(`/reports/cash-flow?month=${month}&year=${year}`);
  };

  // Function to process labels for charts to avoid crowding
  const getProcessedLabels = (labels: string[], maxVisibleLabels: number) => {
    if (labels.length <= maxVisibleLabels) return labels;
    
    const interval = Math.ceil(labels.length / maxVisibleLabels);
    return labels.map((label, index) => (index % interval === 0) ? label : '');
  };

  const handleDateFilterChange = (filter: 'week' | 'month' | 'quarter' | 'year' | 'custom') => {
    setDateRange(filter);
    
    if (filter === 'custom') {
      setShowCustomDateRangePicker(true);
    } else {
      setShowDateRangeModal(false);
    }
  };

  const handleDateRangeConfirm = (start: Date, end: Date) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setShowCustomDateRangePicker(false);
    setShowDateRangeModal(false);
  };

  const TabButton = ({ 
    title, 
    isActive, 
    onPress 
  }: { 
    title: string; 
    isActive: boolean; 
    onPress: () => void; 
  }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        {
          backgroundColor: isActive 
            ? '#2563eb' 
            : (isDark ? '#374151' : '#f3f4f6'),
          borderColor: isActive ? '#2563eb' : (isDark ? '#4b5563' : '#d1d5db'),
        }
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.tabButtonText,
        { color: isActive ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  // Skeleton components for charts
  const SkeletonChartCard = ({ title, icon }: { title: string, icon: React.ReactNode }) => (
    <SkeletonCard style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={styles.chartTitleContainer}>
          {icon}
          <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {title}
          </Text>
        </View>
      </View>
      
      <View style={styles.skeletonChartContainer}>
        <SkeletonLoader height={220} width={screenWidth - 64} borderRadius={16} />
      </View>
    </SkeletonCard>
  );

  const SkeletonPieChartCard = () => (
    <SkeletonCard style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={styles.chartTitleContainer}>
          <PieChart size={20} color="#8b5cf6" />
          <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Expense Categories
          </Text>
        </View>
      </View>
      
      <View style={styles.skeletonChartContainer}>
        <SkeletonLoader height={220} width={screenWidth - 64} borderRadius={16} />
      </View>
    </SkeletonCard>
  );

  const SkeletonStatementsCard = () => (
    <SkeletonCard style={styles.statementsCard}>
      <SkeletonLoader height={16} width="60%" style={{ marginBottom: 16 }} />
      
      <SkeletonLoader height={56} width="100%" borderRadius={8} style={{ marginBottom: 12 }} />
      <SkeletonLoader height={56} width="100%" borderRadius={8} />
    </SkeletonCard>
  );

  const SkeletonIncomeSummaryCard = () => (
    <SkeletonCard style={styles.incomeCard}>
      <SkeletonLoader height={16} width="60%" style={{ marginBottom: 16 }} />
      
      <View style={{ marginBottom: 16 }}>
        {[1, 2, 3, 4, 5].map(index => (
          <View key={index} style={styles.incomeRow}>
            <SkeletonLoader height={14} width="40%" />
            <SkeletonLoader height={14} width="20%" />
          </View>
        ))}
      </View>
      
      <SkeletonLoader height={40} width="100%" borderRadius={8} />
    </SkeletonCard>
  );

  const SkeletonCashFlowMonths = () => (
    <View style={styles.tabContent}>
      <SkeletonLoader height={18} width="60%" style={{ marginBottom: 8 }} />
      <SkeletonLoader height={14} width="80%" style={{ marginBottom: 16 }} />
      
      {[1, 2, 3, 4, 5, 6].map(index => (
        <SkeletonLoader 
          key={index}
          height={56} 
          width="100%" 
          borderRadius={8} 
          style={{ marginBottom: 12 }}
        />
      ))}
    </View>
  );

  const renderOverviewTab = () => {
    if (chartsLoading) {
      return (
        <View style={styles.tabContent}>
          <SkeletonChartCard 
            title="Revenue" 
            icon={<TrendingUp size={20} color="#059669" />} 
          />
          <SkeletonChartCard 
            title="Expenses" 
            icon={<TrendingDown size={20} color="#dc2626" />} 
          />
          <SkeletonChartCard 
            title="Net Profit" 
            icon={<DollarSign size={20} color="#059669" />} 
          />
          <SkeletonPieChartCard />
          <SkeletonStatementsCard />
        </View>
      );
    }

    if (!revenueData || !expensesData || !profitData || !expenseCategoriesData) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={[styles.noDataText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            No data available for the selected period
          </Text>
        </View>
      );
    }

    // Process labels to avoid crowding
    const processedRevenueLabels = getProcessedLabels(revenueData.map((item: any) => item.label), 7);
    const processedExpensesLabels = getProcessedLabels(expensesData.map((item: any) => item.label), 7);
    const processedProfitLabels = getProcessedLabels(profitData.map((item: any) => item.label), 7);

    // Prepare data for revenue chart
    const revenueChartData = {
      labels: processedRevenueLabels,
      datasets: [
        {
          data: revenueData.map((item: any) => parseFloat(item.revenue)),
          color: () => '#059669',
          strokeWidth: 2
        }
      ]
    };

    // Prepare data for expenses chart
    const expensesChartData = {
      labels: processedExpensesLabels,
      datasets: [
        {
          data: expensesData.map((item: any) => item.amount),
          color: () => '#dc2626',
          strokeWidth: 2
        }
      ]
    };

    // Prepare data for profit chart
    const profitChartData = {
      labels: processedProfitLabels,
      datasets: [
        {
          data: profitData.map((item: any) => item.netProfit),
          color: (opacity = 1) => profitData.some((item: any) => item.netProfit < 0) ? '#dc2626' : '#059669',
          strokeWidth: 2
        }
      ]
    };

    // Prepare data for expense categories pie chart
    const expenseCategoriesPieData = expenseCategoriesData.slice(0, 5).map((item: any, index: number) => {
      const colors = ['#2563eb', '#059669', '#dc2626', '#8b5cf6', '#ea580c'];
      return {
        name: item.category,
        amount: parseFloat(item.amount.toFixed(2)),
        color: colors[index % colors.length],
        legendFontColor: isDark ? '#d1d5db' : '#6b7280',
        legendFontSize: 12
      };
    });

    return (
      <View style={styles.tabContent}>
        {/* Revenue Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleContainer}>
              <TrendingUp size={20} color="#059669" />
              <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Revenue
              </Text>
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            <LineChart
              data={revenueChartData}
              width={screenWidth - 64}
              height={220}
              chartConfig={{
                backgroundColor: isDark ? '#374151' : '#ffffff',
                backgroundGradientFrom: isDark ? '#374151' : '#ffffff',
                backgroundGradientTo: isDark ? '#374151' : '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => isDark ? `rgba(209, 213, 219, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
                labelColor: (opacity = 1) => isDark ? `rgba(249, 250, 251, ${opacity})` : `rgba(17, 24, 39, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: "0",
                  stroke: "#059669"
                }
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
            />
          </View>
        </Card>

        {/* Expenses Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleContainer}>
              <TrendingDown size={20} color="#dc2626" />
              <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Expenses
              </Text>
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            <LineChart
              data={expensesChartData}
              width={screenWidth - 64}
              height={220}
              chartConfig={{
                backgroundColor: isDark ? '#374151' : '#ffffff',
                backgroundGradientFrom: isDark ? '#374151' : '#ffffff',
                backgroundGradientTo: isDark ? '#374151' : '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => isDark ? `rgba(209, 213, 219, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
                labelColor: (opacity = 1) => isDark ? `rgba(249, 250, 251, ${opacity})` : `rgba(17, 24, 39, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: "0",
                  stroke: "#dc2626"
                }
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
            />
          </View>
        </Card>

        {/* Profit Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleContainer}>
              <DollarSign size={20} color={profitData.some((item: any) => item.netProfit < 0) ? '#dc2626' : '#059669'} />
              <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Net Profit
              </Text>
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            <LineChart
              data={profitChartData}
              width={screenWidth - 64}
              height={220}
              chartConfig={{
                backgroundColor: isDark ? '#374151' : '#ffffff',
                backgroundGradientFrom: isDark ? '#374151' : '#ffffff',
                backgroundGradientTo: isDark ? '#374151' : '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => isDark ? `rgba(209, 213, 219, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
                labelColor: (opacity = 1) => isDark ? `rgba(249, 250, 251, ${opacity})` : `rgba(17, 24, 39, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: "0",
                  stroke: profitData.some((item: any) => item.netProfit < 0) ? "#dc2626" : "#059669"
                }
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
            />
          </View>
        </Card>

        {/* Expense Categories Pie Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleContainer}>
              <PieChart size={20} color="#8b5cf6" />
              <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Expense Categories
              </Text>
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            {expenseCategoriesData.length > 0 ? (
              <PieChartKit
                data={expenseCategoriesPieData}
                width={screenWidth - 64}
                height={220}
                chartConfig={{
                  backgroundColor: isDark ? '#374151' : '#ffffff',
                  backgroundGradientFrom: isDark ? '#374151' : '#ffffff',
                  backgroundGradientTo: isDark ? '#374151' : '#ffffff',
                  color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                }}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={[styles.noDataText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  No expense data available
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Financial Statements */}
        <Card style={styles.statementsCard}>
          <Text style={[styles.statementsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Financial Statements
          </Text>
          
          <TouchableOpacity
            style={[styles.statementButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
            onPress={handleViewIncomeStatement}
          >
            <FileText size={20} color="#2563eb" />
            <Text style={[styles.statementButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Income Statement
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.statementButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
            onPress={handleViewCashFlow}
          >
            <FileText size={20} color="#059669" />
            <Text style={[styles.statementButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Cash Flow Statement
            </Text>
          </TouchableOpacity>
        </Card>
      </View>
    );
  };

  const renderIncomeTab = () => {
    if (chartsLoading) {
      return (
        <View style={styles.tabContent}>
          <SkeletonIncomeSummaryCard />
          <SkeletonChartCard 
            title="Net Profit Trend" 
            icon={<DollarSign size={20} color="#059669" />} 
          />
          <SkeletonChartCard 
            title="Revenue vs Expenses" 
            icon={<BarChart size={20} color="#2563eb" />} 
          />
        </View>
      );
    }

    if (!profitData) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={[styles.noDataText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            No data available for the selected period
          </Text>
        </View>
      );
    }

    // Process labels to avoid crowding
    const processedProfitLabels = getProcessedLabels(profitData.map((item: any) => item.label), 7);

    // Calculate totals
    const totalRevenue = profitData.reduce((sum: number, item: any) => sum + parseFloat(item.revenue), 0);
    const totalCOGS = profitData.reduce((sum: number, item: any) => sum + item.cogs, 0);
    const totalExpenses = profitData.reduce((sum: number, item: any) => sum + item.expenses, 0);
    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalExpenses;

    return (
      <View style={styles.tabContent}>
        <Card style={styles.incomeCard}>
          <Text style={[styles.incomeTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Income Summary
          </Text>
          
          <View style={styles.incomeSummary}>
            <View style={styles.incomeRow}>
              <Text style={[styles.incomeLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total Revenue
              </Text>
              <Text style={[styles.incomeValue, { color: '#059669' }]}>
                ${totalRevenue.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.incomeRow}>
              <Text style={[styles.incomeLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Cost of Goods Sold
              </Text>
              <Text style={[styles.incomeValue, { color: '#dc2626' }]}>
                ${totalCOGS.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.incomeRow, styles.subtotalRow]}>
              <Text style={[styles.subtotalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Gross Profit
              </Text>
              <Text style={[styles.subtotalValue, { color: grossProfit >= 0 ? '#059669' : '#dc2626' }]}>
                ${grossProfit.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.incomeRow}>
              <Text style={[styles.incomeLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Operating Expenses
              </Text>
              <Text style={[styles.incomeValue, { color: '#dc2626' }]}>
                ${totalExpenses.toFixed(2)}
              </Text>
            </View>
            
            <View style={[styles.incomeRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Net Profit
              </Text>
              <Text style={[styles.totalValue, { color: netProfit >= 0 ? '#059669' : '#dc2626' }]}>
                ${netProfit.toFixed(2)}
              </Text>
            </View>
          </View>
          
          <Button
            title="View Full Statement"
            onPress={handleViewIncomeStatement}
            style={styles.viewStatementButton}
          />
        </Card>

        {/* Profit Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleContainer}>
              <DollarSign size={20} color={netProfit >= 0 ? '#059669' : '#dc2626'} />
              <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Net Profit Trend
              </Text>
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: processedProfitLabels,
                datasets: [
                  {
                    data: profitData.map((item: any) => item.netProfit),
                    color: () => netProfit >= 0 ? '#059669' : '#dc2626',
                    strokeWidth: 2
                  }
                ]
              }}
              width={screenWidth - 64}
              height={220}
              chartConfig={{
                backgroundColor: isDark ? '#374151' : '#ffffff',
                backgroundGradientFrom: isDark ? '#374151' : '#ffffff',
                backgroundGradientTo: isDark ? '#374151' : '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => isDark ? `rgba(209, 213, 219, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
                labelColor: (opacity = 1) => isDark ? `rgba(249, 250, 251, ${opacity})` : `rgba(17, 24, 39, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: "0",
                  stroke: netProfit >= 0 ? "#059669" : "#dc2626"
                }
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
            />
          </View>
        </Card>

        {/* Revenue vs Expenses Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleContainer}>
              <BarChart size={20} color="#2563eb" />
              <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Revenue vs Expenses
              </Text>
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: processedProfitLabels,
                datasets: [
                  {
                    data: profitData.map((item: any) => item.revenue),
                    color: () => '#059669',
                    strokeWidth: 2
                  },
                  {
                    data: profitData.map((item: any) => item.expenses),
                    color: () => '#dc2626',
                    strokeWidth: 2
                  }
                ],
                legend: ['Revenue', 'Expenses']
              }}
              width={screenWidth - 64}
              height={220}
              chartConfig={{
                backgroundColor: isDark ? '#374151' : '#ffffff',
                backgroundGradientFrom: isDark ? '#374151' : '#ffffff',
                backgroundGradientTo: isDark ? '#374151' : '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => isDark ? `rgba(209, 213, 219, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
                labelColor: (opacity = 1) => isDark ? `rgba(249, 250, 251, ${opacity})` : `rgba(17, 24, 39, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: "0"
                }
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
            />
          </View>
        </Card>
      </View>
    );
  };

  const renderCashFlowTab = () => {
    if (chartsLoading) {
      return <SkeletonCashFlowMonths />;
    }
    
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get previous months
    const months = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(currentYear, currentMonth-i, 1);
      months.push({
        month: date.getMonth(),
        year: date.getFullYear(),
        label: format(date, 'MMMM yyyy')
      });
    }

    return (
      <View style={styles.tabContent}>
        <Text style={[styles.cashFlowTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Cash Flow Statements
        </Text>
        
        <Text style={[styles.cashFlowSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Select a month to view the cash flow statement
        </Text>
        
        {months.map((monthData, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.monthButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
            onPress={() => router.push(`/reports/cash-flow?month=${monthData.month}&year=${monthData.year}`)}
          >
            <Calendar size={20} color="#2563eb" />
            <Text style={[styles.monthButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {monthData.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (initialLoading) {
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
            Reports
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* Skeleton Tabs */}
        <View style={styles.tabs}>
          {['Overview', 'Income', 'Cash Flow'].map((tab, index) => (
            <SkeletonLoader 
              key={index}
              height={44} 
              width={`${100/3}%`} 
              borderRadius={8} 
              style={{ marginHorizontal: 4 }}
            />
          ))}
        </View>

        {/* Skeleton Date Range */}
        <View style={styles.dateRangeContainer}>
          <SkeletonLoader 
            height={44} 
            width="100%" 
            borderRadius={8}
          />
        </View>

        {/* Skeleton Charts */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <SkeletonChartCard 
            title="Revenue" 
            icon={<TrendingUp size={20} color="#059669" />} 
          />
          <SkeletonChartCard 
            title="Expenses" 
            icon={<TrendingDown size={20} color="#dc2626" />} 
          />
          <SkeletonChartCard 
            title="Net Profit" 
            icon={<DollarSign size={20} color="#059669" />} 
          />
          <SkeletonPieChartCard />
          <SkeletonStatementsCard />
        </ScrollView>
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
          Reports
        </Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleDownloadAllReports}
        >
          <Download size={20} color={isDark ? '#f9fafb' : '#111827'} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton
          title="Overview"
          isActive={activeTab === 'overview'}
          onPress={() => setActiveTab('overview')}
        />
        <TabButton
          title="Income"
          isActive={activeTab === 'income'}
          onPress={() => setActiveTab('income')}
        />
        <TabButton
          title="Cash Flow"
          isActive={activeTab === 'cash-flow'}
          onPress={() => setActiveTab('cash-flow')}
        />
      </View>

      {/* Date Range Dropdown (only for Overview and Income tabs) */}
      {activeTab !== 'cash-flow' && (
        <View style={styles.dateRangeContainer}>
          <TouchableOpacity 
            style={[styles.dateRangeDropdown, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
            onPress={() => setShowDateRangeModal(true)}
          >
            <Calendar size={18} color="#059669" />
            <Text style={[styles.dateRangeText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {getDateRangeText()}
            </Text>
            <ChevronDown size={18} color="#059669" />
          </TouchableOpacity>
        </View>
      )}

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'income' && renderIncomeTab()}
        {activeTab === 'cash-flow' && renderCashFlowTab()}
      </ScrollView>

      {/* Date Range Modal */}
      <Modal
        visible={showDateRangeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDateRangeModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateRangeModal(false)}
        >
          <View 
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#374151' : '#ffffff' }
            ]}
          >
            <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('reports.selectDateRange')}
            </Text>
            
            <TouchableOpacity
              style={[
                styles.modalOption,
                dateRange === 'week' && { backgroundColor: '#059669' }
              ]}
              onPress={() => handleDateFilterChange('week')}
            >
              <Text style={[
                styles.modalOptionText,
                { color: dateRange === 'week' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }
              ]}>
                {t('reports.thisWeek')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalOption,
                dateRange === 'month' && { backgroundColor: '#059669' }
              ]}
              onPress={() => handleDateFilterChange('month')}
            >
              <Text style={[
                styles.modalOptionText,
                { color: dateRange === 'month' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }
              ]}>
                {t('reports.thisMonth')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalOption,
                dateRange === 'quarter' && { backgroundColor: '#059669' }
              ]}
              onPress={() => handleDateFilterChange('quarter')}
            >
              <Text style={[
                styles.modalOptionText,
                { color: dateRange === 'quarter' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }
              ]}>
                {t('reports.last3Months')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalOption,
                dateRange === 'year' && { backgroundColor: '#059669' }
              ]}
              onPress={() => handleDateFilterChange('year')}
            >
              <Text style={[
                styles.modalOptionText,
                { color: dateRange === 'year' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }
              ]}>
                {t('reports.thisYear')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modalOption,
                dateRange === 'custom' && { backgroundColor: '#059669' }
              ]}
              onPress={() => handleDateFilterChange('custom')}
            >
              <Text style={[
                styles.modalOptionText,
                { color: dateRange === 'custom' ? '#ffffff' : (isDark ? '#f9fafb' : '#111827') }
              ]}>
                {t('reports.customRange')}
              </Text>
            </TouchableOpacity>
            
            <Button
              title={t('common.cancel')}
              variant="outline"
              onPress={() => setShowDateRangeModal(false)}
              style={styles.modalCancelButton}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Date Range Picker Modal */}
      <Modal
        visible={showCustomDateRangePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCustomDateRangePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCustomDateRangePicker(false)}
        >
          <Card 
            style={styles.modalContent}
          >
            <Text style={[styles.modalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('reports.customRange')}
            </Text>
            
            {showCustomDateRangePicker && <DateRangePicker
              startDate={customStartDate}
              endDate={customEndDate}
              onConfirm={handleDateRangeConfirm}
              onCancel={() => setShowCustomDateRangePicker(false)}
            />}
          </Card>
        </TouchableOpacity>
      </Modal>
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
  exportButton: {
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateRangeContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateRangeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalCancelButton: {
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabContent: {
    paddingBottom: 20,
  },
  loadingChartsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingChartsText: {
    fontSize: 16,
    marginTop: 12,
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 16,
    textAlign: 'center',
  },
  skeletonChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 220,
  },
  chartCard: {
    padding: 16,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  chartContainer: {
    alignItems: 'center',
  },
  statementsCard: {
    padding: 16,
    marginBottom: 20,
  },
  statementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  statementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  statementButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  incomeCard: {
    padding: 16,
    marginBottom: 16,
  },
  incomeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  incomeSummary: {
    marginBottom: 16,
  },
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  incomeLabel: {
    fontSize: 14,
  },
  incomeValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  subtotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginBottom: 16,
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
  viewStatementButton: {
    marginTop: 8,
  },
  cashFlowTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cashFlowSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  monthButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  // Keep this for backward compatibility but it's not used anymore
  dateRangeSelector: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateRangeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  dateRangeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});