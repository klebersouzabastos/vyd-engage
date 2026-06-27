import { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { CompanyProvider } from './CompanyContext';
import { TagsProvider } from './TagsContext';
import { CustomFieldsProvider } from './CustomFieldsContext';
import { NotificationProvider } from './NotificationContext';
import { PlanProvider } from './PlanContext';
import { PaymentProvider } from './PaymentContext';
import { WhatsAppProvider } from './WhatsAppContext';
import { EmailProvider } from './EmailContext';
import { composeProviders } from '../utils/composeProviders';

/**
 * AppProviders composes all application context providers in the correct
 * dependency order (outermost listed first):
 *
 *   AuthProvider          — authentication state (no deps)
 *   CompanyProvider       — tenant/company info (depends on Auth)
 *   TagsProvider          — tag management (depends on Auth)
 *   CustomFieldsProvider  — custom field management (depends on Auth)
 *   NotificationProvider  — notifications + WebSocket (depends on Auth)
 *   PlanProvider          — subscription/plan state (depends on Auth)
 *   PaymentProvider       — payment processing (depends on Auth)
 *   WhatsAppProvider      — WhatsApp connections (depends on Auth)
 *   EmailProvider         — email configurations (depends on Auth)
 *
 * Usage in App.tsx:
 *   <AppProviders>{children}</AppProviders>
 */
export const AppProviders = composeProviders(
  AuthProvider,
  CompanyProvider,
  TagsProvider,
  CustomFieldsProvider,
  NotificationProvider,
  PlanProvider,
  PaymentProvider,
  WhatsAppProvider,
  EmailProvider
);

// Re-export for convenience
export type AppProvidersProps = { children: ReactNode };
