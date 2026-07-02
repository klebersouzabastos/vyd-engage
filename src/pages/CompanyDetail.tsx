import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { PageSkeleton } from '../components/PageSkeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { CompanyForm } from '../components/CompanyForm';
import { EmpreendimentosManager } from '../components/comercial/EmpreendimentosManager';
import { Company, CompanySize } from '../types';
import { apiClient } from '../services/api/client';
import { ScreenRibbon } from '@/contexts/RibbonContext';
import {
  ArrowLeft,
  Building2,
  Globe,
  Phone,
  MapPin,
  Link as LinkIcon,
  FileText,
  Clock,
  Pencil,
  Users,
  Handshake,
  Mail,
  MessageSquare,
  Calendar,
  Zap,
  ArrowRightLeft,
} from 'lucide-react';

const SIZE_LABELS: Record<CompanySize, string> = {
  MICRO: 'Micro',
  SMALL: 'Pequena',
  MEDIUM: 'Media',
  LARGE: 'Grande',
  ENTERPRISE: 'Enterprise',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atras`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atras`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d atras`;
  return formatDateTime(dateStr);
}

function getInteractionIcon(type: string) {
  switch (type) {
    case 'EMAIL':
      return <Mail size={14} />;
    case 'WHATSAPP':
      return <MessageSquare size={14} />;
    case 'CALL':
      return <Phone size={14} />;
    case 'MEETING':
      return <Calendar size={14} />;
    case 'NOTE':
      return <FileText size={14} />;
    case 'STATUS_CHANGE':
      return <ArrowRightLeft size={14} />;
    case 'AUTOMATION':
      return <Zap size={14} />;
    default:
      return <FileText size={14} />;
  }
}

const STAGE_COLORS: Record<string, string> = {
  QUALIFICATION: 'bg-blue-100 text-blue-700',
  PROPOSAL: 'bg-yellow-100 text-yellow-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  CLOSING: 'bg-purple-100 text-purple-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  QUALIFIED: 'bg-green-100 text-green-700',
  PROPOSAL: 'bg-orange-100 text-orange-700',
  NEGOTIATION: 'bg-purple-100 text-purple-700',
  WON: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-red-100 text-red-700',
};

export function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'leads' | 'deals' | 'empreendimentos' | 'timeline' | 'info'
  >('leads');
  const [editFormOpen, setEditFormOpen] = useState(false);

  const fetchCompany = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingCompany(true);
      const result = await apiClient.getCompany(id);
      setCompany(result as Company);
    } catch {
      toast.error('Erro ao carregar empresa');
      navigate('/app/companies');
    } finally {
      setLoadingCompany(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const handleEditSave = async (data: Partial<Company>) => {
    if (!id) return;
    const result = await apiClient.updateCompany(id, data);
    setCompany(result as Company);
    setEditFormOpen(false);
    toast.success('Empresa atualizada!');
  };

  if (loadingCompany) {
    return (
      <div className="min-h-screen">
        <Header title="Empresa" />
        <PageSkeleton type="form" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen">
        <Header title="Empresa nao encontrada" />
        <div className="p-8 text-center">
          <p className="text-gray-600 mb-4">A empresa solicitada nao foi encontrada.</p>
          <Button onClick={() => navigate('/app/companies')}>
            <ArrowLeft size={16} className="mr-2" />
            Voltar para Empresas
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: 'leads' as const,
      label: 'Leads',
      count: company._count?.leads ?? company.leads?.length ?? 0,
    },
    {
      id: 'deals' as const,
      label: 'Deals',
      count: company._count?.deals ?? company.deals?.length ?? 0,
    },
    { id: 'empreendimentos' as const, label: 'Empreendimentos', count: null },
    { id: 'timeline' as const, label: 'Timeline', count: company.interactions?.length ?? 0 },
    { id: 'info' as const, label: 'Informacoes', count: null },
  ];

  return (
    <div className="min-h-screen">
      <ScreenRibbon
        groups={[
          {
            label: 'Empresa',
            items: [
              { icon: Pencil, label: 'Editar', onClick: () => setEditFormOpen(true) },
            ],
          },
        ]}
      />
      <Header title={company.name} subtitle="Detalhes da empresa" />

      <div className="p-8">
        <button
          onClick={() => navigate('/app/companies')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Voltar para Empresas</span>
        </button>

        {/* Company header card */}
        <div className="bg-card rounded-lg shadow-sm border border-gray-300 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={28} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                {company.industry && <span>{company.industry}</span>}
                {company.size && (
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                    {SIZE_LABELS[company.size]}
                  </span>
                )}
                {company.domain && (
                  <span className="flex items-center gap-1">
                    <Globe size={12} />
                    {company.domain}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <Users size={14} className="text-gray-400" />
              <span className="font-medium">{company._count?.leads ?? 0}</span>
              <span className="text-gray-500">leads</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Handshake size={14} className="text-gray-400" />
              <span className="font-medium">{company._count?.deals ?? 0}</span>
              <span className="text-gray-500">deals</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock size={14} className="text-gray-400" />
              Criada em {formatDate(company.createdAt)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'leads' && (
          <div className="bg-card rounded-lg shadow-sm border border-gray-300 overflow-hidden">
            {!company.leads || company.leads.length === 0 ? (
              <div className="text-center py-12">
                <Users size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Nenhum lead vinculado a esta empresa.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Nome
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Score
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Criado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {company.leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/leads/${lead.id}`)}
                    >
                      <td className="py-3 px-4 font-medium text-gray-900">{lead.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{lead.email || '\u2014'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{lead.score}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {formatDate(lead.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'deals' && (
          <div className="bg-card rounded-lg shadow-sm border border-gray-300 overflow-hidden">
            {!company.deals || company.deals.length === 0 ? (
              <div className="text-center py-12">
                <Handshake size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Nenhum deal vinculado a esta empresa.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Nome
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Valor
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Stage
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Probabilidade
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                      Criado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {company.deals.map((deal) => (
                    <tr
                      key={deal.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/deals/${deal.id}`)}
                    >
                      <td className="py-3 px-4 font-medium text-gray-900">{deal.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 font-medium">
                        {Number(deal.value).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[deal.stage] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {deal.stage}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{deal.probability}%</td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {formatDate(deal.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'empreendimentos' && id && <EmpreendimentosManager companyId={id} />}

        {activeTab === 'timeline' && (
          <div className="bg-card rounded-lg shadow-sm border border-gray-300 p-6">
            {!company.interactions || company.interactions.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma interacao registrada.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-1">
                  {company.interactions.map((interaction) => (
                    <div key={interaction.id} className="relative flex gap-4 py-3 pl-2">
                      <div className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                        {getInteractionIcon(interaction.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {interaction.type}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">
                            {formatRelativeTime(interaction.createdAt)}
                          </span>
                        </div>
                        {interaction.subject && (
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            {interaction.subject}
                          </p>
                        )}
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">
                          {interaction.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="bg-card rounded-lg shadow-sm border border-gray-300 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoItem icon={<Building2 size={16} />} label="Nome" value={company.name} />
              <InfoItem icon={<Globe size={16} />} label="Dominio" value={company.domain} />
              <InfoItem icon={<FileText size={16} />} label="Industria" value={company.industry} />
              <InfoItem
                icon={<Building2 size={16} />}
                label="Porte"
                value={company.size ? SIZE_LABELS[company.size] : null}
              />
              <InfoItem icon={<Phone size={16} />} label="Telefone" value={company.phone} />
              <InfoItem
                icon={<LinkIcon size={16} />}
                label="Website"
                value={company.website}
                isLink
              />
              <div className="col-span-full">
                <InfoItem icon={<MapPin size={16} />} label="Endereco" value={company.address} />
              </div>
              {company.notes && (
                <div className="col-span-full">
                  <InfoItem icon={<FileText size={16} />} label="Notas" value={company.notes} />
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock size={12} />
                <span>Criada em: {formatDateTime(company.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock size={12} />
                <span>Atualizada em: {formatDateTime(company.updatedAt)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit form dialog */}
      <Dialog
        open={editFormOpen}
        onOpenChange={(open) => {
          if (!open) setEditFormOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>
          <CompanyForm
            company={company}
            onSave={handleEditSave}
            onCancel={() => setEditFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  isLink,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  isLink?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <span className="text-xs text-gray-500 block mb-0.5">{label}</span>
        {value ? (
          isLink ? (
            <a
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              {value}
            </a>
          ) : (
            <span className="text-sm text-gray-900">{value}</span>
          )
        ) : (
          <span className="text-sm text-gray-400">{'\u2014'}</span>
        )}
      </div>
    </div>
  );
}
