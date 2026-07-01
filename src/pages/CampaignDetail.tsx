import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Download, Loader2, Eye } from 'lucide-react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { CampaignPreview } from '../components/campaigns/CampaignPreview';
import { CHART_COLORS } from '@/utils/designTokens';
import {
  apiClient,
  type CampaignStatus,
  type CampaignStats,
  type CampaignRecipientRow,
} from '../services/api/client';

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  SENDING: 'Enviando',
  SENT: 'Enviada',
  PAUSED: 'Pausada',
  CANCELLED: 'Cancelada',
};

const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  sent: 'Enviado',
  delivered: 'Entregue',
  opened: 'Aberto',
  clicked: 'Clicado',
  unsubscribed: 'Descadastrado',
  bounced: 'Bounce',
  error: 'Erro',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

/** Escapes a value for CSV (quotes when it contains comma, quote or newline). */
function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Builds and downloads a CSV of the recipients list with their events (req 33). */
function exportRecipientsCsv(campaignName: string, recipients: CampaignRecipientRow[]) {
  const header = ['Nome', 'Email', 'Status', 'Data de abertura'];
  const rows = recipients.map((r) => [
    csvCell(r.name),
    csvCell(r.email),
    csvCell(RECIPIENT_STATUS_LABELS[r.status] ?? r.status),
    csvCell(formatDateTime(r.openedAt)),
  ]);
  const csv = [header, ...rows].map((cols) => cols.join(',')).join('\r\n');
  // Prepend BOM so Excel reads UTF-8 accents correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = campaignName.replace(/\s+/g, '_') || 'campanha';
  link.download = `${safeName}_destinatarios_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => apiClient.getCampaign(id!),
    enabled: !!id,
  });

  const isSent = campaign?.status === 'SENT';

  // Results are only fetched/available after the campaign was sent (req 28).
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => apiClient.getCampaignStats(id!),
    enabled: !!id && isSent,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header title="Campanha" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen">
        <Header title="Campanha" />
        <div className="p-8 text-center text-gray-500">Campanha não encontrada.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={campaign.name} subtitle={campaign.subject} />

      <div className="p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/app/campaigns')} className="gap-2">
            <ArrowLeft size={16} /> Voltar
          </Button>
          <Badge>{STATUS_LABELS[campaign.status]}</Badge>
        </div>

        <Tabs defaultValue={isSent ? 'results' : 'overview'}>
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            {/* Results tab is only available after the campaign has been sent (req 28). */}
            {isSent && <TabsTrigger value="results">Resultados</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-gray-200 bg-card p-5 text-sm">
                <div>
                  <span className="text-gray-500">Remetente: </span>
                  {campaign.fromName || '—'}
                  {campaign.fromEmail ? ` <${campaign.fromEmail}>` : ''}
                </div>
                <div>
                  <span className="text-gray-500">Assunto: </span>
                  {campaign.subject}
                </div>
                <div>
                  <span className="text-gray-500">Status: </span>
                  {STATUS_LABELS[campaign.status]}
                </div>
                {campaign.scheduledAt && (
                  <div>
                    <span className="text-gray-500">Agendada para: </span>
                    {formatDateTime(campaign.scheduledAt)}
                  </div>
                )}
                {campaign.sentAt && (
                  <div>
                    <span className="text-gray-500">Enviada em: </span>
                    {formatDateTime(campaign.sentAt)}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Eye size={16} /> Pré-visualização
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <CampaignPreview blocks={campaign.blocks ?? []} />
                </div>
              </div>
            </div>
          </TabsContent>

          {isSent && (
            <TabsContent value="results" className="pt-4">
              {statsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : stats ? (
                <ResultsPanel campaignName={campaign.name} stats={stats} />
              ) : (
                <div className="py-16 text-center text-gray-500">
                  Não foi possível carregar os resultados.
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

function ResultsPanel({ campaignName, stats }: { campaignName: string; stats: CampaignStats }) {
  const chartData = useMemo(
    () => stats.timeline.map((t) => ({ hour: t.hour, opens: t.opens })),
    [stats.timeline]
  );

  return (
    <div className="space-y-6">
      {/* Metrics (req 29) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Enviados" value={stats.sent} />
        <MetricCard label="Entregues" value={stats.delivered} />
        <MetricCard label="Abertos" value={stats.opened} />
        <MetricCard label="Cliques" value={stats.clicked} />
        <MetricCard label="Descadastros" value={stats.unsubscribed} />
        <MetricCard label="Bounces" value={stats.bounced} />
      </div>

      {/* Rates (req 30) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Taxa de abertura" value={`${stats.openRate.toFixed(1)}%`} />
        <MetricCard label="CTR" value={`${stats.ctr.toFixed(1)}%`} />
        <MetricCard label="Taxa de descadastro" value={`${stats.unsubRate.toFixed(1)}%`} />
      </div>

      {/* Opens-by-hour chart, first 48h (req 32) */}
      <div className="rounded-lg border border-gray-200 bg-card p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-900">
          Aberturas por hora (primeiras 48h)
        </h3>
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Sem dados de abertura.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="opens" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recipients table (req 31) + CSV export (req 33) */}
      <div className="rounded-lg border border-gray-200 bg-card">
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900">
            Destinatários ({stats.recipients.length})
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportRecipientsCsv(campaignName, stats.recipients)}
          >
            <Download size={14} /> Exportar CSV
          </Button>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Data de abertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.recipients.map((r) => (
                <tr key={r.leadId}>
                  <td className="px-4 py-2.5 text-gray-900">{r.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.email}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {RECIPIENT_STATUS_LABELS[r.status] ?? r.status}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{formatDateTime(r.openedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
