import { RouterProvider } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { router } from './utils/routes';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { TagsProvider } from './contexts/TagsContext';
import { CustomFieldsProvider } from './contexts/CustomFieldsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { WhatsAppProvider } from './contexts/WhatsAppContext';
import { EmailProvider } from './contexts/EmailContext';
import { PlanProvider } from './contexts/PlanContext';
import { PaymentProvider } from './contexts/PaymentContext';
import { MigrationChecker } from './components/MigrationChecker';
import { composeProviders } from './utils/composeProviders';

// Compose all providers in order (outermost first)
const AppProviders = composeProviders(
  AuthProvider,
  CompanyProvider,
  TagsProvider,
  CustomFieldsProvider,
  NotificationProvider,
  PlanProvider,
  PaymentProvider,
  WhatsAppProvider,
  EmailProvider,
);

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AppProviders>
          <MigrationChecker />
          <RouterProvider router={router} />
          <Toaster />
        </AppProviders>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
