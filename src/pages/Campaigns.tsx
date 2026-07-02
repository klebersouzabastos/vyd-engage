import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Mail, Loader2, Trash2, BarChart3 } from 'lucide-react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { apiClient, type CampaignStatus } from '../services/api/client';
import { ScreenRibbon } from '@/contexts/RibbonContext';

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  SENDING: 'Enviando',
  SENT: 'Enviada',
  PAUSED: 'Pausada',
  CANCELLED: 'Cancelada',
};

const STATUS_CLASSES: Record<CampaignStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-green-100 text-green-700',
  PAUSED: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function pct(value?: number): string {
  if (value === undefined || value === null) return '—';
  return `${value.toFixed(1)}%`;
}

export function Campaigns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => apiClient.getCampaigns(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setDeleteId(null);
      toast.success('Campanha removida');
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao remover campanha'),
  });

  return (
    <div className="min-h-screen">
      <ScreenRibbon
        groups={[
          {
            label: 'Campanhas',
            items: [
              {
                icon: Plus,
                label: 'Nova Campanha',
                onClick: () => navigate('/app/campaigns/new'),
              },
            ],
          },
        ]}
      />
      <Header title="Campanhas de Email" subtitle="Crie, segmente e meça suas campanhas" />

      <div className="p-4 md:p-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-lg border border-gray-300 bg-card py-16 text-center">
            <Mail className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">Nenhuma campanha ainda</h3>
            <p className="mb-4 text-gray-500">Crie sua primeira campanha de email para começar.</p>
            <Button onClick={() => navigate('/app/campaigns/new')} className="gap-2">
              <Plus size={16} /> Nova Campanha
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-300 bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Enviados</th>
                  <th className="px-4 py-3 font-medium text-right">Abertura</th>
                  <th className="px-4 py-3 font-medium text-right">CTR</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/app/campaigns/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="truncate text-xs text-gray-500">{c.subject}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_CLASSES[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.sentCount ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(c.openRate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(c.ctr)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === 'SENT' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/campaigns/${c.id}`);
                            }}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="Ver resultados"
                          >
                            <BarChart3 size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(c.id);
                          }}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          title="Remover"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campanha?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
