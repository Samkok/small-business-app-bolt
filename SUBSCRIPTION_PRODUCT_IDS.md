# Subscription Product IDs

This document explains the product ID structure used in the app for in-app purchases.

## Product ID Format

All product IDs follow this format: `bizmanage.{tier}.{period}`

Where:
- `{tier}` is one of: `pro`, `pro_plus`, `max`
- `{period}` is one of: `month`, `year`

## Available Product IDs

### Pro Tier (1 Business)
- Monthly: `bizmanage.pro.month`
- Yearly: `bizmanage.pro.year`

### Pro Plus Tier (3 Businesses)
- Monthly: `bizmanage.pro_plus.month`
- Yearly: `bizmanage.pro_plus.year`

### Max Tier (Unlimited Businesses)
- Monthly: `bizmanage.max.month`
- Yearly: `bizmanage.max.year`

## Implementation

The `productIdMapper` utility (`src/utils/productIdMapper.ts`) handles conversion between:
- Internal app format: `{tier}` + `{monthly|yearly}` → App Store format: `bizmanage.{tier}.{month|year}`
- App Store format → Internal app format

### Usage Example

```typescript
import { productIdMapper } from '@/src/utils/productIdMapper';

// Convert to App Store format
const productId = productIdMapper.toAppStoreFormat('pro_plus', 'yearly');
// Returns: 'bizmanage.pro_plus.year'

// Parse from App Store format
const { tier, period } = productIdMapper.fromAppStoreFormat('bizmanage.pro.month');
// Returns: { tier: 'pro', period: 'monthly' }

// Detect billing period
const period = productIdMapper.detectPeriod('bizmanage.max.year');
// Returns: 'yearly'

// Get tier from product ID
const tier = productIdMapper.getTierFromProductId('bizmanage.pro_plus.month');
// Returns: 'pro_plus'
```

## App Store Connect Configuration

These product IDs must match exactly with the products configured in App Store Connect for iOS and Google Play Console for Android.

## Important Notes

1. Always use the `productIdMapper` utility when working with product IDs
2. The billing period in product IDs uses `month`/`year` (not `monthly`/`yearly`)
3. Product IDs are case-sensitive and must be lowercase
4. The underscore in `pro_plus` is part of the tier name
