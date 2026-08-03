/*
 * Catálogo de rotas oferecido ao widget da Central de Suporte.
 *
 * Derivado de `shell/nav.ts` (fonte única do ribbon): tela nova no menu
 * aparece sozinha no seletor "onde aconteceu?". Sem filtro por papel — o
 * campo é DICA de contexto para o atendente, não controle de acesso.
 */
import { categories } from '@/components/shell/nav';
import type { SupportRoute } from '@vydhub/support';

export const supportRoutes: SupportRoute[] = categories.flatMap((cat) =>
  cat.items.map((item) => ({
    title: item.label,
    path: item.path,
    category: cat.label,
  }))
);
