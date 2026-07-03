import type { ColumnDef } from '@tanstack/react-table';
import { Building2, Globe, Users, Handshake, Pencil, Trash2 } from 'lucide-react';
import { Company, CompanySize } from '../../types';
import { ClientStatusBadge } from './CompanyBadges';

const SIZE_LABELS: Record<CompanySize, string> = {
  MICRO: 'Micro',
  SMALL: 'Pequena',
  MEDIUM: 'Média',
  LARGE: 'Grande',
  ENTERPRISE: 'Enterprise',
};

function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('pt-BR');
}

/** Column definitions for the companies list (DataTable). */
export function getCompanyColumns(handlers: {
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
}): ColumnDef<Company>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Nome',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'clientStatus',
      header: 'Status',
      cell: ({ row }) => <ClientStatusBadge status={row.original.clientStatus} />,
    },
    {
      accessorKey: 'domain',
      header: 'Domínio',
      cell: ({ row }) =>
        row.original.domain ? (
          <span className="flex items-center gap-1 text-sm text-gray-600">
            <Globe size={12} className="text-gray-400" />
            {row.original.domain}
          </span>
        ) : (
          <span className="text-sm text-gray-600">—</span>
        ),
    },
    {
      accessorKey: 'industry',
      header: 'Indústria',
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">{row.original.industry || '—'}</span>
      ),
    },
    {
      accessorKey: 'size',
      header: 'Porte',
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {row.original.size ? SIZE_LABELS[row.original.size] : '—'}
        </span>
      ),
    },
    {
      id: 'leads',
      header: 'Leads',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
          <Users size={12} className="text-gray-400" />
          {row.original._count?.leads ?? 0}
        </span>
      ),
    },
    {
      id: 'deals',
      header: 'Deals',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
          <Handshake size={12} className="text-gray-400" />
          {row.original._count?.deals ?? 0}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Criado em',
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const company = row.original;
        return (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- wrapper apenas impede o clique nos botões de propagar para a linha; não é um controle interativo e não precisa de handler de teclado
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handlers.onEdit(company)}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
              aria-label={`Editar empresa ${company.name}`}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            <button
              onClick={() => handlers.onDelete(company)}
              className="p-1.5 rounded hover:bg-red-100 text-gray-500 hover:text-red-600 transition-colors"
              aria-label={`Excluir empresa ${company.name}`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        );
      },
    },
  ];
}
