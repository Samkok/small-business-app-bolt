import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  TextInput
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';
import { SkeletonExpenseCard, SkeletonCard, SkeletonLoader, SkeletonList } from '@/src/components/ui/SkeletonLoader';
import { ExpenseCard } from '@/src/components/expenses/ExpenseCard';
import ExpenseForm from '@/src/components/expenses/ExpenseForm';
import CategoryForm from '@/src/components/expenses/CategoryForm';
import { Receipt, Plus, Search, Filter, DollarSign, TrendingDown, Calendar, Tag, ChartBar as BarChart3 } from 'lucide-react-native';
import { expenseService } from '@/src/services/expenses';

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { profile } = useAuth();

  const periodFilters = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterExpenses();
  }, [expenses, searchQuery, selectedCategory, selectedPeriod]);

  const loadData = async (isRefresh = false) => {
    if (!profile?.id) return;
    
    if (!isRefresh) {
      setLoading(true);
    }
    
    try {
      const [expensesData, categoriesData] = await Promise.all([
        expenseService.getExpenses(profile.id),
        expenseService.getCategories(profile.id)
      ]);
      
      setExpenses(expensesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(t('common.error'), 'Failed to load expenses');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const filterExpenses = () => {
    let filtered = expenses;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(expense =>
        expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.expense_categories?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.amount.toString().includes(searchQuery)
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(expense => expense.category_id === selectedCategory);
    }

    // Filter by period
    if (selectedPeriod !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(expense => {
        const expenseDate = new Date(expense.expense_date);
        
        switch (selectedPeriod) {
          case 'today':
            return expenseDate >= today;
          case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return expenseDate >= weekStart;
          case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return expenseDate >= monthStart;
          case 'year':
            const yearStart = new Date(now.getFullYear(), 0, 1);
            return expenseDate >= yearStart;
          default:
            return true;
        }
      });
    }

    setFilteredExpenses(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
  };

  const handleExpenseSave = () => {
    setShowExpenseForm(false);
    setSelectedExpense(null);
    loadData();
  };

  const handleCategorySave = () => {
    setShowCategoryForm(false);
    loadData();
  };

  const handleEditExpense = (expense: any) => {
    setSelectedExpense(expense);
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = (expense: any) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete this expense of $${expense.amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await expenseService.deleteExpense(expense.id);
              Alert.alert('Success', 'Expense deleted successfully');
              loadData();
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'Failed to delete expense');
            }
          }
        },
      ]
    );
  };

  const getExpenseStats = () => {
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const expenseCount = filteredExpenses.length;
    const averageExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;
    
    // Today's expenses
    const today = new Date().toISOString().split('T')[0];
    const todayExpenses = filteredExpenses.filter(expense => 
      expense.expense_date.split('T')[0] === today
    );
    const todayTotal = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    filteredExpenses.forEach(expense => {
      const categoryName = expense.expense_categories?.name || 'Uncategorized';
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
    });

    const topCategories = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([name, total]) => ({ name, total }));

    return { totalExpenses, expenseCount, averageExpense, todayTotal, topCategories };
  };

  const SkeletonStatsGrid = () => (
    <View style={styles.statsGrid}>
      {[1, 2, 3, 4].map((index) => (
        <SkeletonCard key={index} style={styles.statsCard}>
          <View style={styles.statsContent}>
            <SkeletonLoader height={20} width={20} borderRadius={10} />
            <View style={styles.statsText}>
              <SkeletonLoader height={16} width="60%" style={{ marginBottom: 4 }} />
              <SkeletonLoader height={11} width="80%" />
            </View>
          </View>
        </SkeletonCard>
      ))}
    </View>
  );

  const SkeletonCategoriesCard = () => (
    <SkeletonCard style={styles.categoriesCard}>
      <SkeletonLoader height={16} width="60%" style={{ marginBottom: 12 }} />
      <View style={styles.categoriesGrid}>
        {[1, 2, 3].map((index) => (
          <View key={index} style={styles.categoryItem}>
            <SkeletonLoader height={12} width="80%" style={{ marginBottom: 4 }} />
            <SkeletonLoader height={14} width="50%" />
          </View>
        ))}
      </View>
    </SkeletonCard>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
            {t('expenses.title')}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowCategoryForm(true)}
            >
              <Tag size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { marginLeft: 8 }]}
              onPress={() => setShowExpenseForm(true)}
            >
              <Plus size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search and Filter Skeleton */}
        <View style={styles.searchSection}>
          <SkeletonLoader height={48} borderRadius={8} style={{ marginBottom: 12 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
            {categories.length > 0 ? 
              categories.map((category) => (
                <SkeletonLoader 
                  key={category.id}
                  height={36} 
                  width={100} 
                  borderRadius={8} 
                  style={{ marginRight: 8 }} 
                />
              )) : 
              Array.from({ length: 5 }).map((_, index) => (
                <SkeletonLoader 
                  key={index}
                  height={36} 
                  width={100} 
                  borderRadius={8} 
                  style={{ marginRight: 8 }} 
                />
              ))
            }
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
            {periodFilters.map((filter, index) => (
              <SkeletonLoader 
                key={index}
                height={36} 
                width={80} 
                borderRadius={8} 
                style={{ marginRight: 8 }} 
              />
            ))}
          </ScrollView>
        </View>

        <SkeletonStatsGrid />
        <SkeletonCategoriesCard />
        <SkeletonList itemComponent={SkeletonExpenseCard} itemCount={5} style={styles.expensesList} />
      </View>
    );
  }

  const { totalExpenses, expenseCount, averageExpense, todayTotal, topCategories } = getExpenseStats();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#f9fafb' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}>
          {t('expenses.title')}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCategoryForm(true)}
          >
            <Tag size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { marginLeft: 8 }]}
            onPress={() => setShowExpenseForm(true)}
          >
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: isDark ? '#374151' : '#ffffff' }]}>
          <Search size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#f9fafb' : '#111827' }]}
            placeholder="Search expenses..."
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.filterButton,
                {
                  backgroundColor: selectedCategory === category.id 
                    ? '#2563eb' 
                    : (isDark ? '#374151' : '#f3f4f6'),
                  borderColor: selectedCategory === category.id 
                    ? '#2563eb' 
                    : (isDark ? '#4b5563' : '#d1d5db'),
                }
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text style={[
                styles.filterButtonText,
                { 
                  color: selectedCategory === category.id 
                    ? '#ffffff' 
                    : (isDark ? '#f9fafb' : '#374151') 
                }
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: selectedCategory === 'all' 
                  ? '#2563eb' 
                  : (isDark ? '#374151' : '#f3f4f6'),
                borderColor: selectedCategory === 'all' 
                  ? '#2563eb' 
                  : (isDark ? '#4b5563' : '#d1d5db'),
              }
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[
              styles.filterButtonText,
              { 
                color: selectedCategory === 'all' 
                  ? '#ffffff' 
                  : (isDark ? '#f9fafb' : '#374151') 
              }
            ]}>
              All Categories
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {periodFilters.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterButton,
                {
                  backgroundColor: selectedPeriod === filter.value 
                    ? '#059669' 
                    : (isDark ? '#374151' : '#f3f4f6'),
                  borderColor: selectedPeriod === filter.value 
                    ? '#059669' 
                    : (isDark ? '#4b5563' : '#d1d5db'),
                }
              ]}
              onPress={() => setSelectedPeriod(filter.value)}
            >
              <Text style={[
                styles.filterButtonText,
                { 
                  color: selectedPeriod === filter.value 
                    ? '#ffffff' 
                    : (isDark ? '#f9fafb' : '#374151') 
                }
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <DollarSign size={20} color="#dc2626" />
            <View style={styles.statsText}>
              <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
                ${todayTotal.toFixed(2)}
              </Text>
              <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Today's Expenses
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <TrendingDown size={20} color="#ea580c" />
            <View style={styles.statsText}>
              <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
                ${totalExpenses.toFixed(2)}
              </Text>
              <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total Expenses
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <Receipt size={20} color="#8b5cf6" />
            <View style={styles.statsText}>
              <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]}>
                {expenseCount}
              </Text>
              <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Total Records
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.statsCard}>
          <View style={styles.statsContent}>
            <BarChart3 size={20} color="#06b6d4" />
            <View style={styles.statsText}>
              <Text style={[styles.statsValue, { color: isDark ? '#f9fafb' : '#111827' }]} numberOfLines={1} adjustsFontSizeToFit>
                ${averageExpense.toFixed(2)}
              </Text>
              <Text style={[styles.statsLabel, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                Average Expense
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Top Categories */}
      {topCategories.length > 0 && (
        <Card style={styles.categoriesCard}>
          <Text style={[styles.categoriesTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
            Top Expense Categories
          </Text>
          <View style={styles.categoriesGrid}>
            {topCategories.map((category, index) => (
              <View key={index} style={styles.categoryItem}>
                <Text style={[styles.categoryName, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
                  {category.name}
                </Text>
                <Text style={[styles.categoryAmount, { color: '#dc2626' }]}>
                  ${category.total.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Expenses List */}
      <ScrollView
        style={styles.expensesList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
            title="Pull to refresh"
            titleColor={isDark ? '#f9fafb' : '#111827'}
          />
        }
      >
        {filteredExpenses.length > 0 ? (
          filteredExpenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onEdit={handleEditExpense}
              onDelete={handleDeleteExpense}
            />
          ))
        ) : (
          <Card style={styles.emptyState}>
            <Receipt size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text style={[styles.emptyTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>
              {searchQuery || selectedCategory !== 'all' || selectedPeriod !== 'all' 
                ? 'No expenses found' 
                : 'No expenses yet'
              }
            </Text>
            <Text style={[styles.emptyText, { color: isDark ? '#d1d5db' : '#6b7280' }]}>
              {searchQuery || selectedCategory !== 'all' || selectedPeriod !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Add your first expense to start tracking'
              }
            </Text>
            {!searchQuery && selectedCategory === 'all' && selectedPeriod === 'all' && (
              <View style={styles.emptyActions}>
                <Button
                  title="Add Category"
                  variant="outline"
                  onPress={() => setShowCategoryForm(true)}
                  style={styles.emptyButton}
                />
                <Button
                  title="Add Expense"
                  onPress={() => setShowExpenseForm(true)}
                  style={styles.emptyButton}
                />
              </View>
            )}
          </Card>
        )}
      </ScrollView>

      <Modal
        visible={showExpenseForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ExpenseForm
          expense={selectedExpense}
          categories={categories}
          onSave={handleExpenseSave}
          onCancel={() => {
            setShowExpenseForm(false);
            setSelectedExpense(null);
          }}
        />
      </Modal>

      <Modal
        visible={showCategoryForm}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <CategoryForm
          onSave={handleCategorySave}
          onCancel={() => setShowCategoryForm(false)}
        />
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
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
  },
  addButton: {
    backgroundColor: '#2563eb',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filterContainer: {
    marginBottom: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  statsCard: {
    width: '48%',
    padding: 12,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    marginLeft: 8,
    flex: 1,
  },
  statsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  statsLabel: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  categoriesCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  categoriesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryItem: {
    alignItems: 'center',
    minWidth: 100,
  },
  categoryName: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  expensesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyButton: {
    marginTop: 16,
    minWidth: 120,
  },
});