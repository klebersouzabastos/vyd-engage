import { ReactNode, ComponentType } from 'react';

type ProviderComponent = ComponentType<{ children: ReactNode }>;

/**
 * Composes multiple React context providers into a single wrapper,
 * eliminating the pyramid of doom pattern.
 *
 * Usage:
 *   const AppProviders = composeProviders(AuthProvider, PlanProvider, ...);
 *   <AppProviders>{children}</AppProviders>
 */
export function composeProviders(...providers: ProviderComponent[]): ProviderComponent {
  return ({ children }: { children: ReactNode }) =>
    providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children
    ) as JSX.Element;
}
