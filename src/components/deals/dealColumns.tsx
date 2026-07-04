import type { ColumnDef } from '@tanstack/react-table';
import { Calendar, User, Pencil, Trash2 } from 'lucide-react';
import { Deal } from '../../types';
import type { QualificationLevel } from '../../types/sales';
import { DealStageBadge } from './DealStageBadge';
import { QualificationStars } from './QualificationStars';
import { formatCurrency } from '../../utils/format';

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR');
}

/** Column definitions for the deals list (DataTable). Handlers are injected so the
 *  action cell can edit/delete without the columns owning page state. */
export function getDealColumns(
  handlers: {
    onEdit: (deal: Deal) => void;
    onDelete: (deal: Deal) => void;
  },
  /** Níveis de qualificação do tenant — tooltip com o nome do nível (req 1). */
  qualificationLevels?: QualificationLevel[]
): ColumnDef<Deal>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Nome',
      cell: ({ row }) => <span className="font-medium text-gray-900">{row.original.name}</span>,
    },
    {
      accessorKey: 'value',
      header: 'Valor',
      cell: ({ row }) => (
        <span className="text-sm text-gray-700 font-medium">
          {formatCurrency(row.original.value)}
        </span>
      ),
    },
    {
      accessorKey: 'stage',
      header: 'Stage',
      enableSorting: false,
      cell: ({ row }) => <DealStageBadge stage={row.original.stage} />,
    },
    {
      accessorKey: 'probability',
      header: 'Probabilidade',
      cell: ({ row }) => <span className="text-sm text-gray-600">{row.original.probability}%</span>,
    },
    {
      accessorKey: 'qualification',
      header: 'Qualificação',
      cell: ({ row }) => {
        const q = row.original.qualification ?? 0;
        return q > 0 ? (
          <QualificationStars value={q} levels={qualificationLevels} size={12} />
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
      },
    },
    {
      accessorKey: 'expectedCloseDate',
      header: 'Fechamento',
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-sm text-gray-600">
          <Calendar size={12} className="text-gray-400" />
          {formatDate(row.original.expectedCloseDate)}
        </span>
      ),
    },
    {
      id: 'lead',
      header: 'Lead',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">{row.original.lead?.name || '—'}</span>
      ),
    },
    {
      id: 'assignedUser',
      header: 'Responsável',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-sm text-gray-600">
          <User size={12} className="text-gray-400" />
          {row.original.assignedUser?.name || '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const deal = row.original;
        return (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- onClick apenas faz stopPropagation (impede o clique propagar para a linha); não é uma ação ativável, então não há teclado a espelhar nem deve virar tab stop
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handlers.onEdit(deal)}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
              aria-label={`Editar deal ${deal.name}`}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            <button
              onClick={() => handlers.onDelete(deal)}
              className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
              aria-label={`Excluir deal ${deal.name}`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        );
      },
    },
  ];
}
