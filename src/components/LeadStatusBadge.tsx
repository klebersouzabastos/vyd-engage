interface LeadStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  novo: {
    label: 'Novo',
    className: 'bg-blue-100 text-blue-700',
  },
  contato: {
    label: 'Em Contato',
    className: 'bg-yellow-100 text-yellow-700',
  },
  fechado: {
    label: 'Fechado',
    className: 'bg-green-100 text-green-700',
  },
  perdido: {
    label: 'Perdido',
    className: 'bg-red-100 text-red-700',
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
      {config.label}
    </span>
  );
}
