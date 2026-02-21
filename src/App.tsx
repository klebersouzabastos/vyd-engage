import { RouterProvider } from 'react-router';
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
import { TaskNotificationChecker } from './components/TaskNotificationChecker';
import { MigrationChecker } from './components/MigrationChecker';

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <CompanyProvider>
        <TagsProvider>
          <CustomFieldsProvider>
            <NotificationProvider>
              <PlanProvider>
                <PaymentProvider>
                  <WhatsAppProvider>
                    <EmailProvider>
                      <TaskNotificationChecker />
                      <MigrationChecker />
                      <RouterProvider router={router} />
                      <Toaster />
                    </EmailProvider>
                  </WhatsAppProvider>
                </PaymentProvider>
              </PlanProvider>
            </NotificationProvider>
          </CustomFieldsProvider>
        </TagsProvider>
      </CompanyProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
