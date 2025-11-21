# Return Sale Loss Adjustment Feature

## Overview

Added comprehensive loss adjustment functionality to the Return Sale form, similar to the existing void sale feature. This allows businesses to deduct losses from refund amounts when processing returns due to damaged goods, restocking fees, or other business reasons.

---

## Feature Description

### What It Does

When processing a return, users can now apply loss adjustments to individual items being returned. This reduces the refund amount while still returning the inventory to stock.

### Use Cases

1. **Damaged Returns** - Product damaged by customer (e.g., 20% loss)
2. **Restocking Fees** - Business policy charges for returns (e.g., $5 fixed fee)
3. **Partial Product Value** - Item returned but not in original condition
4. **Opened/Used Items** - Reduced refund for opened packages
5. **Late Returns** - Depreciation-based adjustments

---

## How It Works

### Per-Item Loss Adjustment

Unlike the void function which applies loss to the entire sale, returns allow **per-item loss adjustment**. Each returned item can have its own:

- **Loss Type**: None, Fixed amount, or Percentage
- **Loss Amount**: Dollar value deducted from that item's refund
- **Loss Percentage**: Percentage deducted from that item's refund

### User Interface

#### 1. Loss Adjustment Section

When an item is selected for return (quantity > 0), a **Loss Adjustment** section appears below the item with:

```
┌─────────────────────────────────────┐
│ 🔻 Loss Adjustment (Optional)       │
├─────────────────────────────────────┤
│ ○ No loss                           │
│ ○ Fixed amount                      │
│ ○ Percentage                        │
└─────────────────────────────────────┘
```

#### 2. Fixed Amount Loss

When "Fixed amount" is selected:

```
┌─────────────────────────────────────┐
│ $ [Enter loss amount]               │
├─────────────────────────────────────┤
│ Loss: -$5.00                        │
│ Final refund: $45.00                │
└─────────────────────────────────────┘
```

#### 3. Percentage Loss

When "Percentage" is selected:

```
┌─────────────────────────────────────┐
│ [Enter percentage (0-100)] %        │
├─────────────────────────────────────┤
│ Loss: -$10.00                       │
│ Final refund: $40.00                │
└─────────────────────────────────────┘
```

---

## Implementation Details

### File Modified

**Location:** `src/components/sales/ReturnSaleForm.tsx`

### Changes Made

#### 1. **Added Loss Adjustment UI** ✅

**Lines: 376-491**

Added a collapsible loss adjustment section for each item that:
- Only appears when item quantity > 0
- Shows three radio options: None, Fixed, Percentage
- Displays input fields based on selection
- Shows real-time calculations of loss and final refund
- Styled with warning colors (yellow/amber theme)

#### 2. **Added Icons** ✅

**Line: 19**

Imported new icons:
- `TrendingDown` - For loss adjustment header
- `Percent` - For percentage input field

#### 3. **Updated Layout Structure** ✅

**Lines: 673-683**

- Changed `returnItem` from row to column layout
- Added `itemRow` wrapper for horizontal layout of item info and controls
- Allows loss adjustment section to appear below item details

#### 4. **Added Styles** ✅

**Lines: 729-803**

Added comprehensive styles for:
- `lossAdjustmentSection` - Container with border and background
- `lossHeader` - Icon and title row
- `lossRadioGroup` - Radio button container
- `lossRadio` / `lossRadioInner` - Custom radio buttons
- `lossInputContainer` - Input field wrapper
- `lossInput` - Text input styling
- `lossCalculation` - Result display section

### Existing Logic (Already in place)

The loss adjustment **logic** was already implemented:

- **Data Structure** (lines 22-32): `ReturnItem` interface includes `lossAmount`, `lossPercentage`, `lossType`
- **Update Function** (lines 86-99): `updateItemLoss()` handles state updates
- **Calculation** (lines 101-131): `calculateRefundAmount()` includes loss in calculations
- **Validation** (lines 156-165): Validates loss amounts before submission
- **API Integration** (lines 169-183): Sends loss data to server

**What was missing:** Only the UI to access this functionality!

---

## User Flow

### Step-by-Step Process

1. **Open Return Form**
   - Navigate to a completed sale
   - Click "Return Items" button

2. **Select Items for Return**
   - Choose quantity for each item to return
   - Click +/- buttons or type quantity

3. **Apply Loss Adjustment (Optional)**
   - Loss section appears when item selected
   - Choose loss type:
     - **No loss** - Full refund (default)
     - **Fixed amount** - Enter dollar amount
     - **Percentage** - Enter percentage (0-100)

4. **Review Calculations**
   - See real-time updates:
     - Original refund amount
     - Loss deduction
     - Final refund amount
   - Total refund updates automatically

5. **Provide Return Reason**
   - Required field
   - Enter reason for return

6. **Process Return**
   - Click "Process Return" button
   - System:
     - Updates inventory (+returned quantity)
     - Creates refund transaction (- adjusted amount)
     - Updates sale status to "Partially Returned"
     - Records loss amounts in database

---

## Examples

### Example 1: Damaged Product (Percentage Loss)

**Scenario:**
- Customer returns damaged laptop case
- Original price: $50.00
- Quantity: 1
- Damage: 30% loss

**Configuration:**
- Return Quantity: 1
- Loss Type: Percentage
- Loss Percentage: 30

**Calculation:**
```
Original refund: $50.00
Loss (30%): -$15.00
Final refund: $35.00
```

**Result:**
- Customer refunded: $35.00
- Inventory increased: +1 unit
- Business records loss: $15.00

---

### Example 2: Restocking Fee (Fixed Loss)

**Scenario:**
- Customer returns unopened book
- Original price: $25.00
- Quantity: 2
- Policy: $3 restocking fee per item

**Configuration:**
- Return Quantity: 2
- Loss Type: Fixed amount
- Loss Amount: 6.00 (2 × $3)

**Calculation:**
```
Original refund: $50.00 (2 × $25)
Loss (fixed): -$6.00
Final refund: $44.00
```

**Result:**
- Customer refunded: $44.00
- Inventory increased: +2 units
- Business keeps: $6.00 restocking fee

---

### Example 3: Multiple Items with Different Adjustments

**Scenario:**
- Item A: Shirt - $30 × 2 = $60, No loss (perfect condition)
- Item B: Shoes - $80 × 1 = $80, 25% loss (worn)
- Item C: Hat - $20 × 1 = $20, $5 fixed loss (tags removed)

**Configuration:**
- Item A: No loss
- Item B: 25% percentage loss
- Item C: $5 fixed loss

**Calculation:**
```
Item A refund: $60.00 - $0.00 = $60.00
Item B refund: $80.00 - $20.00 = $60.00
Item C refund: $20.00 - $5.00 = $15.00
────────────────────────────────────
Total refund: $135.00
Total loss recorded: $25.00
```

---

## Business Benefits

### 1. **Flexible Return Policies** ✅
- Accommodate different return scenarios
- Fair adjustments for damaged/used items
- Maintain customer satisfaction while protecting profits

### 2. **Clear Documentation** ✅
- Loss amounts recorded in database
- Audit trail for refunds
- Transparent for customers

### 3. **Real-Time Calculations** ✅
- Instant feedback on adjustments
- No manual calculation errors
- Staff can see final amounts before processing

### 4. **Inventory Accuracy** ✅
- Items returned to stock regardless of loss
- Inventory count stays accurate
- Financial loss tracked separately

### 5. **Policy Enforcement** ✅
- Consistent application of restocking fees
- Standardized damage assessments
- Reduces disputes

---

## Technical Details

### Data Flow

```
User Input
    ↓
updateItemLoss(productId, lossType, value)
    ↓
ReturnItem state updated
    ↓
calculateRefundAmount() recalculates
    ↓
UI updates in real-time
    ↓
handleSubmitReturn()
    ↓
Validation checks
    ↓
salesService.returnItems()
    ↓
Database records:
    - Inventory adjustment (+quantity)
    - Refund transaction (-adjusted amount)
    - Loss amounts (for reporting)
    - Sale status update
```

### Validation Rules

**Fixed Amount Loss:**
- Must be >= 0
- Cannot exceed item's refund amount
- Error message: "Invalid loss amount for [Product Name]"

**Percentage Loss:**
- Must be between 0 and 100
- Applied to item's refund amount
- Error message: "Invalid loss percentage for [Product Name]. Must be between 0-100"

**General:**
- At least one item must have quantity > 0
- Return reason is required
- Loss adjustments are optional

### Calculation Formula

```typescript
// For each item:
itemRefundAmount = returnQuantity × unitPrice

if (lossType === 'fixed') {
  itemLoss = lossAmount
} else if (lossType === 'percentage') {
  itemLoss = itemRefundAmount × (lossPercentage / 100)
} else {
  itemLoss = 0
}

itemFinalRefund = Math.max(0, itemRefundAmount - itemLoss)

// Total:
totalRefund = sum of all itemFinalRefund values
```

---

## Comparison: Void vs Return Loss Adjustment

### Void Sale (Existing Feature)

| Aspect | Details |
|--------|---------|
| **Scope** | Entire sale |
| **Timing** | After sale completed |
| **Inventory** | Optionally returned (can exclude delivery cost) |
| **Loss Adjustment** | Applied to total sale amount |
| **Use Case** | Cancel entire transaction, fraudulent sale, major issues |

### Return Sale (New Feature)

| Aspect | Details |
|--------|---------|
| **Scope** | Individual items or partial sale |
| **Timing** | After sale completed |
| **Inventory** | Always returned to stock |
| **Loss Adjustment** | Applied per-item individually |
| **Use Case** | Customer returns, damaged goods, policy-based fees |

### Key Differences

1. **Granularity**
   - Void: One adjustment for entire sale
   - Return: Separate adjustment per item

2. **Flexibility**
   - Void: All-or-nothing for inventory return
   - Return: Always returns inventory, loss is financial only

3. **Use Cases**
   - Void: Mistakes, fraud, complete cancellations
   - Return: Normal business returns with conditions

---

## UI/UX Highlights

### Visual Design

**Color Scheme:**
- **Warning Theme** - Yellow/amber background indicates optional adjustment
- **Red Text** - Loss amounts shown in red to indicate deduction
- **Green Text** - Final refund shown in green as positive amount
- **Blue Radio** - Selected option highlighted in blue

**Layout:**
- **Collapsible** - Only visible when item selected for return
- **Inline** - Appears directly below each item
- **Compact** - Minimal space usage, clean design
- **Responsive** - Works on all screen sizes

### Usability Features

✅ **Real-Time Feedback** - Calculations update instantly

✅ **Clear Labels** - "Loss" vs "Final refund" explicitly stated

✅ **Input Validation** - Keyboard type set to `decimal-pad`

✅ **Optional Feature** - Defaults to "No loss", doesn't interrupt flow

✅ **Per-Item Control** - Each item has independent adjustment

✅ **Visual Separation** - Border and background distinguish loss section

---

## Testing Checklist

### Manual Testing

- [ ] Open return form for a completed sale
- [ ] Select 1+ items for return
- [ ] Verify loss section appears
- [ ] Test "No loss" option (default)
- [ ] Test "Fixed amount" with various values
- [ ] Test "Percentage" with values 0-100
- [ ] Verify calculations are correct
- [ ] Test edge cases (100%, negative, over limit)
- [ ] Verify validation messages
- [ ] Submit return and check database
- [ ] Verify inventory updated correctly
- [ ] Check refund amount in records
- [ ] Test with multiple items
- [ ] Test with different loss types on different items
- [ ] Verify UI in dark mode
- [ ] Test on mobile/tablet/desktop

### Edge Cases

1. **Loss > Refund Amount**
   - Should cap at $0.00 refund
   - UI shows Math.max(0, ...)

2. **100% Percentage Loss**
   - Valid input
   - Results in $0.00 refund
   - Item still returned to inventory

3. **0% or $0 Loss**
   - Equivalent to "No loss"
   - Full refund amount

4. **Multiple Items, One with Loss**
   - Only affects that specific item
   - Other items refund fully

5. **Switching Loss Types**
   - Previous values cleared
   - Calculations update immediately

---

## Future Enhancements (Optional)

### 1. **Loss Reason Dropdown**
```typescript
const lossReasons = [
  'Damaged by customer',
  'Missing parts',
  'Restocking fee',
  'Opened/used',
  'Past return window'
];
```

### 2. **Preset Loss Percentages**
```typescript
// Quick buttons
[10%, 20%, 30%, 50%]
```

### 3. **Loss Reporting**
- Total losses per period
- Most common loss reasons
- Average loss percentage

### 4. **Policy Templates**
```typescript
const policies = {
  electronics: { type: 'percentage', value: 15 },
  clothing: { type: 'percentage', value: 10 },
  books: { type: 'fixed', value: 3 }
};
```

### 5. **Photo Upload**
- Document damaged condition
- Attach to return record
- Reference for disputes

### 6. **Manager Approval**
- Require approval for losses > threshold
- Workflow integration
- Audit trail

---

## Summary

✅ **Added comprehensive loss adjustment UI to Return Sale form**

✅ **Per-item control with three loss types: None, Fixed, Percentage**

✅ **Real-time calculations with clear visual feedback**

✅ **Seamlessly integrated with existing return logic**

✅ **Professional UI with warning colors and intuitive controls**

✅ **Flexible for various business scenarios (damage, fees, policies)**

✅ **Maintains accurate inventory while tracking financial losses**

✅ **Complete parity with Void Sale loss adjustment feature**

This feature gives businesses powerful control over return policies while maintaining clear documentation and customer transparency. The per-item granularity makes it more flexible than the void function, allowing mixed scenarios where some items are fully refunded and others have adjustments applied.

**Result:** Professional, feature-rich return system that handles real-world business needs! 🎉
