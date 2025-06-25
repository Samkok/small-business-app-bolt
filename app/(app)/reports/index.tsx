import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import DateRangePicker from '@/src/components/sales/DateRangePicker';
import { 
  ArrowLeft, 
  Calendar, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart, 
  LineChart, 
  PieChart,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react-native';
import { reportsService } from '@/src/services/reports';
import { importService } from '@/src/services/importService';
import { LineChart as RNLineChart, BarChart as RNBarChart, PieChart as RNPieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width - 40; // Accounting for padding

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [dateFilter, setDateFilter] = useState<'this_month' | 'three_months' | 'six_months' | 'custom' | 'all'>('this_month');
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [dateRangeText, setDateRangeText] = useState('This Month');
  
  // Chart data states
  const [revenueData, setRevenueData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [profitData, setProfitData] = useState<any>(null);
  const [expenseCategoryData, setExpenseCategoryData] = useState<any>(null);
  const [cashFlowData, setCashFlowData] = useState<any>(null);
  
  // Summary data
  const [summaryData, setSummaryData] = useState<{
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    totalCOGS: number;
    netProfit: number;
  }>({
    totalRevenue: 0,
    totalExpenses: 0,
    totalProfit: 0,
    totalCOGS: 0,
    netProfit: 0
  });
  
  // UI states
  const [activeSection, setActiveSection] = useState<'overview' | 'revenue' | 'expenses' | 'profit' | 'cashflow'>('overview');
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { profile } = useAuth();

  const dateFilterOptions = [
    { value: 'this_month', label: 'This Month' },
    { value: 'three_months', label: 'Last 3 Months' },
    { value: 'six_months', label: 'Last 6 Months' },
    { value: 'custom', label: 'Custom Range' },
    { value: 'all', label: 'All Time' },
  ];

  // Helper function to calculate dates without state updates
  const calculateDatesForFilter = useCallback((filter: 'this_month' | 'three_months' | 'six_months' | 'custom' | 'all', customStart?: Date, customEnd?: Date) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let text = '';
    
    switch (filter) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = 'This Month';
        break;
      case 'three_months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = 'Last 3 Months';
        break;
      case 'six_months':
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = 'Last 6 Months';
        break;
      case 'custom':
        start = customStart || new Date();
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = customEnd || new Date();
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        break;
      case 'all':
        start = new Date(2000, 0, 1);
        start.setHours(0, 0, 0, 0); // Set to beginning of day
        
        end = now;
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        text = 'All Time';
        break;
    }
    
    return { start, end, text };
  }, []);

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate]);

  const loadReportData = async () => {
    if (!profile?.id) return;
    
    setChartLoading(true);
    try {
      // Format dates for API calls
      const formattedStartDate = startDate.toISOString();
      const formattedEndDate = endDate.toISOString();
      
      // Load all report data in parallel
      const [
        revenueChartData,
        expenseChartData,
        profitChartData,
        expenseCategoriesData,
        cashFlowStatement
      ] = await Promise.all([
        reportsService.getRevenueChart(profile.id, formattedStartDate, formattedEndDate),
        reportsService.getExpenseChart(profile.id, formattedStartDate, formattedEndDate),
        reportsService.getProfitChart(profile.id, formattedStartDate, formattedEndDate),
        reportsService.getExpensesByCategory(profile.id, formattedStartDate, formattedEndDate),
        reportsService.getCashFlowStatement(profile.id, startDate.getMonth(), startDate.getFullYear())
      ]);
      
      // Set chart data
      setRevenueData(revenueChartData);
      setExpenseData(expenseChartData);
      setProfitData(profitChartData);
      setExpenseCategoryData(expenseCategoriesData);
      setCashFlowData(cashFlowStatement);
      
      // Calculate summary data
      const totalRevenue = revenueChartData.reduce((sum: number, item: any) => sum + item.revenue, 0);
      const totalExpenses = expenseChartData.reduce((sum: number, item: any) => sum + item.amount, 0);
      const totalCOGS = profitChartData.reduce((sum: number, item: any) => sum + item.cogs, 0);
      const totalProfit = profitChartData.reduce((sum: number, item: any) => sum + item.profit, 0);
      const netProfit = totalProfit - totalExpenses;
      
      setSummaryData({
        totalRevenue,
        totalExpenses,
        totalProfit,
        totalCOGS,
        netProfit
      });
      
    } catch (error) {
      console.error('Error loading report data:', error);
      Alert.alert('Error', 'Failed to load report data');
    } finally {
      setChartLoading(false);
      setLoading(false);
    }
  };

  const handleDateFilterChange = useCallback((filter: 'this_month' | 'three_months' | 'six_months' | 'custom' | 'all') => {
    setDateFilter(filter);
    
    if (filter === 'custom') {
      setShowDateRangePicker(true);
    } else {
      // Calculate and set the dates for non-custom filters
      const { start, end, text } = calculateDatesForFilter(filter);
      setStartDate(start);
      setEndDate(end);
      setDateRangeText(text);
    }
  }, [calculateDatesForFilter]);

  const handleDateRangeConfirm = useCallback((start: Date, end: Date) => {
    // Set start date to beginning of day
    const adjustedStart = new Date(start);
    adjustedStart.setHours(0, 0, 0, 0);
    
    // Set end date to end of day
    const adjustedEnd = new Date(end);
    adjustedEnd.setHours(23, 59, 59, 999);
    
    setStartDate(adjustedStart);
    setEndDate(adjustedEnd);
    setDateRangeText(`${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
    setShowDateRangePicker(false);
  }, []);

  const handleExportIncomeStatement = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Not Supported', 'Export is only available on web platform');
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'No business profile found');
      return;
    }

    try {
      const csvData = await importService.exportIncomeStatementToCsv(
        profile.id, 
        startDate.toISOString(), 
        endDate.toISOString()
      );
      
      // Create a download link
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `income_statement_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      Alert.alert('Success', 'Income statement exported successfully');
    } catch (error) {
      console.error('Error exporting income statement:', error);
      Alert.alert('Error', 'Failed to export income statement');
    }
  }, [profile?.id, startDate, endDate]);

  const handleExportCashFlow = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Not Supported', 'Export is only available on web platform');
      return;
    }

    if (!profile?.id) {
      Alert.alert('Error', 'No business profile found');
      return;
    }

    try {
      const csvData = await importService.exportCashFlowToCsv(
        profile.id, 
        startDate.getMonth(),
        startDate.getFullYear()
      );
      
      // Create a download link
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cash_flow_${startDate.toLocaleString('default', { month: 'long' })}_${startDate.getFullYear()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      Alert.alert('Success', 'Cash flow statement exported successfully');
    } catch (error) {
      console.error('Error exporting cash flow statement:', error);
      Alert.alert('Error', 'Failed to export cash flow statement');
    }
  }, [profile?.id, startDate]);

  const chartConfig = {
    backgroundColor: isDark ? '#374151' : '#ffffff',
    backgroundGradientFrom: isDark ? '#374151' : '#ffffff',
    backgroundGradientTo: isDark ? '#374151' : '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => isDark ? `rgba(249, 250, 251, ${opacity})` : `rgba(17, 24, 39, ${opacity})`,
    labelColor: (opacity = 1) => isDark ? `rgba(209, 213, 219, ${opacity})` : `rgba(107, 114, 128, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: isDark ? '#f9fafb' : '#111827',
    },
  };

  // Memoized chart data to prevent unnecessary recalculations
  const revenueChartData = useMemo(() => {
    if (!revenueData) return null;
    
    return {
      labels: revenueData.map((item: any) => item.label),
      datasets: [
        {
          data: revenueData.map((item: any) => item.revenue),
          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`, // Green color for revenue
          strokeWidth: 2
        }
      ],
      legend: ['Revenue']
    };
  }, [revenueData]);

  const expenseChartData = useMemo(() => {
    if (!expenseData) return null;
    
    return {
      labels: expenseData.map((item: any) => item.label),
      datasets: [
        {
          data: expenseData.map((item: any) => item.amount),
          color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`, // Red color for expenses
          strokeWidth: 2
        }
      ],
      legend: ['Expenses']
    };
  }, [expenseData]);

  const profitChartData = useMemo(() => {
    if (!profitData) return null;
    
    return {
      labels: profitData.map((item: any) => item.label),
      datasets: [
        {
          data: profitData.map((item: any) => item.profit),
          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`, // Green for profit
          strokeWidth: 2
        },
        {
          data: profitData.map((item: any) => item.netProfit),
          color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`, // Blue for net profit
          strokeWidth: 2
        }
      ],
      legend: ['Gross Profit', 'Net Profit']
    };
  }, [profitData]);

  const expenseCategoryChartData = useMemo(() => {
    if (!expenseCategoryData) return null;
    
    // Generate colors for pie chart
    const colors = [
      '#2563eb', // Blue
      '#059669', // Green
      '#8b5cf6', // Purple
      '#ea580c', // Orange
      '#dc2626', // Red
      '#06b6d4', // Cyan
      '#f59e0b', // Amber
      '#ec4899', // Pink
      '#64748b', // Slate
      '#84cc16'  // Lime
    ];
    
    return {
      labels: expenseCategoryData.map((item: any) => item.category),
      data: expenseCategoryData.map((item: any) => item.percentage),
      colors: expenseCategoryData.map((_: any, index: number) => colors[index % colors.length])
    };
  }, [expenseCategoryData]);

  if (loading) {
    return <LoadingSpinner text="Loading reports data..." />;
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
          {t('reports.title')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Date Filter */}
      <View style={styles.dateFilterContainer}>
        <TouchableOpacity
          style={[
            styles.dateFilterButton,
            { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
          ]}
          onPress={() => setShowDateRangePicker(true)}
        >
          <Calendar size={16} color="#2563eb" />
          <Text style={[styles.dateFilterText, { color: isDark ? '#f9fafb' : '#374151' }]}>
            {dateRangeText}
          </Text>
          <ChevronDown size={16} color="#2563eb" />
        </TouchableOpacity>

        {/* Export Button */}
        <TouchableOpacity
          style={[
            styles.exportButton,
            { backgroundColor: isDark ? '#374151' : '#f3f4f6' }
          ]}
          onPress={handleExportIncomeStatement}
        >
          <Download size={16} color="#059669" />
          <Text style={[styles.exportButtonText, { color: '#059669' }]}>
            Export
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Range Picker Modal */}
      {showDateRangePicker && (
        <View style={styles.modalOverlay}>
          <View 
            style={[
              styles.dateFilterModal,
              { backgroundColor: isDark ? '#374151' : '#ffffff' }
            ]}
          >
            <Text style={[styles.dateFilterModalTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              Select Date Range
            </Text>
            
            {dateFilter === 'custom' ? (
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onConfirm={handleDateRangeConfirm}
                onCancel={() => setShowDateRangePicker(false)}
              />
            ) : (
              <View style={styles.dateFilterOptions}>
                {dateFilterOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.dateFilterOption,
                      {
                        backgroundColor: dateFilter === option.value 
                          ? '#2563eb' 
                          : (isDark ? '#4b5563' : '#f3f4f6')
                      }
                    ]}
                    onPress={() => {
                      handleDateFilterChange(option.value as any);
                      if (option.value !== 'custom') {
                        setShowDateRangePicker(false);
                      }
                    }}
                  >
                    <Text style={{
                      color: dateFilter === option.value 
                        ? '#ffffff' 
                        : (isDark ? '#f9fafb' : '#374151'),
                      fontWeight: '500'
                    }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryContent}>
              <DollarSign size={20} color="#059669" />
              <View style={styles.summaryText}>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  ${summaryData.totalRevenue.toFixed(2)}
                </Text>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Total Revenue
                </Text>
              </View>
            </View>
          </Card>

          <Card style={styles.summaryCard}>
            <View style={styles.summaryContent}>
              <TrendingDown size={20} color="#dc2626" />
              <View style={styles.summaryText}>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  ${summaryData.totalExpenses.toFixed(2)}
                </Text>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Total Expenses
                </Text>
              </View>
            </View>
          </Card>

          <Card style={styles.summaryCard}>
            <View style={styles.summaryContent}>
              <BarChart size={20} color="#8b5cf6" />
              <View style={styles.summaryText}>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  ${summaryData.totalCOGS.toFixed(2)}
                </Text>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Total COGS
                </Text>
              </View>
            </View>
          </Card>

          <Card style={styles.summaryCard}>
            <View style={styles.summaryContent}>
              <TrendingUp size={20} color="#059669" />
              <View style={styles.summaryText}>
                <Text style={[styles.summaryValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                  ${summaryData.netProfit.toFixed(2)}
                </Text>
                <Text style={[styles.summaryLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  Net Profit
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Section Navigation */}
        <View style={styles.sectionNav}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.sectionButton,
                activeSection === 'overview' && styles.activeSectionButton
              ]}
              onPress={() => setActiveSection('overview')}
            >
              <Text style={[
                styles.sectionButtonText,
                activeSection === 'overview' && styles.activeSectionButtonText
              ]}>
                Overview
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.sectionButton,
                activeSection === 'revenue' && styles.activeSectionButton
              ]}
              onPress={() => setActiveSection('revenue')}
            >
              <Text style={[
                styles.sectionButtonText,
                activeSection === 'revenue' && styles.activeSectionButtonText
              ]}>
                Revenue
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.sectionButton,
                activeSection === 'expenses' && styles.activeSectionButton
              ]}
              onPress={() => setActiveSection('expenses')}
            >
              <Text style={[
                styles.sectionButtonText,
                activeSection === 'expenses' && styles.activeSectionButtonText
              ]}>
                Expenses
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.sectionButton,
                activeSection === 'profit' && styles.activeSectionButton
              ]}
              onPress={() => setActiveSection('profit')}
            >
              <Text style={[
                styles.sectionButtonText,
                activeSection === 'profit' && styles.activeSectionButtonText
              ]}>
                Profit
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.sectionButton,
                activeSection === 'cashflow' && styles.activeSectionButton
              ]}
              onPress={() => setActiveSection('cashflow')}
            >
              <Text style={[
                styles.sectionButtonText,
                activeSection === 'cashflow' && styles.activeSectionButtonText
              ]}>
                Cash Flow
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Chart Content based on active section */}
        {chartLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={[styles.loadingText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              Loading chart data...
            </Text>
          </View>
        ) : (
          <>
            {/* Overview Section */}
            {activeSection === 'overview' && (
              <View style={styles.chartSection}>
                <Card style={styles.chartCard}>
                  <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Revenue vs Expenses
                  </Text>
                  {revenueChartData && expenseChartData && (
                    <View style={styles.chartContainer}>
                      <RNLineChart
                        data={{
                          labels: revenueChartData.labels.slice(0, 6), // Show only first 6 labels for readability
                          datasets: [
                            {
                              data: revenueChartData.datasets[0].data,
                              color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
                              strokeWidth: 2
                            },
                            {
                              data: expenseChartData.datasets[0].data,
                              color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`,
                              strokeWidth: 2
                            }
                          ],
                          legend: ['Revenue', 'Expenses']
                        }}
                        width={screenWidth}
                        height={220}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                      />
                    </View>
                  )}
                </Card>

                <Card style={styles.chartCard}>
                  <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Expense Breakdown
                  </Text>
                  {expenseCategoryChartData && (
                    <View style={styles.chartContainer}>
                      <RNPieChart
                        data={expenseCategoryData.map((item: any, index: number) => ({
                          name: item.category,
                          population: item.amount,
                          color: expenseCategoryChartData.colors[index],
                          legendFontColor: isDark ? '#d1d5db' : '#6b7280',
                          legendFontSize: 12
                        }))}
                        width={screenWidth}
                        height={220}
                        chartConfig={chartConfig}
                        accessor="population"
                        backgroundColor="transparent"
                        paddingLeft="15"
                        absolute
                      />
                    </View>
                  )}
                </Card>

                <Card style={styles.chartCard}>
                  <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Profit Growth
                  </Text>
                  {profitChartData && (
                    <View style={styles.chartContainer}>
                      <RNLineChart
                        data={profitChartData}
                        width={screenWidth}
                        height={220}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                      />
                    </View>
                  )}
                </Card>
              </View>
            )}

            {/* Revenue Section */}
            {activeSection === 'revenue' && (
              <View style={styles.chartSection}>
                <Card style={styles.chartCard}>
                  <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Revenue Over Time
                  </Text>
                  {revenueChartData && (
                    <View style={styles.chartContainer}>
                      <RNBarChart
                        data={revenueChartData}
                        width={screenWidth}
                        height={220}
                        chartConfig={{
                          ...chartConfig,
                          color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
                        }}
                        style={styles.chart}
                        verticalLabelRotation={30}
                      />
                    </View>
                  )}
                </Card>

                <Card style={styles.detailsCard}>
                  <Text style={[styles.detailsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Revenue Details
                  </Text>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Total Revenue:
                    </Text>
                    <Text style={[styles.detailsValue, { color: '#059669' }]}>
                      ${summaryData.totalRevenue.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Average Daily Revenue:
                    </Text>
                    <Text style={[styles.detailsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      ${(summaryData.totalRevenue / (revenueData?.length || 1)).toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Highest Revenue Day:
                    </Text>
                    <Text style={[styles.detailsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {revenueData && revenueData.length > 0 ? 
                        `${revenueData.reduce((max: any, item: any) => item.revenue > max.revenue ? item : max, revenueData[0]).label} ($${revenueData.reduce((max: any, item: any) => item.revenue > max.revenue ? item : max, revenueData[0]).revenue.toFixed(2)})` : 
                        'N/A'}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Lowest Revenue Day:
                    </Text>
                    <Text style={[styles.detailsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {revenueData && revenueData.length > 0 ? 
                        `${revenueData.reduce((min: any, item: any) => item.revenue < min.revenue ? item : min, revenueData[0]).label} ($${revenueData.reduce((min: any, item: any) => item.revenue < min.revenue ? item : min, revenueData[0]).revenue.toFixed(2)})` : 
                        'N/A'}
                    </Text>
                  </View>
                </Card>
              </View>
            )}

            {/* Expenses Section */}
            {activeSection === 'expenses' && (
              <View style={styles.chartSection}>
                <Card style={styles.chartCard}>
                  <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Expenses Over Time
                  </Text>
                  {expenseChartData && (
                    <View style={styles.chartContainer}>
                      <RNBarChart
                        data={expenseChartData}
                        width={screenWidth}
                        height={220}
                        chartConfig={{
                          ...chartConfig,
                          color: (opacity = 1) => `rgba(220, 38, 38, ${opacity})`,
                        }}
                        style={styles.chart}
                        verticalLabelRotation={30}
                      />
                    </View>
                  )}
                </Card>

                <Card style={styles.chartCard}>
                  <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Expenses by Category
                  </Text>
                  {expenseCategoryChartData && (
                    <View style={styles.chartContainer}>
                      <RNPieChart
                        data={expenseCategoryData.map((item: any, index: number) => ({
                          name: item.category,
                          population: item.amount,
                          color: expenseCategoryChartData.colors[index],
                          legendFontColor: isDark ? '#d1d5db' : '#6b7280',
                          legendFontSize: 12
                        }))}
                        width={screenWidth}
                        height={220}
                        chartConfig={chartConfig}
                        accessor="population"
                        backgroundColor="transparent"
                        paddingLeft="15"
                        absolute
                      />
                    </View>
                  )}
                </Card>

                <Card style={styles.detailsCard}>
                  <Text style={[styles.detailsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Expense Details
                  </Text>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Total Expenses:
                    </Text>
                    <Text style={[styles.detailsValue, { color: '#dc2626' }]}>
                      ${summaryData.totalExpenses.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Average Daily Expense:
                    </Text>
                    <Text style={[styles.detailsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      ${(summaryData.totalExpenses / (expenseData?.length || 1)).toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Highest Expense Category:
                    </Text>
                    <Text style={[styles.detailsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {expenseCategoryData && expenseCategoryData.length > 0 ? 
                        `${expenseCategoryData.reduce((max: any, item: any) => item.amount > max.amount ? item : max, expenseCategoryData[0]).category} ($${expenseCategoryData.reduce((max: any, item: any) => item.amount > max.amount ? item : max, expenseCategoryData[0]).amount.toFixed(2)})` : 
                        'N/A'}
                    </Text>
                  </View>
                </Card>
              </View>
            )}

            {/* Profit Section */}
            {activeSection === 'profit' && (
              <View style={styles.chartSection}>
                <Card style={styles.chartCard}>
                  <Text style={[styles.chartTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Profit Growth
                  </Text>
                  {profitChartData && (
                    <View style={styles.chartContainer}>
                      <RNLineChart
                        data={profitChartData}
                        width={screenWidth}
                        height={220}
                        chartConfig={chartConfig}
                        bezier
                        style={styles.chart}
                      />
                    </View>
                  )}
                </Card>

                <Card style={styles.detailsCard}>
                  <Text style={[styles.detailsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Profit Analysis
                  </Text>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Gross Profit:
                    </Text>
                    <Text style={[styles.detailsValue, { color: '#059669' }]}>
                      ${summaryData.totalProfit.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Net Profit:
                    </Text>
                    <Text style={[styles.detailsValue, { color: summaryData.netProfit >= 0 ? '#059669' : '#dc2626' }]}>
                      ${summaryData.netProfit.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Profit Margin:
                    </Text>
                    <Text style={[styles.detailsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {summaryData.totalRevenue > 0 ? 
                        `${((summaryData.totalProfit / summaryData.totalRevenue) * 100).toFixed(2)}%` : 
                        'N/A'}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Net Profit Margin:
                    </Text>
                    <Text style={[styles.detailsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      {summaryData.totalRevenue > 0 ? 
                        `${((summaryData.netProfit / summaryData.totalRevenue) * 100).toFixed(2)}%` : 
                        'N/A'}
                    </Text>
                  </View>
                </Card>

                <Card style={styles.detailsCard}>
                  <Text style={[styles.detailsTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                    Income Statement
                  </Text>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Revenue:
                    </Text>
                    <Text style={[styles.detailsValue, { color: '#059669' }]}>
                      ${summaryData.totalRevenue.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Cost of Goods Sold:
                    </Text>
                    <Text style={[styles.detailsValue, { color: '#dc2626' }]}>
                      ${summaryData.totalCOGS.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Gross Profit:
                    </Text>
                    <Text style={[styles.detailsValue, { color: '#059669' }]}>
                      ${summaryData.totalProfit.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.detailsRow}>
                    <Text style={[styles.detailsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      Operating Expenses:
                    </Text>
                    <Text style={[styles.detailsValue, { color: '#dc2626' }]}>
                      ${summaryData.totalExpenses.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={[styles.detailsRow, styles.totalRow]}>
                    <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      Net Profit:
                    </Text>
                    <Text style={[styles.totalValue, { color: summaryData.netProfit >= 0 ? '#059669' : '#dc2626' }]}>
                      ${summaryData.netProfit.toFixed(2)}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.exportStatementButton, { backgroundColor: isDark ? '#4b5563' : '#e5e7eb' }]}
                    onPress={handleExportIncomeStatement}
                  >
                    <FileText size={16} color="#2563eb" />
                    <Text style={styles.exportStatementText}>
                      Export Income Statement
                    </Text>
                  </TouchableOpacity>
                </Card>
              </View>
            )}

            {/* Cash Flow Section */}
            {activeSection === 'cashflow' && (
              <View style={styles.chartSection}>
                <Card style={styles.cashFlowCard}>
                  <View style={styles.cashFlowHeader}>
                    <Text style={[styles.cashFlowTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                      Cash Flow Statement
                    </Text>
                    <Text style={[styles.cashFlowPeriod, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                      {startDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </Text>
                  </View>

                  {cashFlowData ? (
                    <>
                      {/* Operating Activities */}
                      <View style={styles.cashFlowSection}>
                        <Text style={[styles.cashFlowSectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                          Operating Activities
                        </Text>
                        
                        <View style={styles.cashFlowRow}>
                          <Text style={[styles.cashFlowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                            Net Income
                          </Text>
                          <Text style={[styles.cashFlowValue, { color: cashFlowData.netIncome >= 0 ? '#059669' : '#dc2626' }]}>
                            ${cashFlowData.netIncome.toFixed(2)}
                          </Text>
                        </View>
                        
                        <View style={styles.cashFlowRow}>
                          <Text style={[styles.cashFlowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                            Inventory Changes
                          </Text>
                          <Text style={[styles.cashFlowValue, { color: cashFlowData.inventoryChanges >= 0 ? '#059669' : '#dc2626' }]}>
                            ${cashFlowData.inventoryChanges.toFixed(2)}
                          </Text>
                        </View>
                        
                        <View style={[styles.cashFlowRow, styles.subtotalRow]}>
                          <Text style={[styles.cashFlowSubtotalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                            Net Cash from Operations
                          </Text>
                          <Text style={[styles.cashFlowSubtotalValue, { color: cashFlowData.operatingCashFlow >= 0 ? '#059669' : '#dc2626' }]}>
                            ${cashFlowData.operatingCashFlow.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Investing Activities */}
                      <View style={styles.cashFlowSection}>
                        <Text style={[styles.cashFlowSectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                          Investing Activities
                        </Text>
                        
                        <View style={styles.cashFlowRow}>
                          <Text style={[styles.cashFlowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                            Equipment Purchases
                          </Text>
                          <Text style={[styles.cashFlowValue, { color: '#dc2626' }]}>
                            ${cashFlowData.equipmentPurchases.toFixed(2)}
                          </Text>
                        </View>
                        
                        <View style={[styles.cashFlowRow, styles.subtotalRow]}>
                          <Text style={[styles.cashFlowSubtotalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                            Net Cash from Investing
                          </Text>
                          <Text style={[styles.cashFlowSubtotalValue, { color: cashFlowData.investingCashFlow >= 0 ? '#059669' : '#dc2626' }]}>
                            ${cashFlowData.investingCashFlow.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Financing Activities */}
                      <View style={styles.cashFlowSection}>
                        <Text style={[styles.cashFlowSectionTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
                          Financing Activities
                        </Text>
                        
                        <View style={styles.cashFlowRow}>
                          <Text style={[styles.cashFlowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                            Owner Contributions
                          </Text>
                          <Text style={[styles.cashFlowValue, { color: '#059669' }]}>
                            ${cashFlowData.ownerContributions.toFixed(2)}
                          </Text>
                        </View>
                        
                        <View style={styles.cashFlowRow}>
                          <Text style={[styles.cashFlowLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                            Owner Withdrawals
                          </Text>
                          <Text style={[styles.cashFlowValue, { color: '#dc2626' }]}>
                            ${cashFlowData.ownerWithdrawals.toFixed(2)}
                          </Text>
                        </View>
                        
                        <View style={[styles.cashFlowRow, styles.subtotalRow]}>
                          <Text style={[styles.cashFlowSubtotalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                            Net Cash from Financing
                          </Text>
                          <Text style={[styles.cashFlowSubtotalValue, { color: cashFlowData.financingCashFlow >= 0 ? '#059669' : '#dc2626' }]}>
                            ${cashFlowData.financingCashFlow.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Net Cash Flow */}
                      <View style={[styles.cashFlowRow, styles.totalRow]}>
                        <Text style={[styles.totalLabel, { color: isDark ? '#f9fafb' : '#111827' }]}>
                          Net Change in Cash:
                        </Text>
                        <Text style={[styles.totalValue, { color: cashFlowData.netCashFlow >= 0 ? '#059669' : '#dc2626' }]}>
                          ${cashFlowData.netCashFlow.toFixed(2)}
                        </Text>
                      </View>
                      
                      <TouchableOpacity
                        style={[styles.exportStatementButton, { backgroundColor: isDark ? '#4b5563' : '#e5e7eb' }]}
                        onPress={handleExportCashFlow}
                      >
                        <FileText size={16} color="#2563eb" />
                        <Text style={styles.exportStatementText}>
                          Export Cash Flow Statement
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.noCashFlowData}>
                      <Text style={[styles.noCashFlowText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                        No cash flow data available for this period
                      </Text>
                    </View>
                  )}
                </Card>
              </View>
            )}
          </>
        )}
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
  headerRight: {
    width: 40,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  dateFilterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateFilterText: {
    fontSize: 14,
    marginHorizontal: 8,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  exportButtonText: {
    fontSize: 14,
    marginLeft: 8,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  dateFilterModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dateFilterModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  dateFilterOptions: {
    gap: 8,
  },
  dateFilterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  summaryCard: {
    width: '48%',
    padding: 12,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    marginLeft: 8,
    flex: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  sectionNav: {
    marginBottom: 16,
  },
  sectionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  activeSectionButton: {
    backgroundColor: '#2563eb',
  },
  sectionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  activeSectionButtonText: {
    color: '#ffffff',
  },
  chartSection: {
    marginBottom: 20,
  },
  chartCard: {
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  detailsCard: {
    padding: 16,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailsLabel: {
    fontSize: 14,
  },
  detailsValue: {
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
  exportStatementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  exportStatementText: {
    fontSize: 14,
    color: '#2563eb',
    marginLeft: 8,
  },
  cashFlowCard: {
    padding: 16,
    marginBottom: 16,
  },
  cashFlowHeader: {
    marginBottom: 16,
  },
  cashFlowTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  cashFlowPeriod: {
    fontSize: 14,
  },
  cashFlowSection: {
    marginBottom: 16,
  },
  cashFlowSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cashFlowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cashFlowLabel: {
    fontSize: 14,
  },
  cashFlowValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  subtotalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
  },
  cashFlowSubtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cashFlowSubtotalValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  noCashFlowData: {
    padding: 20,
    alignItems: 'center',
  },
  noCashFlowText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
});