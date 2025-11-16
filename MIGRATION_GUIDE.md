# Migration Guide

## Overview

This guide helps developers understand the restructuring changes and how to migrate existing code to the new patterns.

## Key Changes

### 1. Removed Duplicate Components Directory

**Before:**
```
├── components/ui/
└── src/components/ui/
```

**After:**
```
└── src/components/ui/
```

**Action Required:**
- All imports from `/components/ui` should now use `/src/components/ui`
- Most files already use the correct path (`@/src/components/ui`)

### 2. Centralized Logging

**Before:**
```typescript
console.log('Loading customers for business:', businessId);
console.warn('No business ID provided');
console.error('Failed to load customers:', error);
```

**After:**
```typescript
import { logger } from '@/src/lib';

logger.debug('Loading customers', { businessId });
logger.warn('No business ID provided');
logger.error('Failed to load customers', error, { businessId });
```

**Benefits:**
- Structured logging with context
- Easy to filter and search logs
- Can be disabled in production
- Supports log aggregation services

### 3. Error Handling

**Before:**
```typescript
try {
  const { data, error } = await supabase.from('customers').select();
  if (error) throw error;
  return data;
} catch (error) {
  console.error('Error:', error);
  Alert.alert('Error', 'Failed to load customers');
}
```

**After:**
```typescript
import { logger, DatabaseError, getErrorMessage } from '@/src/lib';

try {
  const { data, error } = await supabase.from('customers').select();
  if (error) {
    logger.error('Failed to fetch customers', error);
    throw new DatabaseError('Failed to fetch customers');
  }
  return data;
} catch (err) {
  const message = getErrorMessage(err);
  Alert.alert('Error', message);
}
```

**Benefits:**
- Typed errors with context
- Consistent error handling across the app
- Better debugging information
- Easier to track error patterns

### 4. Service Layer Improvements

**Before:**
```typescript
export const customerService = {
  async getCustomers(businessId: string) {
    if (!businessId) return;
    const { data, error } = await supabase.from('customers').select();
    if (error) throw error;
    return data;
  }
};
```

**After:**
```typescript
import { logger, ValidationError, DatabaseError } from '@/src/lib';

export const customerService = {
  async getCustomers(businessId: string): Promise<Customer[]> {
    if (!businessId) {
      logger.warn('getCustomers called without businessId');
      throw new ValidationError('Business ID is required');
    }

    const { data, error } = await supabase
      .from('customers')
      .select()
      .eq('business_id', businessId);

    if (error) {
      logger.error('Failed to fetch customers', error, { businessId });
      throw new DatabaseError('Failed to fetch customers');
    }

    return data;
  }
};
```

**Benefits:**
- Explicit return types
- Better input validation
- Consistent error handling
- Improved logging

### 5. Data Fetching with Hooks

**Before:**
```typescript
const [customers, setCustomers] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerService.getCustomers(businessId);
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  loadCustomers();
}, [businessId]);
```

**After:**
```typescript
import { useApiQuery } from '@/src/hooks';
import { customerService } from '@/src/services';

const { data: customers, error, loading, refetch } = useApiQuery(
  () => customerService.getCustomers(businessId),
  [businessId],
  { enabled: !!businessId }
);
```

**Benefits:**
- Less boilerplate code
- Built-in error handling
- Automatic refetching
- Consistent patterns

### 6. Mutations with Hooks

**Before:**
```typescript
const [loading, setLoading] = useState(false);

const handleCreate = async () => {
  setLoading(true);
  try {
    const customer = await customerService.createCustomer(formData);
    Alert.alert('Success', 'Customer created');
    navigation.goBack();
  } catch (err) {
    Alert.alert('Error', err.message);
  } finally {
    setLoading(false);
  }
};
```

**After:**
```typescript
import { useApiMutation } from '@/src/hooks';
import { customerService } from '@/src/services';

const { mutate, loading } = useApiMutation(
  customerService.createCustomer,
  {
    onSuccess: () => {
      Alert.alert('Success', 'Customer created');
      navigation.goBack();
    }
  }
);

const handleCreate = () => mutate(formData);
```

**Benefits:**
- Cleaner code
- Built-in loading states
- Consistent error handling
- Easy to test

### 7. Barrel Exports

**Before:**
```typescript
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';

import { customerService } from '@/src/services/customers';
import { productService } from '@/src/services/products';
import { salesService } from '@/src/services/sales';
```

**After:**
```typescript
import { Button, Card, Input, LoadingSpinner } from '@/src/components/ui';
import { customerService, productService, salesService } from '@/src/services';
```

**Benefits:**
- Cleaner imports
- Less import clutter
- Easier to refactor

### 8. TypeScript Strict Mode

**New Compiler Options:**
```json
{
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

**Action Required:**
- Fix any unused variables or parameters
- Add explicit return statements where needed
- Handle all switch case fall-throughs

### 9. ESLint Rules

**New Rules:**
- `no-console`: Warns on console.log usage (use logger instead)
- `@typescript-eslint/no-unused-vars`: Warns on unused variables
- `react-hooks/exhaustive-deps`: Warns on missing dependencies

**Action Required:**
- Replace console.log with logger calls
- Remove or prefix unused variables with `_`
- Add missing dependencies to useEffect/useCallback

## Migration Checklist

### For Existing Services

- [ ] Add proper TypeScript return types
- [ ] Replace console.log with logger
- [ ] Add input validation with proper errors
- [ ] Use custom error classes
- [ ] Add proper error logging
- [ ] Export through barrel file

### For Existing Components

- [ ] Replace console.log with logger
- [ ] Consider using useApiQuery for data fetching
- [ ] Consider using useApiMutation for write operations
- [ ] Add error boundaries where appropriate
- [ ] Use barrel imports

### For New Features

- [ ] Follow the service layer pattern
- [ ] Use custom hooks for data fetching
- [ ] Add proper error handling
- [ ] Include logging at key points
- [ ] Write tests (when testing is set up)
- [ ] Update documentation

## Testing the Migration

1. **Check TypeScript Compilation:**
   ```bash
   npx tsc --noEmit
   ```

2. **Run ESLint:**
   ```bash
   npm run lint
   ```

3. **Test the Application:**
   - Verify all screens load correctly
   - Test CRUD operations
   - Check error scenarios
   - Verify logging output

## Common Issues and Solutions

### Issue: Import errors after removing duplicate components

**Solution:** Update imports to use `@/src/components/ui`

### Issue: TypeScript errors about missing return types

**Solution:** Add explicit return type annotations

```typescript
// Before
async getCustomers(businessId: string) {

// After
async getCustomers(businessId: string): Promise<Customer[]> {
```

### Issue: ESLint warnings about console.log

**Solution:** Replace with logger

```typescript
// Before
console.log('Data:', data);

// After
import { logger } from '@/src/lib';
logger.debug('Data loaded', { data });
```

### Issue: Unused variable warnings

**Solution:** Prefix with underscore or remove

```typescript
// Before
const { data, error } = await query();

// After (if error is unused)
const { data } = await query();
// Or
const { data, error: _error } = await query();
```

## Getting Help

If you encounter issues during migration:

1. Check the [ARCHITECTURE.md](./ARCHITECTURE.md) for patterns and examples
2. Review the refactored `customerService` as a reference implementation
3. Check the custom hooks documentation
4. Review error handling patterns in the lib directory

## Timeline

This is an ongoing migration. Priority order:

1. ✅ Project structure consolidation
2. ✅ Logging infrastructure
3. ✅ Error handling utilities
4. ✅ Customer service refactoring (example)
5. ⏳ Remaining services refactoring
6. ⏳ Component migration to new patterns
7. ⏳ Add comprehensive testing
8. ⏳ Performance optimization
