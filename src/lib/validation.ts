import { z } from 'zod';

export const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
};

export const passwordSchema = z
  .string()
  .min(passwordRequirements.minLength, `Password must be at least ${passwordRequirements.minLength} characters`)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must be less than 255 characters')
  .toLowerCase()
  .trim();

export const phoneSchema = z
  .string()
  .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, 'Invalid phone number format')
  .max(20, 'Phone number must be less than 20 characters')
  .optional();

export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

export const businessNameSchema = z
  .string()
  .min(2, 'Business name must be at least 2 characters')
  .max(100, 'Business name must be less than 100 characters')
  .trim();

export const priceSchema = z
  .number()
  .min(0, 'Price cannot be negative')
  .max(999999999.99, 'Price is too large')
  .finite('Price must be a valid number');

export const quantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .min(0, 'Quantity cannot be negative')
  .max(999999, 'Quantity is too large');

export const barcodeSchema = z
  .string()
  .regex(/^[0-9A-Z-]+$/, 'Barcode can only contain numbers, uppercase letters, and hyphens')
  .min(4, 'Barcode must be at least 4 characters')
  .max(50, 'Barcode must be less than 50 characters')
  .optional();

export const textFieldSchema = z
  .string()
  .max(1000, 'Text must be less than 1000 characters')
  .trim()
  .optional();

export const notesSchema = z
  .string()
  .max(5000, 'Notes must be less than 5000 characters')
  .trim()
  .optional();

export const uuidSchema = z
  .string()
  .uuid('Invalid ID format');

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  fullName: nameSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200, 'Product name is too long').trim(),
  price: priceSchema,
  description: textFieldSchema,
  barcode: barcodeSchema,
  current_stock: quantitySchema,
  min_stock_level: quantitySchema,
  cost_per_unit: priceSchema.optional(),
  category: z.string().max(100, 'Category name is too long').optional(),
  business_id: uuidSchema,
});

export const customerSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  address: textFieldSchema,
  platform: z.enum(['facebook', 'instagram', 'telegram', 'walk_in', 'other']).optional(),
  notes: notesSchema,
  business_id: uuidSchema,
});

export const expenseSchema = z.object({
  amount: priceSchema,
  description: z.string().min(1, 'Description is required').max(500, 'Description is too long').trim(),
  expense_date: z.string().datetime(),
  notes: notesSchema,
  category_id: uuidSchema,
  business_id: uuidSchema,
});

export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[%_\\]/g, '\\$&')
    .substring(0, 100);
}

export function sanitizeNumericInput(value: any): number | null {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function sanitizeIntegerInput(value: any): number | null {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= passwordRequirements.minLength) {
    score += 20;
  } else {
    feedback.push(`Password must be at least ${passwordRequirements.minLength} characters`);
  }

  if (/[A-Z]/.test(password)) {
    score += 20;
  } else {
    feedback.push('Add uppercase letters');
  }

  if (/[a-z]/.test(password)) {
    score += 20;
  } else {
    feedback.push('Add lowercase letters');
  }

  if (/[0-9]/.test(password)) {
    score += 20;
  } else {
    feedback.push('Add numbers');
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 20;
  } else {
    feedback.push('Add special characters');
  }

  if (password.length >= 12) {
    score += 10;
  }

  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    feedback.push('Avoid repeating characters');
  }

  const isValid = score >= 80 && feedback.length === 0;

  return { isValid, score: Math.max(0, Math.min(100, score)), feedback };
}
