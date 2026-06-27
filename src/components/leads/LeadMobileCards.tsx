import { useNavigate, Link } from 'react-router';
import { Checkbox } from '../ui/checkbox';
import { LeadStatusBadge } from '../LeadStatusBadge';
import { LeadSourceBadge } from '../LeadSourceBadge';
import { LeadScoreBadge } from '../LeadScoreBadge';
import { TagBadge } from '../TagBadge';
import { Pencil, Trash2 } from 'lucide-react';
import { NextActionBadge } from './NextActionBadge';
import type { Lead, Tag } from '../../types';

interface LeadMobileCardsProps {
  leads: Lead[];
  selectedLeads: string[];
  onSelectLead: (id: string) => void;
  onDeleteLead: (id: string) => void;
  onScoreClick: (leadId: string) => void;
  getTagById: (id: string) => Tag | undefined;
}

export function LeadMobileCards({
  leads,
  selectedLeads,
  onSelectLead,
  onDeleteLead,
  onScoreClick,
  getTagById,
}: LeadMobileCardsProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3 mb-4">
      {leads.map((lead) => (
        <div key={lead.id} className="bg-white rounded-lg shadow-sm border border-gray-300 p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Checkbox
                checked={selectedLeads.includes(lead.id)}
                onCheckedChange={() => onSelectLead(lead.id)}
                aria-label={`Selecionar ${lead.name}`}
              />
              <Link
                to={`/app/leads/${lead.id}`}
                className="font-medium text-gray-900 hover:text-primary hover:underline transition-colors truncate"
              >
                {lead.name}
              </Link>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <button
                onClick={() => navigate(`/app/leads/${lead.id}/edit`)}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                type="button"
                aria-label={`Editar ${lead.name}`}
              >
                <Pencil size={14} className="text-gray-600" />
              </button>
              <button
                onClick={() => onDeleteLead(lead.id)}
                className="p-1.5 hover:bg-red-50 rounded transition-colors"
                type="button"
                aria-label={`Deletar ${lead.name}`}
              >
                <Trash2 size={14} className="text-error" />
              </button>
            </div>
          </div>
          <div className="ml-7 space-y-1.5">
            {lead.email && <p className="text-sm text-gray-600 truncate">{lead.email}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              <LeadStatusBadge status={lead.status} />
              <button
                type="button"
                onClick={() => onScoreClick(lead.id)}
                className="cursor-pointer"
              >
                <LeadScoreBadge score={lead.score || 0} />
              </button>
              <LeadSourceBadge source={lead.source} />
              {/* AI next-action suggestion (icon + reasoning tooltip) */}
              <NextActionBadge leadId={lead.id} variant="icon" />
            </div>
            {lead.tags && lead.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {lead.tags.slice(0, 3).map((tagId: string) => {
                  const tag = getTagById(tagId);
                  if (!tag) return null;
                  return <TagBadge key={tagId} tag={tag} size="sm" />;
                })}
                {lead.tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{lead.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
