import { RouterProvider } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { router } from './utils/routes';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProviders } from './contexts/AppProviders';
import { MigrationChecker } from './components/MigrationChecker';
import { QueryProvider } from './lib/queryClient';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryProvider>
          <AppProviders>
            <MigrationChecker />
            <RouterProvider router={router} />
            <Toaster />
          </AppProviders>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
