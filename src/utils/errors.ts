/**
 * Type-safe error message extraction.
 * Use instead of `catch (error: any)` → `catch (error: unknown)` pattern.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erro inesperado. Tente novamente.';
}
