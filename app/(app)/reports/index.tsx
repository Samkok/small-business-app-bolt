import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { ArrowLeft, Calendar, DollarSign, TrendingUp, TrendingDown, ChartBar as BarChart, PieChart, FileText } from 'lucide-react-native';
import { LineChart, PieChart as PieChartKit } from 'react-native-chart-kit';
import { reportsService } from '@/src/services/reports';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'cash-flow'>('overview');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [revenueData, setRevenueData] = useState<any>(null);
  const [expensesData, setExpensesData] = useState<any>(null);
  const [profitData, setProfitData] = useState<any>(null);
  const [expenseCategoriesData, setExpenseCategoriesData] = useState<any>(null);
  
  const router = useRouter();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.id) {
      loadReportData();
    } else {
      setLoading(false);
    }
  }, [profile?.id, dateRange]);

  const getDateRange = () => {
    const endDate = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'week':
        startDate = subDays(endDate, 7);
        break;
      case 'month':
        startDate = subDays(endDate, 30);
        break;
      case 'quarter':
        startDate = subDays(endDate, 90);
        break;
      case 'year':
        startDate = subDays(endDate, 365);
        break;
      default:
        startDate = subDays(endDate, 30);
    }
    
    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    };
  };

  const loadReportData = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      
      // Load revenue data
      const revenueChartData = await reportsService.getRevenueChart(profile.id, startDate, endDate);
      setRevenueData(revenueChartData);
      
      // Load expenses data
      const expensesChartData = await reportsService.getExpenseChart(profile.id, startDate, endDate);
      setExpensesData(expensesChartData);
      
      // Load profit data
      const profitChartData = await reportsService.getProfitChart(profile.id, startDate, endDate);
      setProfitData(profitChartData);
      
      // Load expense categories data
      const expenseCategoriesChartData = await reportsService.getExpensesByCategory(profile.id, startDate, endDate);
      setExpenseCategoriesData(expenseCategoriesChartData);
    } catch (error) {
      console.error('Error loading report data:', error);
      Alert.alert('Error', 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewIncomeStatement = () => {
    const { startDate, endDate } = getDateRange();
    router.push(`/reports/income-statement?startDate=${startDate}&endDate=${endDate}`);
  };

  const handleViewCashFlow = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    router.push(`/reports/cash-flow?month=${month}&year=${year}`);
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

  const DateRangeButton = ({ 
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
        styles.dateRangeButton,
        {
          backgroundColor: isActive 
            ? '#059669' 
            : (isDark ? '#374151' : '#f3f4f6'),
          borderColor: isActive ? '#059669' : (isDark ? '#4b5563' : '#d1d5db'),
        }
      ]}
      onPress={onPress}
    >
      <Text style={[
        styles.dateRangeButtonText,
        { color: isActive ? '#ffffff' : (isDark ? '#f9fafb' : '#374151') }
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderOverviewTab = () => {
    if (!revenueData || !expensesData || !profitData || !expenseCategoriesData) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={[styles.noDataText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            No data available for the selected period
          </Text>
        </View>
      );
    }

    // Prepare data for revenue chart
    const revenueChartData = {
      labels: revenueData.map((item: any) => item.label),
      datasets: [
        {
          data: revenueData.map((item: any) => item.revenue),
          color: () => '#059669',
          strokeWidth: 2
        }
      ]
    };

    // Prepare data for expenses chart
    const expensesChartData = {
      labels: expensesData.map((item: any) => item.label),
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
      labels: profitData.map((item: any) => item.label),
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
        amount: item.amount,
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
    if (!profitData) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={[styles.noDataText, { color: isDark ? '#f9fafb' : '#111827' }]}>
            No data available for the selected period
          </Text>
        </View>
      );
    }

    // Calculate totals
    const totalRevenue = profitData.reduce((sum: number, item: any) => sum + item.revenue, 0);
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
                labels: profitData.map((item: any) => item.label),
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
                labels: profitData.map((item: any) => item.label),
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
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get previous months
    const months = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(currentYear, currentMonth - i, 1);
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

  if (loading) {
    return <LoadingSpinner text="Loading reports..." />;
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
        <View style={styles.headerRight} />
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

      {/* Date Range Selector (only for Overview and Income tabs) */}
      {activeTab !== 'cash-flow' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRangeSelector}>
          <DateRangeButton
            title="7 Days"
            isActive={dateRange === 'week'}
            onPress={() => setDateRange('week')}
          />
          <DateRangeButton
            title="30 Days"
            isActive={dateRange === 'month'}
            onPress={() => setDateRange('month')}
          />
          <DateRangeButton
            title="90 Days"
            isActive={dateRange === 'quarter'}
            onPress={() => setDateRange('quarter')}
          />
          <DateRangeButton
            title="1 Year"
            isActive={dateRange === 'year'}
            onPress={() => setDateRange('year')}
          />
        </ScrollView>
      )}

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'income' && renderIncomeTab()}
        {activeTab === 'cash-flow' && renderCashFlowTab()}
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
  dateRangeSelector: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dateRangeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  dateRangeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tabContent: {
    paddingBottom: 20,
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
});