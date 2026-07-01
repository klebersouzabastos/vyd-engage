import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { apiClient } from '../services/api/client';

interface BreakdownRow {
  ruleId: string;
  ruleName: string;
  event: string;
  pointsPerEvent: number;
  eventCount: number;
  totalPoints: number;
}

interface ScoreBreakdownData {
  leadId: string;
  leadName: string;
  totalScore: number;
  breakdown: BreakdownRow[];
  calculatedScore: number;
}

interface ScoreBreakdownModalProps {
  leadId: string;
  open: boolean;
  onClose: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-700 bg-green-100';
  if (score >= 40) return 'text-yellow-700 bg-yellow-100';
  if (score > 0) return 'text-red-700 bg-red-100';
  return 'text-gray-600 bg-gray-100';
}

const EVENT_LABELS: Record<string, string> = {
  LEAD_CREATED: 'Lead Criado',
  STATUS_CHANGED: 'Status Alterado',
  TAG_ADDED: 'Tag Adicionada',
  INTERACTION_CREATED: 'Interacao Criada',
  EMAIL_OPENED: 'E-mail Aberto',
  EMAIL_CLICKED: 'E-mail Clicado',
  WHATSAPP_REPLIED: 'WhatsApp Respondido',
  FORM_SUBMITTED: 'Formulario Enviado',
};

export function ScoreBreakdownModal({ leadId, open, onClose }: ScoreBreakdownModalProps) {
  const [data, setData] = useState<ScoreBreakdownData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !leadId) {
      setData(null);
      return;
    }

    const fetchBreakdown = async () => {
      setLoading(true);
      try {
        const response = await apiClient.getScoreBreakdown(leadId);
        setData(response.data || response);
      } catch (error: any) {
        console.error('Erro ao carregar breakdown do score:', error);
        toast.error('Erro ao carregar detalhes do score');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, [open, leadId, onClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card">
        <DialogHeader className="text-left space-y-0 pb-4">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Detalhes do Score
          </DialogTitle>
          {data && (
            <p className="text-sm text-gray-500 mt-1">
              {data.leadName} &mdash;{' '}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getScoreColor(data.totalScore)}`}
              >
                {data.totalScore} pts
              </span>
            </p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {data.breakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Breakdown do score">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-3 text-xs font-medium text-gray-500 uppercase">
                        Regra
                      </th>
                      <th className="text-left py-2 pr-3 text-xs font-medium text-gray-500 uppercase">
                        Evento
                      </th>
                      <th className="text-right py-2 pr-3 text-xs font-medium text-gray-500 uppercase">
                        Pts/Evento
                      </th>
                      <th className="text-right py-2 pr-3 text-xs font-medium text-gray-500 uppercase">
                        Qtd
                      </th>
                      <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.breakdown.map((row) => (
                      <tr key={row.ruleId} className="hover:bg-gray-50">
                        <td className="py-2 pr-3 text-gray-900 font-medium">{row.ruleName}</td>
                        <td className="py-2 pr-3 text-gray-600">
                          {EVENT_LABELS[row.event] || row.event}
                        </td>
                        <td className="py-2 pr-3 text-right text-gray-600">{row.pointsPerEvent}</td>
                        <td className="py-2 pr-3 text-right text-gray-600">{row.eventCount}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">
                          {row.totalPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300">
                      <td colSpan={4} className="py-2 pr-3 text-right font-semibold text-gray-900">
                        Score Calculado
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getScoreColor(data.calculatedScore)}`}
                        >
                          {data.calculatedScore} pts
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  Nenhuma regra de score contribuiu para este lead.
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Configure regras de scoring em Configuracoes para calcular o score
                  automaticamente.
                </p>
              </div>
            )}

            {data.totalScore !== data.calculatedScore && data.breakdown.length > 0 && (
              <p className="text-xs text-gray-400 italic">
                O score armazenado ({data.totalScore}) pode diferir do calculado (
                {data.calculatedScore}) se regras foram alteradas desde o ultimo calculo.
              </p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
