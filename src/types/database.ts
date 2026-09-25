export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      business_receipt_counters: {
        Row: {
          business_id: string
          last_number: number
          updated_at: string
        }
        Insert: {
          business_id: string
          last_number?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          last_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_receipt_counters_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          access_state: string | null
          archived_at: string | null
          business_image_url: string | null
          business_name: string
          created_at: string | null
          id: string
          menu_enabled: boolean
          menu_note: string | null
          menu_slug: string | null
          menu_telegram: string | null
          owner_user_id: string
          receipt_address: string | null
          receipt_footer: string | null
          receipt_page_name: string | null
          receipt_payment_note: string | null
          receipt_payment_qr_url: string | null
          receipt_phone: string | null
          updated_at: string | null
        }
        Insert: {
          access_state?: string | null
          archived_at?: string | null
          business_image_url?: string | null
          business_name: string
          created_at?: string | null
          id?: string
          menu_enabled?: boolean
          menu_note?: string | null
          menu_slug?: string | null
          menu_telegram?: string | null
          owner_user_id: string
          receipt_address?: string | null
          receipt_footer?: string | null
          receipt_page_name?: string | null
          receipt_payment_note?: string | null
          receipt_payment_qr_url?: string | null
          receipt_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          access_state?: string | null
          archived_at?: string | null
          business_image_url?: string | null
          business_name?: string
          created_at?: string | null
          id?: string
          menu_enabled?: boolean
          menu_note?: string | null
          menu_slug?: string | null
          menu_telegram?: string | null
          owner_user_id?: string
          receipt_address?: string | null
          receipt_footer?: string | null
          receipt_page_name?: string | null
          receipt_payment_note?: string | null
          receipt_payment_qr_url?: string | null
          receipt_phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          cost_per_unit: number | null
          created_at: string | null
          currency_id: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          item_discount_amount: number | null
          item_discount_scope: string | null
          item_discount_type: string | null
          item_discount_value: number | null
          original_subtotal: number | null
          product_id: string
          quantity: number
          subtotal: number
          unit_id: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          cart_id: string
          cost_per_unit?: number | null
          created_at?: string | null
          currency_id?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          item_discount_amount?: number | null
          item_discount_scope?: string | null
          item_discount_type?: string | null
          item_discount_value?: number | null
          original_subtotal?: number | null
          product_id: string
          quantity?: number
          subtotal?: number
          unit_id?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          cart_id?: string
          cost_per_unit?: number | null
          created_at?: string | null
          currency_id?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          item_discount_amount?: number | null
          item_discount_scope?: string | null
          item_discount_type?: string | null
          item_discount_value?: number | null
          original_subtotal?: number | null
          product_id?: string
          quantity?: number
          subtotal?: number
          unit_id?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart_details_with_discounts"
            referencedColumns: ["cart_id"]
          },
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          business_id: string
          created_at: string | null
          created_by: string | null
          created_by_business_id: string | null
          created_by_name: string | null
          customer_id: string
          delivery_charge: number | null
          delivery_cost: number | null
          discount_type: string | null
          discount_value: number | null
          id: string
          notes: string | null
          order_ref: string | null
          payment_method: string | null
          payment_status: string | null
          source: string
          status: string | null
          total_amount: number | null
          updated_at: string | null
          web_order_token: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          created_by?: string | null
          created_by_business_id?: string | null
          created_by_name?: string | null
          customer_id: string
          delivery_charge?: number | null
          delivery_cost?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          order_ref?: string | null
          payment_method?: string | null
          payment_status?: string | null
          source?: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          web_order_token?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          created_by?: string | null
          created_by_business_id?: string | null
          created_by_name?: string | null
          customer_id?: string
          delivery_charge?: number | null
          delivery_cost?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          order_ref?: string | null
          payment_method?: string | null
          payment_status?: string | null
          source?: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          web_order_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          expires_at: string | null
          id: string
          is_expired: boolean
          metadata: Json | null
          reference_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description: string
          expires_at?: string | null
          id?: string
          is_expired?: boolean
          metadata?: Json | null
          reference_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          is_expired?: boolean
          metadata?: Json | null
          reference_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          business_id: string
          code: string
          created_at: string | null
          exchange_rate_to_usd: number
          id: string
          is_default: boolean
          name: string
          symbol: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          code: string
          created_at?: string | null
          exchange_rate_to_usd?: number
          id?: string
          is_default?: boolean
          name: string
          symbol: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          code?: string
          created_at?: string | null
          exchange_rate_to_usd?: number
          id?: string
          is_default?: boolean
          name?: string
          symbol?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "currencies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          business_id: string
          created_at: string | null
          id: string
          is_quick: boolean | null
          is_system_customer: boolean
          name: string
          notes: string | null
          phone: string | null
          platform: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string | null
          id?: string
          is_quick?: boolean | null
          is_system_customer?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          platform?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string | null
          id?: string
          is_quick?: boolean | null
          is_system_customer?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          platform?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          business_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category_id: string
          created_at: string | null
          created_by: string | null
          created_by_business_id: string | null
          created_by_name: string | null
          currency_id: string | null
          description: string
          expense_date: string | null
          id: string
          notes: string | null
        }
        Insert: {
          amount?: number
          business_id: string
          category_id: string
          created_at?: string | null
          created_by?: string | null
          created_by_business_id?: string | null
          created_by_name?: string | null
          currency_id?: string | null
          description: string
          expense_date?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          category_id?: string
          created_at?: string | null
          created_by?: string | null
          created_by_business_id?: string | null
          created_by_name?: string | null
          currency_id?: string | null
          description?: string
          expense_date?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      import_costs: {
        Row: {
          amount: number
          batch_id: string | null
          calculation_type: string
          cost_type: string
          created_at: string | null
          description: string | null
          id: string
        }
        Insert: {
          amount?: number
          batch_id?: string | null
          calculation_type: string
          cost_type: string
          created_at?: string | null
          description?: string | null
          id?: string
        }
        Update: {
          amount?: number
          batch_id?: string | null
          calculation_type?: string
          cost_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_import_costs_batch"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          arrival_date: string | null
          business_id: string
          created_at: string
          id: string
          imported_by: string | null
          imported_by_business_id: string | null
          imported_by_name: string | null
          notes: string | null
          purchase_date: string
          status: string
          total_batch_cost: number
          updated_at: string
        }
        Insert: {
          arrival_date?: string | null
          business_id: string
          created_at?: string
          id?: string
          imported_by?: string | null
          imported_by_business_id?: string | null
          imported_by_name?: string | null
          notes?: string | null
          purchase_date?: string
          status?: string
          total_batch_cost?: number
          updated_at?: string
        }
        Update: {
          arrival_date?: string | null
          business_id?: string
          created_at?: string
          id?: string
          imported_by?: string | null
          imported_by_business_id?: string | null
          imported_by_name?: string | null
          notes?: string | null
          purchase_date?: string
          status?: string
          total_batch_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      inventory_imports: {
        Row: {
          arrival_date: string | null
          base_unit_cost_per_item: number
          batch_id: string | null
          business_id: string
          created_at: string | null
          final_unit_cost_per_item: number
          id: string
          imported_by: string | null
          imported_by_business_id: string | null
          imported_by_name: string | null
          notes: string | null
          product_id: string
          purchase_date: string | null
          quantity: number
          status: string | null
          total_cost_for_item: number
          unit_id: string | null
        }
        Insert: {
          arrival_date?: string | null
          base_unit_cost_per_item?: number
          batch_id?: string | null
          business_id: string
          created_at?: string | null
          final_unit_cost_per_item?: number
          id?: string
          imported_by?: string | null
          imported_by_business_id?: string | null
          imported_by_name?: string | null
          notes?: string | null
          product_id: string
          purchase_date?: string | null
          quantity?: number
          status?: string | null
          total_cost_for_item?: number
          unit_id?: string | null
        }
        Update: {
          arrival_date?: string | null
          base_unit_cost_per_item?: number
          batch_id?: string | null
          business_id?: string
          created_at?: string | null
          final_unit_cost_per_item?: number
          id?: string
          imported_by?: string | null
          imported_by_business_id?: string | null
          imported_by_name?: string | null
          notes?: string | null
          product_id?: string
          purchase_date?: string | null
          quantity?: number
          status?: string | null
          total_cost_for_item?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_imports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_imports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "inventory_imports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_imports_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          role_assigned_enabled: boolean | null
          sales_created_enabled: boolean | null
          sales_voided_enabled: boolean | null
          updated_at: string | null
          user_id: string
          web_orders_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          role_assigned_enabled?: boolean | null
          sales_created_enabled?: boolean | null
          sales_voided_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
          web_orders_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          role_assigned_enabled?: boolean | null
          sales_created_enabled?: boolean | null
          sales_voided_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
          web_orders_enabled?: boolean | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          business_id: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_webhook_events: {
        Row: {
          app_user_id: string | null
          created_at: string
          event_id: string
          event_timestamp_ms: number
          event_type: string
          id: string
          metadata: Json | null
          processed_at: string
          processing_duration_ms: number | null
        }
        Insert: {
          app_user_id?: string | null
          created_at?: string
          event_id: string
          event_timestamp_ms: number
          event_type: string
          id?: string
          metadata?: Json | null
          processed_at?: string
          processing_duration_ms?: number | null
        }
        Update: {
          app_user_id?: string | null
          created_at?: string
          event_id?: string
          event_timestamp_ms?: number
          event_type?: string
          id?: string
          metadata?: Json | null
          processed_at?: string
          processing_duration_ms?: number | null
        }
        Relationships: []
      }
      product_history: {
        Row: {
          business_id: string
          change_date: string
          changed_by_user_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          product_id: string
        }
        Insert: {
          business_id: string
          change_date?: string
          changed_by_user_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          product_id: string
        }
        Update: {
          business_id?: string
          change_date?: string
          changed_by_user_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "product_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_insight_settings: {
        Row: {
          business_id: string
          created_at: string
          custom_end_date: string | null
          custom_start_date: string | null
          default_low_stock_level: number
          hot_selling_min_units_per_day: number
          id: string
          lead_time_days: number
          lookback_days: number
          overstock_days_threshold: number
          reorder_warning_days: number
          slow_selling_max_units_per_day: number
          updated_at: string
          use_custom_range: boolean
        }
        Insert: {
          business_id: string
          created_at?: string
          custom_end_date?: string | null
          custom_start_date?: string | null
          default_low_stock_level?: number
          hot_selling_min_units_per_day?: number
          id?: string
          lead_time_days?: number
          lookback_days?: number
          overstock_days_threshold?: number
          reorder_warning_days?: number
          slow_selling_max_units_per_day?: number
          updated_at?: string
          use_custom_range?: boolean
        }
        Update: {
          business_id?: string
          created_at?: string
          custom_end_date?: string | null
          custom_start_date?: string | null
          default_low_stock_level?: number
          hot_selling_min_units_per_day?: number
          id?: string
          lead_time_days?: number
          lookback_days?: number
          overstock_days_threshold?: number
          reorder_warning_days?: number
          slow_selling_max_units_per_day?: number
          updated_at?: string
          use_custom_range?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_insight_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_unit_prices: {
        Row: {
          barcode: string | null
          business_id: string
          cost_per_unit: number | null
          created_at: string | null
          currency_id: string | null
          id: string
          name: string | null
          price: number
          product_id: string
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          business_id: string
          cost_per_unit?: number | null
          created_at?: string | null
          currency_id?: string | null
          id?: string
          name?: string | null
          price?: number
          product_id: string
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          business_id?: string
          cost_per_unit?: number | null
          created_at?: string | null
          currency_id?: string | null
          id?: string
          name?: string | null
          price?: number
          product_id?: string
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_unit_prices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_unit_prices_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_unit_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_unit_prices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          archived_by_name: string | null
          barcode: string
          business_id: string
          cost_per_unit: number | null
          created_at: string | null
          currency_id: string | null
          current_stock: number | null
          description: string | null
          id: string
          image_url: string | null
          is_archived: boolean
          min_stock_level: number | null
          name: string
          price: number
          unit_group_id: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          archived_by_name?: string | null
          barcode: string
          business_id: string
          cost_per_unit?: number | null
          created_at?: string | null
          currency_id?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          min_stock_level?: number | null
          name: string
          price?: number
          unit_group_id?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          archived_by_name?: string | null
          barcode?: string
          business_id?: string
          cost_per_unit?: number | null
          created_at?: string | null
          currency_id?: string | null
          current_stock?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          min_stock_level?: number | null
          name?: string
          price?: number
          unit_group_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_group_id_fkey"
            columns: ["unit_group_id"]
            isOneToOne: false
            referencedRelation: "unit_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      push_token: {
        Row: {
          expo_push_token: string
        }
        Insert: {
          expo_push_token: string
        }
        Update: {
          expo_push_token?: string
        }
        Relationships: []
      }
      reconciliation_log: {
        Row: {
          corrections_made: number
          discrepancies_found: number
          error_message: string | null
          execution_duration_ms: number
          execution_time: string
          id: string
          metadata: Json | null
          status: string
          users_processed: number
        }
        Insert: {
          corrections_made?: number
          discrepancies_found?: number
          error_message?: string | null
          execution_duration_ms?: number
          execution_time?: string
          id?: string
          metadata?: Json | null
          status: string
          users_processed?: number
        }
        Update: {
          corrections_made?: number
          discrepancies_found?: number
          error_message?: string | null
          execution_duration_ms?: number
          execution_time?: string
          id?: string
          metadata?: Json | null
          status?: string
          users_processed?: number
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          total_clicks: number
          total_conversions: number
          total_signups: number
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          total_clicks?: number
          total_conversions?: number
          total_signups?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          total_clicks?: number
          total_conversions?: number
          total_signups?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          attribution_metadata: Json | null
          clicked_at: string
          created_at: string
          expires_at: string
          fraud_score: number
          id: string
          ip_address: unknown
          referee_device_fingerprint: string | null
          referee_user_id: string | null
          referral_code_id: string
          referrer_user_id: string
          rewarded_at: string | null
          signed_up_at: string | null
          status: string
          subscribed_at: string | null
          subscription_product_id: string | null
          subscription_tier: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          attribution_metadata?: Json | null
          clicked_at?: string
          created_at?: string
          expires_at?: string
          fraud_score?: number
          id?: string
          ip_address?: unknown
          referee_device_fingerprint?: string | null
          referee_user_id?: string | null
          referral_code_id: string
          referrer_user_id: string
          rewarded_at?: string | null
          signed_up_at?: string | null
          status?: string
          subscribed_at?: string | null
          subscription_product_id?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          attribution_metadata?: Json | null
          clicked_at?: string
          created_at?: string
          expires_at?: string
          fraud_score?: number
          id?: string
          ip_address?: unknown
          referee_device_fingerprint?: string | null
          referee_user_id?: string | null
          referral_code_id?: string
          referrer_user_id?: string
          rewarded_at?: string | null
          signed_up_at?: string | null
          status?: string
          subscribed_at?: string | null
          subscription_product_id?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_fraud_flags: {
        Row: {
          created_at: string
          details: Json | null
          flag_type: string
          id: string
          is_resolved: boolean
          referral_event_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          flag_type: string
          id?: string
          is_resolved?: boolean
          referral_event_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          flag_type?: string
          id?: string
          is_resolved?: boolean
          referral_event_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_fraud_flags_referral_event_id_fkey"
            columns: ["referral_event_id"]
            isOneToOne: false
            referencedRelation: "referral_events"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_reward_rules: {
        Row: {
          applies_to_tiers: string[] | null
          created_at: string
          credit_expiry_days: number | null
          id: string
          is_active: boolean
          max_rewards_per_referrer: number | null
          min_subscription_days: number
          referee_credits: number
          referrer_credits: number
          rule_name: string
          updated_at: string
        }
        Insert: {
          applies_to_tiers?: string[] | null
          created_at?: string
          credit_expiry_days?: number | null
          id?: string
          is_active?: boolean
          max_rewards_per_referrer?: number | null
          min_subscription_days?: number
          referee_credits?: number
          referrer_credits?: number
          rule_name: string
          updated_at?: string
        }
        Update: {
          applies_to_tiers?: string[] | null
          created_at?: string
          credit_expiry_days?: number | null
          id?: string
          is_active?: boolean
          max_rewards_per_referrer?: number | null
          min_subscription_days?: number
          referee_credits?: number
          referrer_credits?: number
          rule_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sale_actions: {
        Row: {
          action_type: string
          adjusted_amount: number | null
          amount: number | null
          created_at: string | null
          delivery_cost_amount: number | null
          delivery_cost_included: boolean | null
          id: string
          items_metadata: Json | null
          loss_amount: number | null
          loss_percentage: number | null
          loss_type: string | null
          notes: string | null
          performed_by: string | null
          performed_by_business_id: string | null
          performed_by_name: string | null
          reason: string
          sale_id: string
        }
        Insert: {
          action_type: string
          adjusted_amount?: number | null
          amount?: number | null
          created_at?: string | null
          delivery_cost_amount?: number | null
          delivery_cost_included?: boolean | null
          id?: string
          items_metadata?: Json | null
          loss_amount?: number | null
          loss_percentage?: number | null
          loss_type?: string | null
          notes?: string | null
          performed_by?: string | null
          performed_by_business_id?: string | null
          performed_by_name?: string | null
          reason: string
          sale_id: string
        }
        Update: {
          action_type?: string
          adjusted_amount?: number | null
          amount?: number | null
          created_at?: string | null
          delivery_cost_amount?: number | null
          delivery_cost_included?: boolean | null
          id?: string
          items_metadata?: Json | null
          loss_amount?: number | null
          loss_percentage?: number | null
          loss_type?: string | null
          notes?: string | null
          performed_by?: string | null
          performed_by_business_id?: string | null
          performed_by_name?: string | null
          reason?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_actions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sale_actions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_actions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_with_discount_details"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          business_id: string
          cart_id: string
          created_at: string | null
          created_by: string | null
          created_by_business_id: string | null
          created_by_name: string | null
          currency_id: string | null
          current_total_amount: number | null
          customer_id: string
          delivery_cost: number | null
          exchange_rate_at_sale: number | null
          id: string
          notes: string | null
          payment_method: string
          payment_status: string | null
          receipt_number: number | null
          returned_amount: number | null
          sale_date: string | null
          sale_discount_amount: number | null
          sale_discount_type: string | null
          sale_discount_value: number | null
          status: string | null
          subtotal_before_discount: number | null
          total_amount: number
        }
        Insert: {
          business_id: string
          cart_id: string
          created_at?: string | null
          created_by?: string | null
          created_by_business_id?: string | null
          created_by_name?: string | null
          currency_id?: string | null
          current_total_amount?: number | null
          customer_id: string
          delivery_cost?: number | null
          exchange_rate_at_sale?: number | null
          id?: string
          notes?: string | null
          payment_method: string
          payment_status?: string | null
          receipt_number?: number | null
          returned_amount?: number | null
          sale_date?: string | null
          sale_discount_amount?: number | null
          sale_discount_type?: string | null
          sale_discount_value?: number | null
          status?: string | null
          subtotal_before_discount?: number | null
          total_amount?: number
        }
        Update: {
          business_id?: string
          cart_id?: string
          created_at?: string | null
          created_by?: string | null
          created_by_business_id?: string | null
          created_by_name?: string | null
          currency_id?: string | null
          current_total_amount?: number | null
          customer_id?: string
          delivery_cost?: number | null
          exchange_rate_at_sale?: number | null
          id?: string
          notes?: string | null
          payment_method?: string
          payment_status?: string | null
          receipt_number?: number | null
          returned_amount?: number | null
          sale_date?: string | null
          sale_discount_amount?: number | null
          sale_discount_type?: string | null
          sale_discount_value?: number | null
          status?: string | null
          subtotal_before_discount?: number | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart_details_with_discounts"
            referencedColumns: ["cart_id"]
          },
          {
            foreignKeyName: "sales_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sales_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_changes: {
        Row: {
          action: string
          adjustment_id: string
          business_id: string
          changed_at: string
          changed_by: string | null
          changed_by_name: string | null
          id: string
          new_row: Json | null
          old_row: Json
          product_id: string
          stock_after: number
          stock_before: number
        }
        Insert: {
          action: string
          adjustment_id: string
          business_id: string
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          id?: string
          new_row?: Json | null
          old_row: Json
          product_id: string
          stock_after: number
          stock_before: number
        }
        Update: {
          action?: string
          adjustment_id?: string
          business_id?: string
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          id?: string
          new_row?: Json | null
          old_row?: Json
          product_id?: string
          stock_after?: number
          stock_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_changes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjusted_by: string | null
          adjusted_by_name: string | null
          adjustment_date: string
          business_id: string
          count_session_id: string | null
          created_at: string
          currency_id: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          quantity_entered: number
          reason: string
          stock_after: number
          stock_before: number
          total_cost: number
          unit_cost: number
          unit_id: string | null
        }
        Insert: {
          adjusted_by?: string | null
          adjusted_by_name?: string | null
          adjustment_date?: string
          business_id: string
          count_session_id?: string | null
          created_at?: string
          currency_id?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          quantity_entered: number
          reason: string
          stock_after: number
          stock_before: number
          total_cost?: number
          unit_cost?: number
          unit_id?: string | null
        }
        Update: {
          adjusted_by?: string | null
          adjusted_by_name?: string | null
          adjustment_date?: string
          business_id?: string
          count_session_id?: string | null
          created_at?: string
          currency_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          quantity_entered?: number
          reason?: string
          stock_after?: number
          stock_before?: number
          total_cost?: number
          unit_cost?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stock_adjustments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_groups: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_groups_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          barcode: string | null
          conversion_factor_to_base: number
          created_at: string | null
          id: string
          is_base_unit: boolean
          name: string
          sort_order: number
          unit_group_id: string
        }
        Insert: {
          barcode?: string | null
          conversion_factor_to_base?: number
          created_at?: string | null
          id?: string
          is_base_unit?: boolean
          name: string
          sort_order?: number
          unit_group_id: string
        }
        Update: {
          barcode?: string | null
          conversion_factor_to_base?: number
          created_at?: string | null
          id?: string
          is_base_unit?: boolean
          name?: string
          sort_order?: number
          unit_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_unit_group_id_fkey"
            columns: ["unit_group_id"]
            isOneToOne: false
            referencedRelation: "unit_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_business_roles: {
        Row: {
          business_id: string
          created_at: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_business_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credit_balances: {
        Row: {
          current_balance: number
          lifetime_referrals: number
          total_earned: number
          total_expired: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_balance?: number
          lifetime_referrals?: number
          total_earned?: number
          total_expired?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_balance?: number
          lifetime_referrals?: number
          total_earned?: number
          total_expired?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string | null
          email: string
          expo_push_token: string | null
          full_name: string
          must_choose_businesses: boolean | null
          phone: string | null
          terms_accepted_at: string | null
          terms_accepted_version: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          expo_push_token?: string | null
          full_name: string
          must_choose_businesses?: boolean | null
          phone?: string | null
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          expo_push_token?: string | null
          full_name?: string
          must_choose_businesses?: boolean | null
          phone?: string | null
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          device_name: string | null
          last_seen_at: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_name?: string | null
          last_seen_at?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_name?: string | null
          last_seen_at?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sales_count_history: {
        Row: {
          action_type: string
          business_id: string
          change_reason: string
          changed_at: string
          id: string
          metadata: Json | null
          new_count: number
          old_count: number
          sale_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          business_id: string
          change_reason: string
          changed_at?: string
          id?: string
          metadata?: Json | null
          new_count?: number
          old_count?: number
          sale_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          business_id?: string
          change_reason?: string
          changed_at?: string
          id?: string
          metadata?: Json | null
          new_count?: number
          old_count?: number
          sale_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sales_count_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sales_count_history_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sales_count_history_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_with_discount_details"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sales_counts: {
        Row: {
          business_id: string
          created_at: string
          last_counted_at: string | null
          last_reconciled_at: string | null
          last_reconciliation_result: string | null
          sales_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          last_counted_at?: string | null
          last_reconciled_at?: string | null
          last_reconciliation_result?: string | null
          sales_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          last_counted_at?: string | null
          last_reconciled_at?: string | null
          last_reconciliation_result?: string | null
          sales_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sales_counts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_reason: string | null
          cancel_reason_at: string | null
          created_at: string
          expiration_reason: string | null
          expiration_reason_at: string | null
          grace_period_ends_at: string | null
          id: string
          in_grace_period: boolean
          is_family_share: boolean | null
          is_trial_conversion: boolean | null
          last_validated_at: string | null
          last_webhook_update: string | null
          max_owned_businesses: number | null
          platform: string | null
          previous_tier: string | null
          receipt_data: string | null
          revenuecat_app_user_id: string | null
          selected_business_ids: Json | null
          subscription_expiration_date: string | null
          subscription_product_id: string | null
          subscription_start_date: string | null
          subscription_status: string
          sync_version: number
          tier: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          will_renew: boolean
        }
        Insert: {
          cancel_reason?: string | null
          cancel_reason_at?: string | null
          created_at?: string
          expiration_reason?: string | null
          expiration_reason_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          in_grace_period?: boolean
          is_family_share?: boolean | null
          is_trial_conversion?: boolean | null
          last_validated_at?: string | null
          last_webhook_update?: string | null
          max_owned_businesses?: number | null
          platform?: string | null
          previous_tier?: string | null
          receipt_data?: string | null
          revenuecat_app_user_id?: string | null
          selected_business_ids?: Json | null
          subscription_expiration_date?: string | null
          subscription_product_id?: string | null
          subscription_start_date?: string | null
          subscription_status?: string
          sync_version?: number
          tier?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          will_renew?: boolean
        }
        Update: {
          cancel_reason?: string | null
          cancel_reason_at?: string | null
          created_at?: string
          expiration_reason?: string | null
          expiration_reason_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          in_grace_period?: boolean
          is_family_share?: boolean | null
          is_trial_conversion?: boolean | null
          last_validated_at?: string | null
          last_webhook_update?: string | null
          max_owned_businesses?: number | null
          platform?: string | null
          previous_tier?: string | null
          receipt_data?: string | null
          revenuecat_app_user_id?: string | null
          selected_business_ids?: Json | null
          subscription_expiration_date?: string | null
          subscription_product_id?: string | null
          subscription_start_date?: string | null
          subscription_status?: string
          sync_version?: number
          tier?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          will_renew?: boolean
        }
        Relationships: []
      }
      web_order_blocked_phones: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          phone: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          phone: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_order_blocked_phones_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_order_blocked_phones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      web_order_log: {
        Row: {
          business_id: string
          cart_id: string | null
          created_at: string
          id: number
          ip_hash: string | null
          phone: string | null
        }
        Insert: {
          business_id: string
          cart_id?: string | null
          created_at?: string
          id?: never
          ip_hash?: string | null
          phone?: string | null
        }
        Update: {
          business_id?: string
          cart_id?: string | null
          created_at?: string
          id?: never
          ip_hash?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_order_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_order_log_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart_details_with_discounts"
            referencedColumns: ["cart_id"]
          },
          {
            foreignKeyName: "web_order_log_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_errors: {
        Row: {
          app_user_id: string | null
          created_at: string
          error_details: Json | null
          error_message: string
          error_type: string
          event_id: string | null
          event_payload: Json | null
          event_type: string
          id: string
          resolved: boolean
          retry_count: number
          severity: string | null
          updated_at: string
        }
        Insert: {
          app_user_id?: string | null
          created_at?: string
          error_details?: Json | null
          error_message: string
          error_type: string
          event_id?: string | null
          event_payload?: Json | null
          event_type: string
          id?: string
          resolved?: boolean
          retry_count?: number
          severity?: string | null
          updated_at?: string
        }
        Update: {
          app_user_id?: string | null
          created_at?: string
          error_details?: Json | null
          error_message?: string
          error_type?: string
          event_id?: string | null
          event_payload?: Json | null
          event_type?: string
          id?: string
          resolved?: boolean
          retry_count?: number
          severity?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      cart_details_with_discounts: {
        Row: {
          business_id: string | null
          cart_discount_amount: number | null
          cart_discount_type: string | null
          cart_discount_value: number | null
          cart_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivery_cost: number | null
          final_total: number | null
          items_original_total: number | null
          items_subtotal_after_discount: number | null
          items_total_discount: number | null
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_job_history: {
        Row: {
          command: string | null
          database: string | null
          duration_ms: number | null
          end_time: string | null
          job_pid: number | null
          jobid: number | null
          jobname: string | null
          return_message: string | null
          runid: number | null
          start_time: string | null
          status: string | null
          username: string | null
        }
        Relationships: []
      }
      recent_reconciliation_history: {
        Row: {
          correction_rate: number | null
          corrections_made: number | null
          discrepancies_found: number | null
          discrepancy_rate: number | null
          execution_duration_ms: number | null
          execution_time: string | null
          id: string | null
          status: string | null
          users_processed: number | null
        }
        Relationships: []
      }
      sales_count_accuracy_report: {
        Row: {
          actual_count: number | null
          business_id: string | null
          business_name: string | null
          cached_count: number | null
          discrepancy: number | null
          is_accurate: boolean | null
          last_reconciled_at: string | null
          last_reconciliation_result: string | null
          status: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sales_counts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_count_dashboard_metrics: {
        Row: {
          accuracy_percentage: number | null
          accurate_count: number | null
          discrepancy_count: number | null
          most_recent_reconciliation: string | null
          never_reconciled_count: number | null
          stale_reconciliation_count: number | null
          total_user_business_combinations: number | null
        }
        Relationships: []
      }
      sales_count_discrepancies_view: {
        Row: {
          actual_count: number | null
          business_id: string | null
          business_name: string | null
          cached_count: number | null
          discrepancy: number | null
          is_accurate: boolean | null
          last_reconciled_at: string | null
          last_reconciliation_result: string | null
          status: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sales_counts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_with_discount_details: {
        Row: {
          business_id: string | null
          cart_discount_amount: number | null
          cart_discount_type: string | null
          cart_discount_value: number | null
          cart_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivery_cost: number | null
          id: string | null
          items_original_total: number | null
          items_subtotal_after_discount: number | null
          items_total_discount: number | null
          notes: string | null
          payment_method: string | null
          sale_date: string | null
          sale_discount_amount: number | null
          sale_discount_type: string | null
          sale_discount_value: number | null
          status: string | null
          subtotal_before_discount: number | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart_details_with_discounts"
            referencedColumns: ["cart_id"]
          },
          {
            foreignKeyName: "sales_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sales_count_history_report: {
        Row: {
          action_type: string | null
          business_id: string | null
          business_name: string | null
          change_amount: number | null
          change_reason: string | null
          changed_at: string | null
          id: string | null
          metadata: Json | null
          new_count: number | null
          old_count: number | null
          sale_id: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sales_count_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sales_count_history_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sales_count_history_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales_with_discount_details"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_all_businesses_and_populate_selection: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      activate_selected_businesses: {
        Args: { p_selected_business_ids: string[]; p_user_id: string }
        Returns: undefined
      }
      adjust_product_stock: {
        Args: {
          p_adjustment_date?: string
          p_business_id: string
          p_count_session_id?: string
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_reason: string
          p_unit_id?: string
        }
        Returns: {
          adjusted_by: string | null
          adjusted_by_name: string | null
          adjustment_date: string
          business_id: string
          count_session_id: string | null
          created_at: string
          currency_id: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          quantity_entered: number
          reason: string
          stock_after: number
          stock_before: number
          total_cost: number
          unit_cost: number
          unit_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "stock_adjustments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      award_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_expiry_days?: number
          p_reference_id?: string
          p_transaction_type: string
          p_user_id: string
        }
        Returns: string
      }
      calculate_cogs: {
        Args: {
          business_id_param: string
          currency_id_param?: string
          end_date: string
          start_date: string
        }
        Returns: number
      }
      calculate_item_discount:
        | {
            Args: {
              discount_type: string
              discount_value: number
              quantity: number
              unit_price: number
            }
            Returns: number
          }
        | {
            Args: {
              discount_scope?: string
              discount_type: string
              discount_value: number
              quantity: number
              unit_price: number
            }
            Returns: number
          }
      calculate_sale_discount: {
        Args: {
          discount_type: string
          discount_value: number
          subtotal_amount: number
        }
        Returns: number
      }
      caller_is_member_or_service: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      caller_is_self_or_service: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      can_adjust_stock: {
        Args: { p_business_id: string; p_user: string }
        Returns: boolean
      }
      can_user_create_business: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      can_user_create_sale: {
        Args: { p_business_id: string; p_user_id: string }
        Returns: {
          can_create: boolean
          current_count: number
          limit_reached: boolean
          reason: string
        }[]
      }
      change_user_business_role: {
        Args: {
          business_id_param: string
          new_role_param: string
          user_id_param: string
        }
        Returns: boolean
      }
      check_business_selection_requirement: {
        Args: { p_user_id: string }
        Returns: Json
      }
      check_shared_business_membership: {
        Args: { p_caller_id: string; p_target_id: string }
        Returns: boolean
      }
      check_user_exists_by_email: { Args: { p_email: string }; Returns: Json }
      claim_referral_attribution: {
        Args: { p_device_fingerprint: string; p_referee_user_id: string }
        Returns: string
      }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      cleanup_old_webhook_records: { Args: never; Returns: undefined }
      cleanup_orphaned_notifications: { Args: never; Returns: number }
      complete_sale_atomic: {
        Args: {
          p_business_id: string
          p_cart_id: string
          p_created_by?: string
          p_currency_id?: string
          p_customer_id: string
          p_delivery_cost?: number
          p_exchange_rate_at_sale?: number
          p_notes?: string
          p_payment_method: string
          p_payment_status?: string
          p_sale_date?: string
          p_sale_discount_amount?: number
          p_sale_discount_type?: string
          p_sale_discount_value?: number
          p_subtotal_before_discount?: number
          p_total_amount: number
        }
        Returns: string
      }
      create_business: {
        Args: { business_name_param: string; owner_user_id_param?: string }
        Returns: string
      }
      create_web_order: {
        Args: {
          p_address?: string
          p_customer_name: string
          p_customer_phone: string
          p_ip_hash?: string
          p_items: Json
          p_note?: string
          p_slug: string
        }
        Returns: Json
      }
      delete_stock_adjustment: {
        Args: { p_adjustment_id: string }
        Returns: Json
      }
      effective_plan: {
        Args: { p_user_id: string }
        Returns: {
          expiration_date: string
          max_owned_businesses: number
          subscription_status: string
          tier: string
        }[]
      }
      expire_credits: { Args: never; Returns: number }
      generate_product_barcode: {
        Args: { p_business_id: string }
        Returns: string
      }
      generate_referral_code: { Args: { p_user_id: string }; Returns: string }
      get_business_owner_subscription_tier: {
        Args: { p_business_id: string }
        Returns: {
          expiration_date: string
          max_businesses: number
          subscription_status: string
          tier: string
        }[]
      }
      get_distinct_customer_count_for_sales: {
        Args: {
          business_id_param: string
          end_date_param: string
          start_date_param: string
        }
        Returns: number
      }
      get_effective_sales_limit: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_full_subscription_state: {
        Args: { p_business_id?: string; p_user_id: string }
        Returns: Json
      }
      get_low_stock_products: {
        Args: { business_id_param: string }
        Returns: {
          barcode: string
          business_id: string
          created_at: string
          current_stock: number
          description: string
          id: string
          image_url: string
          min_stock_level: number
          name: string
          price: number
          updated_at: string
        }[]
      }
      get_or_create_sales_count: {
        Args: { p_business_id: string; p_user_id: string }
        Returns: number
      }
      get_public_menu: { Args: { p_slug: string }; Returns: Json }
      get_quantity_sold: {
        Args: {
          business_id_param: string
          end_date: string
          start_date: string
        }
        Returns: number
      }
      get_sales_count_discrepancies: {
        Args: never
        Returns: {
          actual_count: number
          business_id: string
          cached_count: number
          discrepancy: number
          last_reconciled_at: string
          user_id: string
        }[]
      }
      get_sales_count_with_verification: {
        Args: { p_business_id: string; p_user_id: string }
        Returns: Json
      }
      get_subscription_status: {
        Args: { p_user_id: string }
        Returns: {
          expiration_date: string
          is_subscribed: boolean
          product_id: string
          revenuecat_app_user_id: string
          subscription_status: string
          will_renew: boolean
        }[]
      }
      get_user_credit_balance: { Args: { p_user_id: string }; Returns: number }
      get_user_display_name: {
        Args: { user_id_param: string }
        Returns: string
      }
      get_user_owned_business_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_sales_summary: { Args: { p_user_id: string }; Returns: Json }
      get_user_subscription_tier: {
        Args: { p_user_id: string }
        Returns: {
          expiration_date: string
          max_owned_businesses: number
          subscription_status: string
          tier: string
        }[]
      }
      get_user_total_sales_count: {
        Args: { p_business_id?: string; p_user_id: string }
        Returns: number
      }
      get_web_order_status: { Args: { p_token: string }; Returns: Json }
      increment_referral_code_signups:
        | { Args: { p_code: string }; Returns: undefined }
        | { Args: { p_code_id: string }; Returns: undefined }
      increment_referral_conversions:
        | { Args: { p_code: string }; Returns: undefined }
        | { Args: { p_code_id: string }; Returns: undefined }
      increment_sales_count: {
        Args: { p_business_id: string; p_user_id: string }
        Returns: number
      }
      invite_user_to_business: {
        Args: {
          business_id_param: string
          role_param?: string
          user_email_param: string
        }
        Returns: boolean
      }
      is_business_admin: {
        Args: { business_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_business_admin_check: {
        Args: { business_id_param: string; user_id_param: string }
        Returns: boolean
      }
      is_business_read_only: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      is_recent_webhook_update: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_webhook_event_processed: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      log_webhook_error: {
        Args: {
          p_app_user_id: string
          p_error_details?: Json
          p_error_message: string
          p_error_type: string
          p_event_id: string
          p_event_payload?: Json
          p_event_type: string
          p_severity?: string
        }
        Returns: string
      }
      mark_webhook_event_processed: {
        Args: {
          p_app_user_id: string
          p_event_id: string
          p_event_timestamp_ms: number
          p_event_type: string
          p_metadata?: Json
          p_processing_duration_ms?: number
        }
        Returns: string
      }
      menu_normalize_phone: { Args: { p_phone: string }; Returns: string }
      notify_web_order_spikes: {
        Args: { p_threshold?: number }
        Returns: number
      }
      post_stock_count: {
        Args: {
          p_business_id: string
          p_count_date?: string
          p_items: Json
          p_notes?: string
        }
        Returns: Json
      }
      reconcile_all_sales_counts: {
        Args: { p_auto_correct?: boolean }
        Returns: Json
      }
      reconcile_sales_count: {
        Args: {
          p_auto_correct?: boolean
          p_business_id: string
          p_user_id: string
        }
        Returns: Json
      }
      redeem_credits: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: Json
      }
      register_push_token: {
        Args: {
          p_app_version?: string
          p_device_name?: string
          p_platform?: string
          p_token: string
        }
        Returns: undefined
      }
      remove_user_from_business: {
        Args: { business_id_param: string; user_id_param: string }
        Returns: boolean
      }
      require_not_anon: { Args: never; Returns: undefined }
      require_self_or_service: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      require_service_caller: { Args: never; Returns: undefined }
      run_scheduled_reconciliation: { Args: never; Returns: undefined }
      set_all_businesses_active: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      set_all_businesses_read_only_on_expiration: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      set_read_only_businesses: {
        Args: { p_max_active_businesses: number; p_user_id: string }
        Returns: undefined
      }
      trigger_manual_reconciliation: { Args: never; Returns: Json }
      unregister_push_token: { Args: { p_token: string }; Returns: undefined }
      update_stock_adjustment: {
        Args: {
          p_adjustment_id: string
          p_notes?: string
          p_quantity: number
          p_reason: string
          p_unit_id?: string
        }
        Returns: {
          adjusted_by: string | null
          adjusted_by_name: string | null
          adjustment_date: string
          business_id: string
          count_session_id: string | null
          created_at: string
          currency_id: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          quantity_entered: number
          reason: string
          stock_after: number
          stock_before: number
          total_cost: number
          unit_cost: number
          unit_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "stock_adjustments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_has_business_access: {
        Args: { business_id_param: string; user_uid: string }
        Returns: boolean
      }
      validate_business_activation: {
        Args: { p_user_id: string }
        Returns: {
          active_count: number
          business_count: number
          error_message: string
          is_valid: boolean
          max_allowed: number
        }[]
      }
      validate_user_sales_count: {
        Args: { p_business_id: string; p_user_id: string }
        Returns: Json
      }
      verify_push_trigger_secret: {
        Args: { p_secret: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
