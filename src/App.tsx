import { RouterProvider } from 'react-router';
import { ThemeProvider } from 'next-themes';
import { router } from './utils/routes';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProviders } from './contexts/AppProviders';
import { MigrationChecker } from './components/MigrationChecker';
import { QueryProvider } from './lib/queryClient';
import { PostHogProvider } from './lib/posthog';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="data-vyd-theme"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="vyd-theme"
        disableTransitionOnChange
      >
        <PostHogProvider>
          <QueryProvider>
            <AppProviders>
              <MigrationChecker />
              <RouterProvider router={router} />
              <Toaster />
            </AppProviders>
          </QueryProvider>
        </PostHogProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
