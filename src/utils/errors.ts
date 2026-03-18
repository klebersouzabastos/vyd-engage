import { ApiError } from '../services/api/client';

/**
 * Type-safe error message extraction.
 * Use instead of `catch (error: any)` -> `catch (error: unknown)` pattern.
 *
 * Handles ApiError (with statusCode/details), standard Error, and string errors.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erro inesperado. Tente novamente.';
}

/**
 * Extract HTTP status code from an error, if available.
 * Returns 0 for non-API errors.
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof ApiError) return error.statusCode;
  return 0;
}

/**
 * Extract error details/metadata from an ApiError.
 * Returns undefined for non-API errors.
 */
export function getErrorDetails(error: unknown): Record<string, unknown> | undefined {
  if (error instanceof ApiError) return error.details;
  return undefined;
}

/**
 * Extract a specific error code from ApiError details.
 * Useful for matching backend error codes like 'INVALID_CREDENTIALS', 'NETWORK_ERROR', etc.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiError && error.details) {
    return error.details.code as string | undefined;
  }
  return undefined;
}

/**
 * Type guard to check if an error is an ApiError.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
