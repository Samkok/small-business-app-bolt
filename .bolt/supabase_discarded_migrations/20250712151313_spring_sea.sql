-- Drop the incorrect foreign key constraint
ALTER TABLE public.expenses
DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;

-- Add a new foreign key constraint referencing auth.users
-- IMPORTANT: If there's existing data in 'expenses' where 'created_by'
-- does not match an 'auth.users.id', this ALTER TABLE will fail.
-- You might need to clean up or migrate existing 'created_by' values
-- before running this. For example, set them to NULL or a valid user ID.
ALTER TABLE public.expenses
ADD CONSTRAINT expenses_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id);