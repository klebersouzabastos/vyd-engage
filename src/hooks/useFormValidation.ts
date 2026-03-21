import { useState, useCallback, useRef, useEffect } from 'react';
import type { ZodSchema, ZodError } from 'zod';

interface UseFormValidationOptions<T> {
  schema: ZodSchema<T>;
  /** Validate field on change (after first blur). Default: true */
  validateOnChange?: boolean;
}

interface UseFormValidationReturn<T> {
  /** Field errors keyed by field name */
  fieldErrors: Partial<Record<keyof T, string>>;
  /** Set of fields that have been touched (blurred) */
  touchedFields: Partial<Record<keyof T, boolean>>;
  /** Call on field blur to mark as touched and validate */
  handleBlur: (field: keyof T, value: unknown) => void;
  /** Call on field change to re-validate if already touched */
  handleChange: (field: keyof T, value: unknown) => void;
  /** Validate all fields at once (e.g., on submit). Returns true if valid */
  validateAll: (data: Record<string, unknown>) => boolean;
  /** Reset all validation state */
  resetValidation: () => void;
  /** Check if the form has any errors */
  hasErrors: boolean;
  /** Ref to attach to the form element for auto-focus on first field */
  formRef: React.RefObject<HTMLFormElement | null>;
  /** Focus the first invalid field */
  focusFirstError: () => void;
}

export function useFormValidation<T extends Record<string, unknown>>({
  schema,
  validateOnChange = true,
}: UseFormValidationOptions<T>): UseFormValidationReturn<T> {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touchedFields, setTouchedFields] = useState<Partial<Record<keyof T, boolean>>>({});
  const formRef = useRef<HTMLFormElement | null>(null);
  const dataRef = useRef<Record<string, unknown>>({});

  const validateField = useCallback(
    (field: keyof T, value: unknown) => {
      // Validate using a partial object — we check the specific field's error
      const testData = { ...dataRef.current, [field]: value };
      try {
        schema.parse(testData);
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      } catch (err) {
        const zodError = err as ZodError;
        const fieldError = zodError.errors.find(
          (e) => e.path[0] === field
        );
        setFieldErrors((prev) => ({
          ...prev,
          [field]: fieldError?.message || undefined,
        }));
        // Clear errors for other fields that are now valid
        const errorPaths = new Set(zodError.errors.map((e) => e.path[0]));
        setFieldErrors((prev) => {
          const next = { ...prev, [field]: fieldError?.message || undefined };
          // Don't remove errors for untouched fields
          return next;
        });
      }
    },
    [schema]
  );

  const handleBlur = useCallback(
    (field: keyof T, value: unknown) => {
      setTouchedFields((prev) => ({ ...prev, [field]: true }));
      dataRef.current[field as string] = value;
      validateField(field, value);
    },
    [validateField]
  );

  const handleChange = useCallback(
    (field: keyof T, value: unknown) => {
      dataRef.current[field as string] = value;
      if (validateOnChange && touchedFields[field]) {
        validateField(field, value);
      }
    },
    [validateField, validateOnChange, touchedFields]
  );

  const validateAll = useCallback(
    (data: Record<string, unknown>): boolean => {
      dataRef.current = { ...data };
      try {
        schema.parse(data);
        setFieldErrors({});
        // Mark all fields as touched
        const allTouched: Partial<Record<keyof T, boolean>> = {};
        for (const key of Object.keys(data)) {
          allTouched[key as keyof T] = true;
        }
        setTouchedFields(allTouched);
        return true;
      } catch (err) {
        const zodError = err as ZodError;
        const errors: Partial<Record<keyof T, string>> = {};
        const touched: Partial<Record<keyof T, boolean>> = {};
        for (const e of zodError.errors) {
          const field = e.path[0] as keyof T;
          if (!errors[field]) {
            errors[field] = e.message;
          }
          touched[field] = true;
        }
        setFieldErrors(errors);
        setTouchedFields((prev) => ({ ...prev, ...touched }));
        return false;
      }
    },
    [schema]
  );

  const resetValidation = useCallback(() => {
    setFieldErrors({});
    setTouchedFields({});
    dataRef.current = {};
  }, []);

  const focusFirstError = useCallback(() => {
    if (!formRef.current) return;
    const firstInvalid = formRef.current.querySelector<HTMLElement>(
      '[aria-invalid="true"], .border-destructive'
    );
    if (firstInvalid) {
      firstInvalid.focus();
    }
  }, []);

  const hasErrors = Object.keys(fieldErrors).length > 0;

  return {
    fieldErrors,
    touchedFields,
    handleBlur,
    handleChange,
    validateAll,
    resetValidation,
    hasErrors,
    formRef,
    focusFirstError,
  };
}
