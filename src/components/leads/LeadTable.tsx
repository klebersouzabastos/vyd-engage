import React from 'react';
import { useNavigate, Link } from 'react-router';
import { Checkbox } from '../ui/checkbox';
import { LeadStatusBadge } from '../LeadStatusBadge';
import { LeadSourceBadge } from '../LeadSourceBadge';
import { LeadScoreBadge } from '../LeadScoreBadge';
import { TagBadge } from '../TagBadge';
import { CustomFieldDisplay } from '../CustomFieldDisplay';
import { Pencil, Trash2, Mail, MessageSquare } from 'lucide-react';
import { NextActionBadge } from './NextActionBadge';
import type { Lead, CustomField, Tag } from '../../types';

interface Automation {
  id: number;
  name: string;
  type: 'whatsapp' | 'email';
  status: 'active' | 'paused';
}

interface LeadTableProps {
  leads: Lead[];
  selectedLeads: string[];
  customFields: CustomField[];
  expandedLeads: Set<string>;
  onSelectAll: () => void;
  onSelectLead: (id: string) => void;
  onDeleteLead: (id: string) => void;
  onScoreClick: (leadId: string) => void;
  onToggleExpansion: (leadId: string) => void;
  getTagById: (id: string) => Tag | undefined;
  getAutomationById: (id: number) => Automation | undefined;
  onRowClick?: (leadId: string) => void;
}

function hasCustomFields(lead: Lead): boolean {
  return (
    lead.customFields &&
    Object.keys(lead.customFields).length > 0 &&
    Object.values(lead.customFields).some((v) => v !== null && v !== undefined && v !== '')
  );
}

export function LeadTable({
  leads,
  selectedLeads,
  customFields,
  expandedLeads,
  onSelectAll,
  onSelectLead,
  onDeleteLead,
  onScoreClick,
  onToggleExpansion,
  getTagById,
  getAutomationById,
  onRowClick,
}: LeadTableProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" aria-label="Lista de leads">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th scope="col" className="px-6 py-3 text-left">
                <Checkbox
                  checked={
                    leads.length > 0 && leads.every((lead) => selectedLeads.includes(lead.id))
                  }
                  onCheckedChange={onSelectAll}
                  aria-label="Selecionar todos os leads"
                />
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
              >
                Nome
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell"
              >
                Telefone
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell"
              >
                E-mail
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
              >
                Score
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell"
              >
                Origem
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell"
              >
                Tags
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden xl:table-cell"
              >
                Automações
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell"
              >
                Data
              </th>
              {customFields.length > 0 && (
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden xl:table-cell"
                >
                  Campos Customizados
                </th>
              )}
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
              >
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            {leads.map((lead) => (
              <React.Fragment key={lead.id}>
                <tr
                  className={`hover:bg-gray-100 transition-colors${onRowClick ? ' cursor-pointer' : ''}`}
                  onClick={onRowClick ? () => onRowClick(lead.id) : undefined}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => onSelectLead(lead.id)}
                      aria-label={`Selecionar ${lead.name}`}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {onRowClick ? (
                        <span className="font-medium text-gray-900 hover:text-primary transition-colors">
                          {lead.name}
                        </span>
                      ) : (
                        <Link
                          to={`/app/leads/${lead.id}`}
                          className="font-medium text-gray-900 hover:text-primary hover:underline transition-colors"
                        >
                          {lead.name}
                        </Link>
                      )}
                      {/* AI next-action suggestion (icon + reasoning tooltip) */}
                      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- wrapper apenas impede a propagação do clique para a linha; não é um controle interativo */}
                      <span
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <NextActionBadge leadId={lead.id} variant="icon" />
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 hidden md:table-cell">{lead.phone}</td>
                  <td className="px-6 py-4 text-gray-600 hidden md:table-cell">{lead.email}</td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onScoreClick(lead.id)}
                      className="cursor-pointer"
                    >
                      <LeadScoreBadge score={lead.score || 0} />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <LeadSourceBadge source={lead.source} />
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    {lead.tags && lead.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {lead.tags.slice(0, 3).map((tagId: string) => {
                          const tag = getTagById(tagId);
                          if (!tag) return null;
                          return <TagBadge key={tagId} tag={tag} size="sm" />;
                        })}
                        {lead.tags.length > 3 && (
                          <span className="text-xs text-gray-600">+{lead.tags.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden xl:table-cell">
                    {(lead as any).automations && (lead as any).automations.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {(lead as any).automations.slice(0, 2).map((automationId: number) => {
                          const automation = getAutomationById(automationId);
                          if (!automation) return null;
                          return (
                            <div
                              key={automationId}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                                automation.type === 'whatsapp'
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                              title={automation.name}
                            >
                              {automation.type === 'whatsapp' ? (
                                <MessageSquare size={12} className="flex-shrink-0" />
                              ) : (
                                <Mail size={12} className="flex-shrink-0" />
                              )}
                              <span className="whitespace-nowrap">
                                {automation.name.length > 15
                                  ? automation.name.substring(0, 15) + '...'
                                  : automation.name}
                              </span>
                            </div>
                          );
                        })}
                        {(lead as any).automations.length > 2 && (
                          <div
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200"
                            title={`Mais ${(lead as any).automations.length - 2} automação(ões)`}
                          >
                            +{(lead as any).automations.length - 2}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600 hidden lg:table-cell">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  {customFields.length > 0 && (
                    <td className="px-6 py-4 hidden xl:table-cell">
                      {hasCustomFields(lead) ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {customFields.slice(0, 2).map((field) => {
                              const value = lead.customFields?.[field.id];
                              if (!value || value === '' || value === null || value === undefined)
                                return null;
                              return (
                                <div
                                  key={field.id}
                                  className="text-xs px-2 py-1 bg-gray-100 border border-gray-300 rounded text-gray-600"
                                  title={`${field.name}: ${value}`}
                                >
                                  <span className="font-medium">{field.name}:</span>{' '}
                                  <span className="text-gray-900">
                                    {typeof value === 'boolean'
                                      ? value
                                        ? 'Sim'
                                        : 'Não'
                                      : String(value).substring(0, 15)}
                                    {String(value).length > 15 ? '...' : ''}
                                  </span>
                                </div>
                              );
                            })}
                            {customFields.filter((f) => {
                              const value = lead.customFields?.[f.id];
                              return value && value !== '' && value !== null && value !== undefined;
                            }).length > 2 && (
                              <button
                                onClick={() => onToggleExpansion(lead.id)}
                                className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                              >
                                {expandedLeads.has(lead.id) ? 'Ocultar' : 'Ver mais'}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/app/leads/${lead.id}/edit`);
                        }}
                        className="p-1.5 hover:bg-gray-300 rounded transition-colors"
                        type="button"
                        aria-label={`Editar ${lead.name}`}
                      >
                        <Pencil size={16} className="text-gray-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteLead(lead.id);
                        }}
                        className="p-1.5 hover:bg-red-50 rounded transition-colors"
                        type="button"
                        aria-label={`Deletar ${lead.name}`}
                      >
                        <Trash2 size={16} className="text-error" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedLeads.has(lead.id) && hasCustomFields(lead) && (
                  <tr className="bg-gray-100">
                    <td colSpan={customFields.length > 0 ? 12 : 11} className="px-6 py-4">
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                          Campos Customizados
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {customFields.map((field) => {
                            const value = lead.customFields?.[field.id];
                            if (!value && value !== false && value !== 0) return null;
                            return (
                              <CustomFieldDisplay
                                key={field.id}
                                field={field}
                                value={value}
                                mode="full"
                                showLabel={true}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
