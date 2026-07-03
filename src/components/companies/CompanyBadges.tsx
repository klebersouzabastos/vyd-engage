import { Badge } from '../ui/badge';
import { ClientStatus, ContractHolder } from '../../types';

/**
 * Badges do módulo Follow-up de Clientes & Contratos (100% tokens semânticos —
 * arquivo em STRICT_SCOPE do check:colors).
 */

const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  PROSPECT: 'Prospect',
  CLIENTE_ATIVO: 'Cliente ativo',
  INATIVO: 'Inativo',
};

const CLIENT_STATUS_CLASSES: Record<ClientStatus, string> = {
  PROSPECT: 'bg-info/15 text-info border-transparent',
  CLIENTE_ATIVO: 'bg-success/15 text-success border-transparent',
  INATIVO: 'bg-muted text-muted-foreground border-transparent',
};

export function ClientStatusBadge({ status }: { status?: ClientStatus | null }) {
  const value = status || 'PROSPECT';
  return <Badge className={CLIENT_STATUS_CLASSES[value]}>{CLIENT_STATUS_LABELS[value]}</Badge>;
}

export function ContractHolderBadge({
  holder,
  competitor,
}: {
  holder?: ContractHolder | null;
  competitor?: string | null;
}) {
  if (!holder || holder === 'NENHUM') {
    return <Badge className="bg-muted text-muted-foreground border-transparent">Sem contrato</Badge>;
  }
  if (holder === 'NOS') {
    return <Badge className="bg-success/15 text-success border-transparent">Nós</Badge>;
  }
  return (
    <Badge className="bg-warning/15 text-warning border-transparent">
      {competitor ? `Concorrente: ${competitor}` : 'Concorrente'}
    </Badge>
  );
}

/** Badge de contrato vencido — token de perigo (req 11). */
export function ContractExpiredBadge() {
  return <Badge variant="destructive">Vencido</Badge>;
}
