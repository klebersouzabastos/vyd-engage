/**
 * Utilitários para converter valores de status e source entre frontend e backend
 */

// Mapeamento de status do frontend para o backend
export function mapStatusToBackend(status: string): string {
  const statusMap: Record<string, string> = {
    'novo': 'NEW',
    'contato': 'CONTACTED',
    'fechado': 'WON',
    'perdido': 'LOST',
    // Valores já em formato backend (para compatibilidade)
    'NEW': 'NEW',
    'CONTACTED': 'CONTACTED',
    'QUALIFIED': 'QUALIFIED',
    'PROPOSAL': 'PROPOSAL',
    'NEGOTIATION': 'NEGOTIATION',
    'WON': 'WON',
    'LOST': 'LOST',
  };

  const normalizedStatus = status.toLowerCase();
  return statusMap[normalizedStatus] || statusMap[status] || 'NEW';
}

// Mapeamento de source do frontend para o backend
export function mapSourceToBackend(source: string): string {
  const sourceMap: Record<string, string> = {
    'meta': 'SOCIAL_MEDIA',
    'google': 'WEBSITE',
    'organico': 'WEBSITE',
    'manual': 'OTHER',
    // Valores já em formato backend (para compatibilidade)
    'WEBSITE': 'WEBSITE',
    'SOCIAL_MEDIA': 'SOCIAL_MEDIA',
    'REFERRAL': 'REFERRAL',
    'EMAIL': 'EMAIL',
    'PHONE': 'PHONE',
    'OTHER': 'OTHER',
  };

  const normalizedSource = source.toLowerCase();
  return sourceMap[normalizedSource] || sourceMap[source] || 'WEBSITE';
}

// Mapeamento de status do backend para o frontend
export function mapStatusFromBackend(status: string): string {
  const statusMap: Record<string, string> = {
    'NEW': 'novo',
    'CONTACTED': 'contato',
    'QUALIFIED': 'contato', // Mapear para contato
    'PROPOSAL': 'contato', // Mapear para contato
    'NEGOTIATION': 'contato', // Mapear para contato
    'WON': 'fechado',
    'LOST': 'perdido',
  };

  return statusMap[status] || status.toLowerCase() || 'novo';
}

// Mapeamento de source do backend para o frontend
export function mapSourceFromBackend(source: string): string {
  const sourceMap: Record<string, string> = {
    'WEBSITE': 'organico',
    'SOCIAL_MEDIA': 'meta',
    'REFERRAL': 'organico',
    'EMAIL': 'manual',
    'PHONE': 'manual',
    'OTHER': 'manual',
  };

  return sourceMap[source] || source.toLowerCase() || 'organico';
}





