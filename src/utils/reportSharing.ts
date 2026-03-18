// Report sharing utilities
//
// TECH DEBT (FE-30): Report sharing (public links, shared access) was previously
// backed by localStorage. Reports now use the API (see server/src/routes/reports.ts).
// A dedicated sharing API endpoint is needed to fully support public link generation,
// password-protected sharing, and expiration. Until then, sharing features are disabled.
//
// Functions removed in State Management Cleanup (Story 3.3):
//   - enablePublicSharing, disablePublicSharing, getPublicLink
//   - verifySharedReportAccess, updateSharePermissions, shareViaEmail
//   - getSharedReports, saveSharedReports (localStorage CRUD)
//   - getReports, saveReports (localStorage CRUD — reports now use API)

/**
 * Copy text to clipboard using the Clipboard API.
 * Kept as a generic utility used by payment components (PixPayment, BoletoPayment).
 */
export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
