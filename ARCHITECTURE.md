# Architecture Documentation

## Overview

This document describes the architectural patterns, conventions, and best practices used in the Business Manager Pro application.

## Project Structure

```
├── app/                      # Expo Router pages
│   ├── (auth)/              # Authentication screens
│   ├── (app)/               # Main application screens
│   │   └── (tabs)/          # Tab-based navigation
│   └── _layout.tsx          # Root layout
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Base UI components
│   │   ├── sales/          # Sales-specific components
│   │   ├── inventory/      # Inventory-specific components
│   │   ├── customers/      # Customer-specific components
│   │   ├── products/       # Product-specific components
│   │   ├── expenses/       # Expense-specific components
│   │   └── profile/        # Profile-specific components
│   ├── context/            # React Context providers
│   │   ├── AuthContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── CartContext.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useApiQuery.ts
│   │   ├── useApiMutation.ts
│   │   ├── useDebounce.ts
│   │   └── useDebouncedCallback.ts
│   ├── lib/                # Core utilities and helpers
│   │   ├── logger.ts       # Centralized logging
│   │   ├── errors.ts       # Error classes and handlers
│   │   └── api-response.ts # API response wrappers
│   ├── services/           # Business logic and API calls
│   │   ├── products.ts
│   │   ├── customers.ts
│   │   ├── sales.ts
│   │   └── ...
│   ├── types/              # TypeScript type definitions
│   │   └── database.ts     # Supabase database types
│   ├── utils/              # Utility functions
│   │   ├── csvParser.ts
│   │   └── ...
│   ├── config/             # Configuration files
│   │   └── supabase.ts     # Supabase client
│   └── locales/            # Internationalization
│       ├── en.json
│       ├── km.json
│       └── zh.json
├── assets/                 # Static assets
└── supabase/
    └── migrations/         # Database migrations
```

## Architectural Patterns

### 1. Service Layer Pattern

All business logic and database operations are encapsulated in service files located in `src/services/`. Each service is responsible for a specific domain entity.

**Example:**

```typescript
// src/services/customers.ts
import { supabase } from '../config/supabase';
import { logger, ValidationError, DatabaseError } from '../lib';

export const customerService = {
  async getCustomers(businessId: string): Promise<Customer[]> {
    if (!businessId) {
      throw new ValidationError('Business ID is required');
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .order('name');

    if (error) {
      logger.error('Failed to fetch customers', error, { businessId });
      throw new DatabaseError('Failed to fetch customers');
    }

    return data;
  },
};
```

**Key Principles:**
- Each service function has a single responsibility
- Input validation is performed at the service level
- Errors are properly typed and logged
- Return types are explicitly defined
- Services don't handle UI concerns

### 2. Error Handling

The application uses a centralized error handling system with custom error classes:

```typescript
// Available error classes
- AppError          // Base error class
- ValidationError   // Input validation errors
- AuthenticationError // Auth-related errors
- AuthorizationError  // Permission errors
- NotFoundError      // Resource not found
- NetworkError       // Network failures
- DatabaseError      // Database operation failures
```

**Usage:**

```typescript
import { ValidationError, logger } from '@/src/lib';

if (!id) {
  logger.warn('Invalid input: missing ID');
  throw new ValidationError('ID is required');
}
```

### 3. Centralized Logging

All console.log statements have been replaced with a structured logging system:

```typescript
import { logger } from '@/src/lib';

// Development-only logs
logger.debug('User action', { userId, action });

// Info logs
logger.info('Operation completed', { duration, result });

// Warnings
logger.warn('Deprecated API usage', { endpoint });

// Errors with context
logger.error('Operation failed', error, { context: 'additional data' });
```

### 4. Data Fetching Hooks

Custom hooks simplify data fetching and state management:

**useApiQuery** - For read operations:

```typescript
import { useApiQuery } from '@/src/hooks';
import { customerService } from '@/src/services';

const { data, error, loading, refetch } = useApiQuery(
  () => customerService.getCustomers(businessId),
  [businessId],
  {
    enabled: !!businessId,
    onSuccess: (customers) => {
      logger.info('Customers loaded', { count: customers.length });
    },
  }
);
```

**useApiMutation** - For write operations:

```typescript
import { useApiMutation } from '@/src/hooks';
import { customerService } from '@/src/services';

const { mutate, loading, error } = useApiMutation(
  customerService.createCustomer,
  {
    onSuccess: (customer) => {
      Alert.alert('Success', 'Customer created');
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  }
);

// Usage
await mutate({ name: 'John Doe', businessId });
```

### 5. Error Boundaries

React Error Boundaries catch rendering errors and provide graceful degradation:

```typescript
import { ErrorBoundary } from '@/src/components/ErrorBoundary';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

Custom fallback UI:

```typescript
<ErrorBoundary
  fallback={(error, resetError) => (
    <CustomErrorScreen error={error} onRetry={resetError} />
  )}
>
  <YourComponent />
</ErrorBoundary>
```

## Type Safety

### TypeScript Configuration

The project uses strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Database Types

All database types are automatically generated from Supabase schema:

```typescript
import { Database } from '@/src/types/database';

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];
```

## Code Quality

### ESLint Configuration

The project enforces code quality through ESLint:

- No console.log (use logger instead)
- Unused variables warnings
- React hooks dependency warnings
- Prettier integration for formatting

### Import Organization

Use barrel exports for cleaner imports:

```typescript
// Instead of:
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';

// Use:
import { Button, Card, Input } from '@/src/components/ui';
```

## Best Practices

### 1. Component Structure

```typescript
// Imports
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { Button, Card } from '@/src/components/ui';
import { customerService } from '@/src/services';

// Types
interface Props {
  customerId: string;
}

// Component
export function CustomerDetail({ customerId }: Props) {
  // Hooks
  const { currentBusiness } = useAuth();
  const [customer, setCustomer] = useState(null);

  // Effects
  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  // Handlers
  const loadCustomer = async () => {
    // Implementation
  };

  // Render
  return (
    <View>
      {/* JSX */}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  // Styles
});
```

### 2. Error Handling in Components

```typescript
const [error, setError] = useState<string | null>(null);

try {
  await someOperation();
} catch (err) {
  const message = getErrorMessage(err);
  setError(message);
  logger.error('Operation failed', err);
}

// Display error inline
{error && <Text style={styles.error}>{error}</Text>}
```

### 3. Loading States

```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    await service.operation();
  } finally {
    setLoading(false);
  }
};

<Button loading={loading} onPress={handleSubmit} />
```

## Performance Optimization

### 1. Memoization

Use React.memo for expensive components:

```typescript
export const ExpensiveComponent = React.memo(({ data }) => {
  return <View>{/* Render data */}</View>;
});
```

### 2. Callback Memoization

Use useCallback for callbacks passed to child components:

```typescript
const handlePress = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

### 3. useMemo for Expensive Calculations

```typescript
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.value - b.value);
}, [data]);
```

## Testing Strategy

(To be implemented)

- Unit tests for services and utilities
- Component tests for UI components
- Integration tests for critical user flows
- E2E tests for complete workflows

## Future Improvements

1. Implement state machine patterns for complex workflows
2. Add GraphQL layer for more efficient data fetching
3. Implement offline-first architecture with sync
4. Add comprehensive analytics and monitoring
5. Implement feature flags for gradual rollouts
6. Add performance monitoring and profiling
7. Implement automated visual regression testing

## Contributing

When adding new features:

1. Follow the established patterns in this document
2. Add proper error handling and logging
3. Include TypeScript types for all functions
4. Write tests for new functionality
5. Update documentation as needed
6. Use the established folder structure
7. Follow naming conventions
