export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          owner_user_id: string;
          business_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          business_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_user_id?: string;
          business_name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          user_id: string;
          full_name: string;
          phone?: string;
          address?: string;
          avatar_url?: string;
          email?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          full_name: string;
          phone?: string;
          address?: string;
          avatar_url?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          full_name?: string;
          phone?: string;
          address?: string;
          avatar_url?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_business_roles: {
        Row: {
          user_id: string;
          business_id: string;
          role: 'admin' | 'staff';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          business_id: string;
          role?: 'admin' | 'staff';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          business_id?: string;
          role?: 'admin' | 'staff';
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          price: number;
          description?: string;
          image_url?: string;
          barcode?: string;
          current_stock: number;
          min_stock_level: number;
          cost_per_unit: number;
          business_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          price: number;
          description?: string;
          image_url?: string;
          barcode?: string;
          current_stock?: number;
          min_stock_level?: number;
          cost_per_unit?: number;
          business_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          price?: number;
          description?: string;
          image_url?: string;
          barcode?: string;
          current_stock?: number;
          min_stock_level?: number;
          cost_per_unit?: number;
          business_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_history: {
        Row: {
          id: string;
          product_id: string;
          changed_by_user_id: string;
          business_id: string;
          change_date: string;
          field_name: string;
          old_value?: string;
          new_value?: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          changed_by_user_id: string;
          business_id: string;
          change_date?: string;
          field_name: string;
          old_value?: string;
          new_value?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          changed_by_user_id?: string;
          business_id?: string;
          change_date?: string;
          field_name?: string;
          old_value?: string;
          new_value?: string;
        };
      };
      inventory_imports: {
        Row: {
          id: string;
          product_id: string;
          quantity: number;
          base_unit_cost: number;
          final_unit_cost: number;
          total_cost: number;
          notes?: string;
          business_id: string;
          imported_by: string;
          created_at: string;
          purchase_date: string;
          arrival_date?: string;
          status: 'pending' | 'completed';
        };
        Insert: {
          id?: string;
          product_id: string;
          quantity: number;
          base_unit_cost: number;
          final_unit_cost: number;
          total_cost: number;
          notes?: string;
          business_id: string;
          imported_by: string;
          created_at?: string;
          purchase_date?: string;
          arrival_date?: string;
          status?: 'pending' | 'completed';
        };
        Update: {
          id?: string;
          product_id?: string;
          quantity?: number;
          base_unit_cost?: number;
          final_unit_cost?: number;
          total_cost?: number;
          notes?: string;
          business_id?: string;
          imported_by?: string;
          created_at?: string;
          purchase_date?: string;
          arrival_date?: string;
          status?: 'pending' | 'completed';
        };
      };
      import_costs: {
        Row: {
          id: string;
          import_id: string;
          cost_type: string;
          amount: number;
          calculation_type: 'per_unit' | 'per_total';
          description?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_id: string;
          cost_type: string;
          amount: number;
          calculation_type: 'per_unit' | 'per_total';
          description?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          import_id?: string;
          cost_type?: string;
          amount?: number;
          calculation_type?: 'per_unit' | 'per_total';
          description?: string;
          created_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          name: string;
          phone?: string;
          address?: string;
          platform?: 'facebook' | 'instagram' | 'telegram' | 'walk_in' | 'other';
          notes?: string;
          business_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string;
          address?: string;
          platform?: 'facebook' | 'instagram' | 'telegram' | 'walk_in' | 'other';
          notes?: string;
          business_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          address?: string;
          platform?: 'facebook' | 'instagram' | 'telegram' | 'walk_in' | 'other';
          notes?: string;
          business_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      carts: {
        Row: {
          id: string;
          customer_id: string;
          status: 'active' | 'completed' | 'abandoned';
          total_amount: number;
          discount_type?: 'percentage' | 'fixed';
          discount_value?: number;
          delivery_cost?: number;
          notes?: string;
          business_id: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          status?: 'active' | 'completed' | 'abandoned';
          total_amount?: number;
          discount_type?: 'percentage' | 'fixed';
          discount_value?: number;
          delivery_cost?: number;
          notes?: string;
          business_id: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          status?: 'active' | 'completed' | 'abandoned';
          total_amount?: number;
          discount_type?: 'percentage' | 'fixed';
          discount_value?: number;
          delivery_cost?: number;
          notes?: string;
          business_id?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          discount_type?: 'percentage' | 'fixed';
          discount_value?: number;
          subtotal: number;
          item_discount_type?: 'percentage' | 'fixed';
          item_discount_value?: number;
          item_discount_amount?: number;
          original_subtotal?: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          discount_type?: 'percentage' | 'fixed';
          discount_value?: number;
          subtotal: number;
          item_discount_type?: 'percentage' | 'fixed';
          item_discount_value?: number;
          item_discount_amount?: number;
          original_subtotal?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          discount_type?: 'percentage' | 'fixed';
          discount_value?: number;
          subtotal?: number;
          item_discount_type?: 'percentage' | 'fixed';
          item_discount_value?: number;
          item_discount_amount?: number;
          original_subtotal?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          cart_id: string;
          customer_id: string;
          total_amount: number;
          payment_method: 'cash' | 'card' | 'transfer' | 'other';
          status: 'completed' | 'voided' | 'refunded' | 'partially_returned';
          sale_date: string;
          notes?: string;
          business_id: string;
          created_by: string;
          created_at: string;
          sale_discount_type?: 'percentage' | 'fixed';
          sale_discount_value?: number;
          sale_discount_amount?: number;
          subtotal_before_discount?: number;
        };
        Insert: {
          id?: string;
          cart_id: string;
          customer_id: string;
          total_amount: number;
          payment_method: 'cash' | 'card' | 'transfer' | 'other';
          status?: 'completed' | 'voided' | 'refunded' | 'partially_returned';
          sale_date?: string;
          notes?: string;
          business_id: string;
          created_by: string;
          created_at?: string;
          sale_discount_type?: 'percentage' | 'fixed';
          sale_discount_value?: number;
          sale_discount_amount?: number;
          subtotal_before_discount?: number;
        };
        Update: {
          id?: string;
          cart_id?: string;
          customer_id?: string;
          total_amount?: number;
          payment_method?: 'cash' | 'card' | 'transfer' | 'other';
          status?: 'completed' | 'voided' | 'refunded' | 'partially_returned';
          sale_date?: string;
          notes?: string;
          business_id?: string;
          created_by?: string;
          created_at?: string;
          sale_discount_type?: 'percentage' | 'fixed';
          sale_discount_value?: number;
          sale_discount_amount?: number;
          subtotal_before_discount?: number;
        };
      };
      sale_actions: {
        Row: {
          id: string;
          sale_id: string;
          action_type: 'void' | 'refund' | 'return';
          amount?: number;
          reason: string;
          notes?: string;
          performed_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          action_type: 'void' | 'refund' | 'return';
          amount?: number;
          reason: string;
          notes?: string;
          performed_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          action_type?: 'void' | 'refund' | 'return';
          amount?: number;
          reason?: string;
          notes?: string;
          performed_by?: string;
          created_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          category_id: string;
          amount: number;
          description: string;
          expense_date: string;
          notes?: string;
          business_id: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          amount: number;
          description: string;
          expense_date?: string;
          notes?: string;
          business_id: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          amount?: number;
          description?: string;
          expense_date?: string;
          notes?: string;
          business_id?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
          description?: string;
          business_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          business_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          business_id?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_business: {
        Args: {
          business_name_param: string;
          owner_user_id_param?: string;
        };
        Returns: string;
      };
      invite_user_to_business: {
        Args: {
          business_id_param: string;
          user_email_param: string;
          role_param?: string;
        };
        Returns: boolean;
      };
      change_user_business_role: {
        Args: {
          business_id_param: string;
          user_id_param: string;
          new_role_param: string;
        };
        Returns: boolean;
      };
      remove_user_from_business: {
        Args: {
          business_id_param: string;
          user_id_param: string;
        };
        Returns: boolean;
      };
      user_has_business_access: {
        Args: {
          user_uid: string;
          business_id_param: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}