import { Badge } from '../ui/badge';
import type { DeepResearchStatus } from '../../types/deepResearch';

const STATUS_MAP: Record<DeepResearchStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Rascunho', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  RESEARCHING: { label: 'Pesquisando', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  COMPLETED: { label: 'Concluída', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  FAILED: { label: 'Falhou', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

export function StatusBadge({ status }: { status: DeepResearchStatus }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.DRAFT;
  return (
    <Badge variant="secondary" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
