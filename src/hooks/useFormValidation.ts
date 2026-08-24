import { useState, useCallback, useRef } from 'react';
import { z } from 'zod';

export type FieldStatus = 'idle' | 'validating' | 'valid' | 'error';

export interface FieldState {
  value: string;
  status: FieldStatus;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

interface UseFormValidationOptions<T extends Record<string, any>> {
  schema: z.ZodType<T>;
  initialValues: Record<keyof T, string>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

export function useFormValidation<T extends Record<string, any>>({
  schema,
  initialValues,
  validateOnChange = true,
  validateOnBlur = true,
  debounceMs = 300,
}: UseFormValidationOptions<T>) {
  const [fields, setFields] = useState<Record<string, FieldState>>(() => {
    const initial: Record<string, FieldState> = {};
    for (const key of Object.keys(initialValues)) {
      initial[key] = {
        value: initialValues[key] || '',
        status: 'idle',
        error: null,
        touched: false,
        dirty: false,
      };
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const validateField = useCallback((fieldName: string, value: string, allValues?: Record<string, string>) => {
    const currentValues = allValues || Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v.value])
    );
    currentValues[fieldName] = value;

    const result = schema.safeParse(currentValues);

    if (result.success) {
      setFields(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          status: 'valid',
          error: null,
        },
      }));
      return true;
    }

    const fieldError = result.error.errors.find(e => e.path[0] === fieldName);
    if (fieldError) {
      setFields(prev => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          status: 'error',
          error: fieldError.message,
        },
      }));
      return false;
    }

    setFields(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        status: 'valid',
        error: null,
      },
    }));
    return true;
  }, [schema, fields]);

  const setValue = useCallback((fieldName: string, value: string) => {
    setSubmitSuccess(false);

    setFields(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        value,
        dirty: value !== (initialValues as Record<string, string>)[fieldName],
        status: prev[fieldName].touched && validateOnChange ? 'validating' : prev[fieldName].status,
      },
    }));

    if (validateOnChange) {
      if (debounceTimers.current[fieldName]) {
        clearTimeout(debounceTimers.current[fieldName]);
      }

      debounceTimers.current[fieldName] = setTimeout(() => {
        setFields(prev => {
          if (!prev[fieldName].touched) return prev;
          return prev;
        });

        const currentFields = { ...fields, [fieldName]: { ...fields[fieldName], value } };
        const allValues = Object.fromEntries(
          Object.entries(currentFields).map(([k, v]) => [k, v.value])
        );
        allValues[fieldName] = value;

        if (fields[fieldName]?.touched) {
          validateField(fieldName, value, allValues);
        }
      }, debounceMs);
    }
  }, [validateOnChange, debounceMs, validateField, fields, initialValues]);

  const setTouched = useCallback((fieldName: string) => {
    setFields(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        touched: true,
      },
    }));

    if (validateOnBlur) {
      const value = fields[fieldName]?.value || '';
      validateField(fieldName, value);
    }
  }, [validateOnBlur, validateField, fields]);

  const validateAll = useCallback((): boolean => {
    const allValues = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v.value])
    );

    const result = schema.safeParse(allValues);

    if (result.success) {
      setFields(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = { ...updated[key], status: 'valid', error: null, touched: true };
        }
        return updated;
      });
      return true;
    }

    setFields(prev => {
      const updated = { ...prev };
      for (const key of Object.keys(updated)) {
        updated[key] = { ...updated[key], status: 'valid', error: null, touched: true };
      }
      for (const err of result.error.errors) {
        const key = err.path[0] as string;
        if (updated[key]) {
          updated[key] = { ...updated[key], status: 'error', error: err.message };
        }
      }
      return updated;
    });
    return false;
  }, [schema, fields]);

  const getValues = useCallback((): Record<string, string> => {
    return Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v.value])
    );
  }, [fields]);

  const reset = useCallback(() => {
    const initial: Record<string, FieldState> = {};
    for (const key of Object.keys(initialValues)) {
      initial[key] = {
        value: initialValues[key] || '',
        status: 'idle',
        error: null,
        touched: false,
        dirty: false,
      };
    }
    setFields(initial);
    setIsSubmitting(false);
    setSubmitSuccess(false);
  }, [initialValues]);

  const handleSubmit = useCallback(async (onSubmit: (values: T) => Promise<void>) => {
    setSubmitSuccess(false);
    const isValid = validateAll();
    if (!isValid) return false;

    setIsSubmitting(true);
    try {
      const allValues = Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, v.value])
      );
      await onSubmit(allValues as T);
      setSubmitSuccess(true);
      return true;
    } catch (error) {
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [validateAll, fields]);

  const hasErrors = Object.values(fields).some(f => f.status === 'error');
  const isDirty = Object.values(fields).some(f => f.dirty);
  const isFormValid = !hasErrors && Object.values(fields).every(f => f.status === 'valid' || f.status === 'idle');

  return {
    fields,
    setValue,
    setTouched,
    validateField,
    validateAll,
    getValues,
    reset,
    handleSubmit,
    isSubmitting,
    submitSuccess,
    hasErrors,
    isDirty,
    isFormValid,
  };
}
