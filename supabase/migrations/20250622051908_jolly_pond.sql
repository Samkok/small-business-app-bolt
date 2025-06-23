/*
  # Initial Business Management Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `business_name` (text)
      - `full_name` (text)
      - `role` (text, admin/staff)
      - `phone` (text, optional)
      - `address` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `products`
      - `id` (uuid, primary key)
      - `name` (text)
      - `price` (numeric)
      - `description` (text, optional)
      - `image_url` (text, optional)
      - `barcode` (text, optional)
      - `current_stock` (integer)
      - `min_stock_level` (integer)
      - `business_id` (uuid, references profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `customers`
      - `id` (uuid, primary key)
      - `name` (text)
      - `phone` (text, optional)
      - `address` (text, optional)
      - `platform` (text, optional)
      - `notes` (text, optional)
      - `business_id` (uuid, references profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `inventory_imports`
      - `id` (uuid, primary key)
      - `product_id` (uuid, references products)
      - `quantity` (integer)
      - `base_unit_cost` (numeric)
      - `final_unit_cost` (numeric)
      - `total_cost` (numeric)
      - `notes` (text, optional)
      - `business_id` (uuid, references profiles)
      - `imported_by` (uuid, references profiles)
      - `created_at` (timestamp)

    - `import_costs`
      - `id` (uuid, primary key)
      - `import_id` (uuid, references inventory_imports)
      - `cost_type` (text)
      - `amount` (numeric)
      - `calculation_type` (text, per_unit/per_total)
      - `description` (text, optional)
      - `created_at` (timestamp)

    - `carts`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `status` (text, active/completed/abandoned)
      - `total_amount` (numeric)
      - `discount_type` (text, optional)
      - `discount_value` (numeric, optional)
      - `delivery_cost` (numeric, optional)
      - `notes` (text, optional)
      - `business_id` (uuid, references profiles)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `cart_items`
      - `id` (uuid, primary key)
      - `cart_id` (uuid, references carts)
      - `product_id` (uuid, references products)
      - `quantity` (integer)
      - `unit_price` (numeric)
      - `discount_type` (text, optional)
      - `discount_value` (numeric, optional)
      - `subtotal` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `sales`
      - `id` (uuid, primary key)
      - `cart_id` (uuid, references carts)
      - `customer_id` (uuid, references customers)
      - `total_amount` (numeric)
      - `payment_method` (text)
      - `status` (text)
      - `sale_date` (timestamp)
      - `notes` (text, optional)
      - `business_id` (uuid, references profiles)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)

    - `sale_actions`
      - `id` (uuid, primary key)
      - `sale_id` (uuid, references sales)
      - `action_type` (text, void/refund/return)
      - `amount` (numeric, optional)
      - `reason` (text)
      - `notes` (text, optional)
      - `performed_by` (uuid, references profiles)
      - `created_at` (timestamp)

    - `expense_categories`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text, optional)
      - `business_id` (uuid, references profiles)
      - `created_at` (timestamp)

    - `expenses`
      - `id` (uuid, primary key)
      - `category_id` (uuid, references expense_categories)
      - `amount` (numeric)
      - `description` (text)
      - `expense_date` (timestamp)
      - `notes` (text, optional)
      - `business_id` (uuid, references profiles)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for business-based data isolation
    - Role-based access control policies
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  business_name text NOT NULL,
  full_name text NOT NULL,
  role text DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  phone text,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  image_url text,
  barcode text,
  current_stock integer DEFAULT 0,
  min_stock_level integer DEFAULT 0,
  business_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  platform text CHECK (platform IN ('facebook', 'instagram', 'telegram', 'walk_in', 'other')),
  notes text,
  business_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create inventory_imports table
CREATE TABLE IF NOT EXISTS inventory_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  base_unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  final_unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  total_cost numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  business_id uuid REFERENCES profiles(id) NOT NULL,
  imported_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create import_costs table
CREATE TABLE IF NOT EXISTS import_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES inventory_imports(id) NOT NULL,
  cost_type text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  calculation_type text NOT NULL CHECK (calculation_type IN ('per_unit', 'per_total')),
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create carts table
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  total_amount numeric(10,2) DEFAULT 0,
  discount_type text CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(10,2),
  delivery_cost numeric(10,2),
  notes text,
  business_id uuid REFERENCES profiles(id) NOT NULL,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create cart_items table
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid REFERENCES carts(id) NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  discount_type text CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(10,2),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid REFERENCES carts(id) NOT NULL,
  customer_id uuid REFERENCES customers(id) NOT NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  status text DEFAULT 'completed' CHECK (status IN ('completed', 'voided', 'refunded', 'partially_returned')),
  sale_date timestamptz DEFAULT now(),
  notes text,
  business_id uuid REFERENCES profiles(id) NOT NULL,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create sale_actions table
CREATE TABLE IF NOT EXISTS sale_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('void', 'refund', 'return')),
  amount numeric(10,2),
  reason text NOT NULL,
  notes text,
  performed_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create expense_categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  business_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES expense_categories(id) NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  description text NOT NULL,
  expense_date timestamptz DEFAULT now(),
  notes text,
  business_id uuid REFERENCES profiles(id) NOT NULL,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Products policies
CREATE POLICY "Users can manage business products"
  ON products
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Customers policies
CREATE POLICY "Users can manage business customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Inventory imports policies
CREATE POLICY "Users can manage business inventory imports"
  ON inventory_imports
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Import costs policies
CREATE POLICY "Users can manage import costs"
  ON import_costs
  FOR ALL
  TO authenticated
  USING (
    import_id IN (
      SELECT id FROM inventory_imports 
      WHERE business_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Carts policies
CREATE POLICY "Users can manage business carts"
  ON carts
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Cart items policies
CREATE POLICY "Users can manage cart items"
  ON cart_items
  FOR ALL
  TO authenticated
  USING (
    cart_id IN (
      SELECT id FROM carts 
      WHERE business_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Sales policies
CREATE POLICY "Users can manage business sales"
  ON sales
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Sale actions policies
CREATE POLICY "Users can manage sale actions"
  ON sale_actions
  FOR ALL
  TO authenticated
  USING (
    sale_id IN (
      SELECT id FROM sales 
      WHERE business_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Expense categories policies
CREATE POLICY "Users can manage business expense categories"
  ON expense_categories
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Expenses policies
CREATE POLICY "Users can manage business expenses"
  ON expenses
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_imports_business_id ON inventory_imports(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_imports_product_id ON inventory_imports(product_id);
CREATE INDEX IF NOT EXISTS idx_import_costs_import_id ON import_costs(import_id);
CREATE INDEX IF NOT EXISTS idx_carts_business_id ON carts(business_id);
CREATE INDEX IF NOT EXISTS idx_carts_customer_id ON carts(customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_actions_sale_id ON sale_actions(sale_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_business_id ON expense_categories(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);