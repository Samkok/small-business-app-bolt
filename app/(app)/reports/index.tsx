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
import { useCurrencyContext } from '@/src/context/CurrencyContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonCard, SkeletonLoader } from '@/src/components/ui/SkeletonLoader';
import { CurrencyDropdown } from '@/src/components/ui/CurrencyDropdown';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, TrendingDown, ChartBar as BarChart, ChartPie as PieChart, FileText, ChevronDown, Download, Package, Percent } from 'lucide-react-native';
import { LineChart, PieChart as PieChartKit, BarChart as BarChartKit } from 'react-native-chart-kit';
import { reportsService } from '@/src/services/reports';
import { exportService } from '@/src/services/exportService';
import { format, subDays, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, isSameMonth, formatISO, startOfWeek, endOfWeek, endOfDay, startOfYear, endOfYear } from 'date-fns';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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
  // First month with any sale or expense; the cash flow list runs from there to today.
  const [activityStart, setActivityStart] = useState<Date | null>(null);
  const [inventorySpendData, setInventorySpendData] = useState<any>(null);
  const [feesData, setFeesData] = useState<any>(null);
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showCustomDateRangePicker, setShowCustomDateRangePicker] = useState(false);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { currentBusiness } = useAuth();
  const { formatPrice, currencies, defaultCurrency } = useCurrencyContext();
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null);
  // Every figure on this screen is in one currency: the one picked here, else the business default.
  const activeCurrencyId = selectedCurrencyId || defaultCurrency?.id || undefined;
  const fmt = (amount: number) => formatPrice(amount, activeCurrencyId);
  const currencyParam = activeCurrencyId ? `&currencyId=${activeCurrencyId}` : '';

  useEffect(() => {
    if (currentBusiness?.id) {
      loadReportData();
    } else {
      setInitialLoading(false);
    }
  }, [currentBusiness?.id, dateRange, customStartDate, customEndDate, activeCurrencyId]);

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
        // Ensure customStartDate is a valid Date object, otherwise default
        const customStart = (customStartDate instanceof Date && !isNaN(customStartDate.getTime())) ? customStartDate : startOfMonth(now);
        customStart.setHours(0, 0, 0, 0); // Set to beginning of day
        
        // Ensure customEndDate is a valid Date object, otherwise default
        const customEnd = (customEndDate instanceof Date && !isNaN(customEndDate.getTime())) ? customEndDate : endOfDay(now);
        return {
          startDate: customStart,
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

      reportsService.getActivityStart(currentBusiness.id).then(setActivityStart).catch(() => setActivityStart(null));
      
      // Load revenue data
      const revenueChartData = await reportsService.getRevenueChart(currentBusiness.id, startDate, endDate, activeCurrencyId);
      setRevenueData(revenueChartData);
      
      // Load expenses data
      const expensesChartData = await reportsService.getExpenseChart(currentBusiness.id, startDate, endDate, activeCurrencyId);
      setExpensesData(expensesChartData);
      
      // Load profit data
      const profitChartData = await reportsService.getProfitChart(currentBusiness.id, startDate, endDate, activeCurrencyId);
      setProfitData(profitChartData);
      
      // Load expense categories data
      const expenseCategoriesChartData = await reportsService.getExpensesByCategory(currentBusiness.id, startDate, endDate, activeCurrencyId);
      setExpenseCategoriesData(expenseCategoriesChartData);

      // Load inventory spend (what was paid for stock in the period)
      const inventorySpend = await reportsService.getInventorySpend(currentBusiness.id, startDate, endDate, activeCurrencyId);
      setInventorySpendData(inventorySpend);

      // Courier fees absorbed and discounts given (not recorded as expenses anywhere else)
      const fees = await reportsService.getFeesAndDiscounts(currentBusiness.id, startDate, endDate, activeCurrencyId);
      setFeesData(fees);
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
      const startDateIso = startDate.toISOString();
      const endDateIso = endDate.toISOString();
      const dateRangeLabel = `${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`;

      const salesCsv = await exportService.exportSalesToCsv(currentBusiness.id, startDateIso, endDateIso);
      const incomeCsv = await exportService.exportIncomeStatementToCsv(currentBusiness.id, startDateIso, endDateIso, activeCurrencyId);
      const cashFlowCsv = await exportService.exportCashFlowToCsv(currentBusiness.id, startDate.getMonth(), startDate.getFullYear(), activeCurrencyId);
      const productsCsv = await exportService.exportProductsToCsv(currentBusiness.id);
      const inventorySpendCsv = await exportService.exportInventorySpendToCsv(currentBusiness.id, startDateIso, endDateIso, activeCurrencyId);
      const feesCsv = await exportService.exportFeesAndDiscountsToCsv(currentBusiness.id, startDateIso, endDateIso, activeCurrencyId);

      const filesToExport = [
        { name: `${EXPORT_FILE_PREFIX}_Sales_${dateRangeLabel}.csv`, content: salesCsv },
        { name: `${EXPORT_FILE_PREFIX}_IncomeStatement_${dateRangeLabel}.csv`, content: incomeCsv },
        { name: `${EXPORT_FILE_PREFIX}_CashFlow_${format(startDate, 'yyyyMM')}.csv`, content: cashFlowCsv },
        { name: `${EXPORT_FILE_PREFIX}_Products.csv`, content: productsCsv },
        { name: `${EXPORT_FILE_PREFIX}_InventorySpend_${dateRangeLabel}.csv`, content: inventorySpendCsv },
        { name: `${EXPORT_FILE_PREFIX}_FeesAndDiscounts_${dateRangeLabel}.csv`, content: feesCsv },
      ];

      const sectionSeparator = '\n\n\n';
      const combinedContent = filesToExport
        .map(file => {
          const sectionTitle = file.name.replace('.csv', '').replace(/_/g, ' ');
          return `"### ${sectionTitle} ###"\n\n${file.content}`;
        })
        .join(sectionSeparator);

      const combinedFileName = `${EXPORT_FILE_PREFIX}_All_${dateRangeLabel}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([combinedContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = combinedFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'All reports downloaded. Check your downloads folder.');
      } else {
        const fileUri = `${FileSystem.documentDirectory}${combinedFileName}`;
        await FileSystem.writeAsStringAsync(fileUri, combinedContent, { encoding: FileSystem.EncodingType?.UTF8 || 'utf8' });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export All Reports',
            UTI: 'public.comma-separated-values-text'
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
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
    router.push(`/reports/income-statement?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${currencyParam}`);
  };

  const handleViewFeesAndDiscounts = () => {
    const { startDate, endDate } = getDateRange();
    router.push(`/reports/fees-discounts?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}${currencyParam}`);
  };

  const handleViewCashFlow = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    router.push(`/reports/cash-flow?month=${month}&year=${year}${currencyParam}`);
  };

  // Function to process labels for charts to avoid crowding
  const getProcessedLabels = (labels: string[], maxVisibleLabels: number) => {
    if (labels.length <= maxVisibleLabels) return labels;
    
    const interval = Math.ceil(labels.length / maxVisibleLabels);
    return labels.map((label, index) => (index % interval === 0) ? label : '');
  };

  const handleDateFilterChange = (filter: 'week' | 'month' | 'quarter' | 'year' | 'custom') => {
    setDateRange(filter);
    setShowDateRangeModal(false);

    if (filter === 'custom') {
      setTimeout(() => setShowCustomDateRangePicker(true), 300);
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

        {/* Inventory Spend */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleContainer}>
              <Package size={20} color="#7c3aed" />
              <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Inventory Spend
              </Text>
            </View>
          </View>

          {!inventorySpendData || (inventorySpendData.imports === 0 && !inventorySpendData.writeOffUnits && !inventorySpendData.foundUnits) ? (
            <View style={styles.noDataContainer}>
              <Text style={[styles.noDataText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                No stock purchased or written off in this period
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.spendStats}>
                <View style={styles.spendStat}>
                  <Text style={[styles.spendStatValue, { color: '#7c3aed' }]}>{fmt(inventorySpendData.total)}</Text>
                  <Text style={[styles.spendStatLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Total spent</Text>
                </View>
                <View style={styles.spendStat}>
                  <Text style={[styles.spendStatValue, { color: isDark ? '#f9fafb' : '#111827' }]}>{inventorySpendData.units}</Text>
                  <Text style={[styles.spendStatLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Units received</Text>
                </View>
                <View style={styles.spendStat}>
                  <Text style={[styles.spendStatValue, { color: isDark ? '#f9fafb' : '#111827' }]}>{inventorySpendData.batches}</Text>
                  <Text style={[styles.spendStatLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Batches</Text>
                </View>
              </View>

              {inventorySpendData.series.some((s: any) => s.amount > 0) && (
                <View style={styles.chartContainer}>
                  <BarChartKit
                    data={{
                      labels: getProcessedLabels(inventorySpendData.series.map((s: any) => s.label), 7),
                      datasets: [{ data: inventorySpendData.series.map((s: any) => s.amount) }],
                    }}
                    width={screenWidth - 64}
                    height={200}
                    yAxisLabel=""
                    yAxisSuffix=""
                    fromZero
                    withInnerLines={false}
                    chartConfig={{
                      backgroundColor: isDark ? '#374151' : '#ffffff',
                      backgroundGradientFrom: isDark ? '#374151' : '#ffffff',
                      backgroundGradientTo: isDark ? '#374151' : '#ffffff',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(124, 58, 237, ${opacity})`,
                      labelColor: (opacity = 1) => isDark ? `rgba(249, 250, 251, ${opacity})` : `rgba(17, 24, 39, ${opacity})`,
                      barPercentage: 0.6,
                      style: { borderRadius: 16 },
                    }}
                    style={{ marginVertical: 8, borderRadius: 16 }}
                  />
                </View>
              )}

              <View style={[styles.spendRow, { borderTopColor: isDark ? '#374151' : '#e5e7eb' }]}>
                <Text style={[styles.spendRowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Base cost of goods</Text>
                <Text style={[styles.spendRowValue, { color: isDark ? '#f9fafb' : '#111827' }]}>{fmt(inventorySpendData.baseCost)}</Text>
              </View>
              <View style={styles.spendRow}>
                <Text style={[styles.spendRowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Added costs (shipping, fees)</Text>
                <Text style={[styles.spendRowValue, { color: isDark ? '#f9fafb' : '#111827' }]}>{fmt(inventorySpendData.addedCosts)}</Text>
              </View>
              <TouchableOpacity style={styles.spendRow} onPress={() => router.push('/inventory/stock-adjustments')}>
                <Text style={[styles.spendRowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Written off (damaged, expired, lost) · {inventorySpendData.writeOffUnits || 0} units
                </Text>
                <Text style={[styles.spendRowValue, { color: inventorySpendData.writeOffs > 0 ? '#dc2626' : (isDark ? '#f9fafb' : '#111827') }]}>{fmt(inventorySpendData.writeOffs || 0)}</Text>
              </TouchableOpacity>
              {inventorySpendData.foundUnits > 0 && (
                <View style={styles.spendRow}>
                  <Text style={[styles.spendRowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Found stock · {inventorySpendData.foundUnits} units</Text>
                  <Text style={[styles.spendRowValue, { color: '#059669' }]}>{fmt(inventorySpendData.found)}</Text>
                </View>
              )}

              <Text style={[styles.spendSubtitle, { color: isDark ? '#f9fafb' : '#111827' }]}>Top products by spend</Text>
              {inventorySpendData.topProducts.map((p: any) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.spendProductRow, { borderBottomColor: isDark ? '#374151' : '#f3f4f6' }]}
                  onPress={() => router.push(`/inventory/product-details?productId=${p.id}`)}
                >
                  <View style={styles.spendProductText}>
                    <Text style={[styles.spendProductName, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.spendProductMeta, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                      {p.quantity} units · {fmt(p.avgUnitCost)} each · {p.imports} {p.imports === 1 ? 'import' : 'imports'}
                    </Text>
                  </View>
                  <Text style={[styles.spendProductAmount, { color: '#7c3aed' }]}>{fmt(p.spend)}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </Card>

        {/* Fees & Discounts: summary here, full report on its own screen */}
        <TouchableOpacity activeOpacity={0.8} onPress={handleViewFeesAndDiscounts}>
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Percent size={20} color="#db2777" />
                <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  Fees & Discounts
                </Text>
              </View>
              <Text style={styles.feeLink}>Details ›</Text>
            </View>
            <Text style={[styles.feeIntro, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Courier fees you absorbed and discounts you gave. These are not in Expenses.
            </Text>

            {!feesData || feesData.range.total === 0 ? (
              <Text style={[styles.feeEmpty, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                None in this period. Tap to look at other dates.
              </Text>
            ) : (
              <>
                <View style={styles.spendStats}>
                  <View style={styles.spendStat}>
                    <Text style={[styles.spendStatValue, { color: '#db2777' }]}>{fmt(feesData.range.total)}</Text>
                    <Text style={[styles.spendStatLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Given up</Text>
                  </View>
                  <View style={styles.spendStat}>
                    <Text style={[styles.spendStatValue, { color: isDark ? '#f9fafb' : '#111827' }]}>{fmt(feesData.range.deliveryFees)}</Text>
                    <Text style={[styles.spendStatLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Delivery fees</Text>
                  </View>
                  <View style={styles.spendStat}>
                    <Text style={[styles.spendStatValue, { color: isDark ? '#f9fafb' : '#111827' }]}>{fmt(feesData.range.discounts)}</Text>
                    <Text style={[styles.spendStatLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>Discounts</Text>
                  </View>
                </View>
                <View style={[styles.spendRow, { borderTopColor: isDark ? '#374151' : '#e5e7eb' }]}>
                  <Text style={[styles.spendRowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>Share of full-price revenue</Text>
                  <Text style={[styles.spendRowValue, { color: isDark ? '#f9fafb' : '#111827' }]}>{feesData.range.shareOfRevenue.toFixed(1)}%</Text>
                </View>
              </>
            )}
            <Text style={[styles.feeFooter, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              Tap for the month-by-month breakdown and any date range
            </Text>
          </Card>
        </TouchableOpacity>

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

          <TouchableOpacity
            style={[styles.statementButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
            onPress={() => router.push('/reports/sales-history')}
          >
            <FileText size={20} color="#8b5cf6" />
            <Text style={[styles.statementButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('reports.salesHistory')}
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
    const totalOperatingExpenses = profitData.reduce((sum: number, item: any) => sum + (item.operatingExpenses ?? item.expenses), 0);
    const totalDeliveryFees = profitData.reduce((sum: number, item: any) => sum + (item.deliveryFees ?? 0), 0);
    const totalExpenses = totalOperatingExpenses + totalDeliveryFees;
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
                {fmt(totalRevenue)}
              </Text>
            </View>
            
            <View style={styles.incomeRow}>
              <Text style={[styles.incomeLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Cost of Goods Sold
              </Text>
              <Text style={[styles.incomeValue, { color: '#dc2626' }]}>
                {fmt(totalCOGS)}
              </Text>
            </View>
            
            <View style={[styles.incomeRow, styles.subtotalRow]}>
              <Text style={[styles.subtotalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Gross Profit
              </Text>
              <Text style={[styles.subtotalValue, { color: grossProfit >= 0 ? '#059669' : '#dc2626' }]}>
                {fmt(grossProfit)}
              </Text>
            </View>
            
            <View style={styles.incomeRow}>
              <Text style={[styles.incomeLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Operating Expenses
              </Text>
              <Text style={[styles.incomeValue, { color: '#dc2626' }]}>
                {fmt(totalOperatingExpenses)}
              </Text>
            </View>

            {totalDeliveryFees > 0 && (
              <View style={styles.incomeRow}>
                <Text style={[styles.incomeLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Delivery Fees
                </Text>
                <Text style={[styles.incomeValue, { color: '#dc2626' }]}>
                  {fmt(totalDeliveryFees)}
                </Text>
              </View>
            )}
            
            <View style={[styles.incomeRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                Net Profit
              </Text>
              <Text style={[styles.totalValue, { color: netProfit >= 0 ? '#059669' : '#dc2626' }]}>
                {fmt(netProfit)}
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

    // Every month from the first recorded activity up to the current month, newest first,
    // grouped under a heading per year. Falls back to the last 12 months when nothing is recorded yet.
    const now = new Date();
    const first = activityStart ?? new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const firstKey = first.getFullYear() * 12 + first.getMonth();
    const lastKey = now.getFullYear() * 12 + now.getMonth();

    const years: { year: number; months: { month: number; year: number; label: string }[] }[] = [];
    for (let key = lastKey; key >= firstKey; key--) {
      const year = Math.floor(key / 12);
      const month = key - year * 12;
      let bucket = years[years.length - 1];
      if (!bucket || bucket.year !== year) {
        bucket = { year, months: [] };
        years.push(bucket);
      }
      bucket.months.push({ month, year, label: format(new Date(year, month, 1), 'MMMM') });
    }

    return (
      <View style={styles.tabContent}>
        <Text style={[styles.cashFlowTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
          Cash Flow Statements
        </Text>

        <Text style={[styles.cashFlowSubtitle, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
          Select a month to view the cash flow statement
        </Text>

        {years.map(group => (
          <View key={group.year} style={styles.yearGroup}>
            <View style={[styles.yearHeader, { borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
              <Text style={[styles.yearHeaderText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {group.year}
              </Text>
              <Text style={[styles.yearHeaderCount, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                {group.months.length} {group.months.length === 1 ? 'month' : 'months'}
              </Text>
            </View>
            {group.months.map(monthData => (
              <TouchableOpacity
                key={`${monthData.year}-${monthData.month}`}
                style={[styles.monthButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                onPress={() => router.push(`/reports/cash-flow?month=${monthData.month}&year=${monthData.year}${currencyParam}`)}
              >
                <Calendar size={20} color="#2563eb" />
                <Text style={[styles.monthButtonText, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  {monthData.label}
                </Text>
                <Text style={[styles.monthButtonYear, { color: isDark ? '#9ca3af' : '#9ca3af' }]}>
                  {monthData.year}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
        <View style={styles.headerActions}>
          {currencies.length > 1 && (
            <CurrencyDropdown
              currencies={currencies}
              selectedCurrencyId={activeCurrencyId ?? null}
              onSelect={setSelectedCurrencyId}
            />
          )}
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleDownloadAllReports}
          >
            <Download size={20} color={isDark ? '#f9fafb' : '#111827'} />
          </TouchableOpacity>
        </View>
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
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowCustomDateRangePicker(false)}
      >
        <View style={[styles.datePickerScreen, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
          <View style={[styles.datePickerHeader, { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderBottomColor: isDark ? '#374151' : '#e5e7eb' }]}>
            <TouchableOpacity onPress={() => setShowCustomDateRangePicker(false)} style={styles.datePickerBack}>
              <ArrowLeft size={24} color={isDark ? '#f9fafb' : '#111827'} />
            </TouchableOpacity>
            <Text style={[styles.datePickerTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {t('reports.customRange')}
            </Text>
            <View style={styles.datePickerHeaderRight} />
          </View>
          <ScrollView contentContainerStyle={styles.datePickerContent} showsVerticalScrollIndicator={false}>
            <DateRangePicker
              startDate={customStartDate}
              endDate={customEndDate}
              onConfirm={handleDateRangeConfirm}
              onCancel={() => setShowCustomDateRangePicker(false)}
            />
          </ScrollView>
        </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  spendStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  spendStat: {
    flex: 1,
  },
  spendStatValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  spendStatLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  spendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  spendRowLabel: {
    fontSize: 14,
  },
  spendRowValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  feeIntro: {
    fontSize: 12,
    marginBottom: 12,
  },
  feeLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#db2777',
  },
  feeEmpty: {
    fontSize: 13,
    paddingVertical: 12,
  },
  feeFooter: {
    fontSize: 12,
    marginTop: 10,
  },
  spendSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  spendProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  spendProductText: {
    flex: 1,
  },
  spendProductName: {
    fontSize: 14,
    fontWeight: '500',
  },
  spendProductMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  spendProductAmount: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
    flex: 1,
  },
  monthButtonYear: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  yearGroup: {
    marginBottom: 8,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  yearHeaderText: {
    fontSize: 18,
    fontWeight: '700',
  },
  yearHeaderCount: {
    fontSize: 12,
  },
  datePickerScreen: {
    flex: 1,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  datePickerBack: {
    padding: 8,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  datePickerHeaderRight: {
    width: 40,
  },
  datePickerContent: {
    padding: 16,
    paddingBottom: 40,
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