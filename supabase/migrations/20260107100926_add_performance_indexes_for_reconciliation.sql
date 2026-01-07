/*
  # Add Performance Indexes for Reconciliation

  ## Overview
  This migration adds indexes to optimize reconciliation queries:
  - Composite index on sales table for fast counting by user and business
  - Index on user_sales_counts for last reconciliation time lookups

  ## New Indexes
  
  ### sales table:
  - (created_by, business_id, status) - For counting sales with status filter
  - (business_id, created_by) - For grouping operations in reconciliation
  
  ### user_sales_counts table:
  - (last_reconciled_at) - For finding stale records needing reconciliation
  - (business_id, last_reconciled_at) - For business-specific reconciliation queries

  ## Performance Impact
  - Speeds up COUNT(*) operations in reconciliation
  - Enables efficient batch processing of reconciliation
  - Minimal impact on INSERT performance (sales creation)
*/

-- Index on sales table for fast counting by user and business
CREATE INDEX IF NOT EXISTS idx_sales_created_by_business_status 
  ON sales(created_by, business_id, status)
  WHERE created_by IS NOT NULL AND business_id IS NOT NULL;

-- Index on sales table for grouping operations
CREATE INDEX IF NOT EXISTS idx_sales_business_created_by 
  ON sales(business_id, created_by)
  WHERE created_by IS NOT NULL AND business_id IS NOT NULL;

-- Index on user_sales_counts for finding stale records
CREATE INDEX IF NOT EXISTS idx_user_sales_counts_last_reconciled 
  ON user_sales_counts(last_reconciled_at)
  WHERE last_reconciled_at IS NOT NULL;

-- Index on user_sales_counts for business-specific queries
CREATE INDEX IF NOT EXISTS idx_user_sales_counts_business_reconciled 
  ON user_sales_counts(business_id, last_reconciled_at);

-- Index on user_sales_counts for finding never-reconciled records
CREATE INDEX IF NOT EXISTS idx_user_sales_counts_never_reconciled 
  ON user_sales_counts(user_id, business_id)
  WHERE last_reconciled_at IS NULL;