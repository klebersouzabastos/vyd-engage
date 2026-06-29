import { Deal } from '../../types';
import { User, Calendar, Building2, Star, CheckSquare } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { cn } from '../ui/utils';
import { DealAIScore } from './DealAIScore';

function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Badge de status da negociação (req 35) — só exibido quando não está "em andamento".
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  WON: { label: 'Ganho', cls: 'bg-green-100 text-green-700' },
  LOST: { label: 'Perdido', cls: 'bg-red-100 text-red-700' },
  PAUSED: { label: 'Pausado', cls: 'bg-amber-50 text-amber-700' },
};

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  onEdit: () => void;
  isStale?: boolean;
  isOverlay?: boolean;
}

export function DealCard({ deal, onClick, onEdit: _onEdit, isStale, isOverlay }: DealCardProps) {
  const statusBadge =
    deal.status && deal.status !== 'OPEN' ? STATUS_BADGE[deal.status] : undefined;
  const qual = deal.qualification ?? 0;
  const taskCount = deal.taskCount ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.key === ' ') e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'relative bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none',
        isOverlay ? 'shadow-lg border-primary ring-2 ring-primary/20' : 'border-gray-200'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-gray-900 truncate flex-1">{deal.name}</h4>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {statusBadge && (
            <span
              className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${statusBadge.cls}`}
            >
              {statusBadge.label}
            </span>
          )}
          {isStale && (
            <span className="text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              Esfriando
            </span>
          )}
          {/* AI close-propensity gauge — display-only: renders the STORED score
              already on the deal, never triggers a per-card AI call (reqs 18, 35).
              Skipped on the drag ghost. */}
          {!isOverlay && (
            <DealAIScore value={deal.aiScore} factors={deal.aiScoreFactors} size="sm" />
          )}
        </div>
      </div>

      {deal.lead?.company && (
        <p
          className="text-xs text-gray-500 truncate flex items-center gap-1 mb-2"
          title={deal.lead.company}
        >
          <Building2 size={10} />
          {deal.lead.company}
        </p>
      )}

      <p className="text-sm font-bold text-gray-800 mb-2">{formatCurrency(deal.value)}</p>

      {qual > 0 && (
        <div className="flex items-center gap-1 text-amber-700 mb-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={10} fill={n <= qual ? 'currentColor' : 'none'} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {deal.lead && (
            <span className="truncate max-w-[100px]" title={deal.lead.name}>
              {deal.lead.name}
            </span>
          )}
        </div>
        <span className="text-gray-400">{deal.probability}%</span>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        {deal.assignedUser && (
          <span className="flex items-center gap-1">
            <User size={10} />
            {deal.assignedUser.name.split(' ')[0]}
          </span>
        )}
        <span className="flex items-center gap-3 ml-auto">
          {taskCount > 0 && (
            <span className="flex items-center gap-1" title={`${taskCount} tarefa(s)`}>
              <CheckSquare size={10} />
              {taskCount}
            </span>
          )}
          {deal.expectedCloseDate && (
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {formatDate(deal.expectedCloseDate)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
