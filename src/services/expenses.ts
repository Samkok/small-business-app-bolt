import { supabase } from '../config/supabase';
import { Database } from '../types/database';

type Expense = Database['public']['Tables']['expenses']['Row'];
type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];
type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row'];
type ExpenseCategoryInsert = Database['public']['Tables']['expense_categories']['Insert'];

export const expenseService = {
  async getCategories(businessId: string) {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('business_id', businessId)
      .order('name');

    if (error) throw error;
    return data;
  },

  async createCategory(category: ExpenseCategoryInsert) {
    const { data, error } = await supabase
      .from('expense_categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getExpenses(businessId: string, limit?: number) {
    let query = supabase
      .from('expenses')
      .select(`
        *,
        expense_categories(name),
        profiles!expenses_created_by_fkey(full_name)
      `)
      .eq('business_id', businessId)
      .order('expense_date', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createExpense(expense: ExpenseInsert) {
    const { data, error } = await supabase
      .from('expenses')
      .insert(expense)
      .select(`
        *,
        expense_categories(name),
        profiles!expenses_created_by_fkey(full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async updateExpense(id: string, updates: ExpenseUpdate) {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        expense_categories(name),
        profiles!expenses_created_by_fkey(full_name)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteExpense(id: string) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getExpenseReport(businessId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        expense_categories(name)
      `)
      .eq('business_id', businessId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date');

    if (error) throw error;
    return data;
  },

  async getExpensesByCategory(businessId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        amount,
        expense_categories(description)
      `)
      .eq('business_id', businessId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    if (error) throw error;

    // Group by category
    const categoryTotals: Record<string, number> = {};
    data.forEach(expense => {
      const categoryName = expense.expense_categories?.name || 'Uncategorized';
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
    });

    return Object.entries(categoryTotals).map(([name, total]) => ({
      category: name,
      total
    }));
  }
};