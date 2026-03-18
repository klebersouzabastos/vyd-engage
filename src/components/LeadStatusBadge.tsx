interface LeadStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  novo: {
    label: 'Novo',
    className: 'badge-status-novo',
  },
  contato: {
    label: 'Em Contato',
    className: 'badge-status-contato',
  },
  fechado: {
    label: 'Fechado',
    className: 'badge-status-fechado',
  },
  perdido: {
    label: 'Perdido',
    className: 'badge-status-perdido',
  },
};

// Mapeamento de valores alternativos para os status padrão
const statusMapping: Record<string, string> = {
  'em contato': 'contato',
  'em_contato': 'contato',
};

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  // Normalizar o status para lowercase e mapear valores alternativos
  const normalizedStatus = statusMapping[status.toLowerCase()] || status.toLowerCase();
  const config = statusConfig[normalizedStatus] || {
    label: status || 'Desconhecido',
    className: 'bg-gray-100 text-gray-700',
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      <span className="sr-only">Status: </span>
      {config.label}
    </span>
  );
}
