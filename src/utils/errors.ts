import { ApiError } from '../services/api/client';

// Re-export ApiError and ApiErrorResponse for convenience
export { ApiError } from '../services/api/client';
export type { ApiErrorResponse } from '../services/api/client';

/**
 * Type-safe error message extraction.
 * Use instead of `catch (error: any)` -> `catch (error: unknown)` pattern.
 *
 * Handles ApiError (with statusCode/details/code), standard Error, and string errors.
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
 * Extract a specific error code from ApiError details or the code property.
 * Useful for matching backend error codes like 'INVALID_CREDENTIALS', 'NETWORK_ERROR', etc.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return error.code || (error.details?.code as string | undefined);
  }
  return undefined;
}

/**
 * Type guard to check if an error is an ApiError.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Check if an error is a network connectivity failure (no server response).
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.isNetworkError;
}

/**
 * Check if an error is a server-side error (5xx).
 */
export function isServerError(error: unknown): boolean {
  return error instanceof ApiError && error.isServerError;
}
