// Upgrade RD parity — P1 · F2 Aprovações (spec upgrade-rd-parity.md, req 15).
//
// Página "Aprovações" (rota /app/approvals, gated MANAGER_ROLES): fila de
// ApprovalRequest PENDING (tipo, solicitante, resumo, data, expira em) com ações
// Aprovar e Rejeitar (diálogo de motivo). Consome
// apiClient.{getApprovals,approveApproval,rejectApproval}.

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, ClipboardCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { apiClient, ApiError } from '../services/api/client';
import type { ApprovalRequest, ApprovalType } from '../types/governance';

const TYPE_LABEL: Record<ApprovalType, string> = {
  EXPORT: 'Exportação',
  BULK: 'Ação em massa',
  DELETE: 'Exclusão',
};

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

/** "expira em" relativo, em pt-BR, a partir de agora. */
function expiresInLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return '—';
  if (ms <= 0) return 'expirada';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `em ${days} dia${days > 1 ? 's' : ''}`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `em ${hours} hora${hours > 1 ? 's' : ''}`;
  const mins = Math.max(1, Math.floor(ms / (60 * 1000)));
  return `em ${mins} min`;
}

export function Approvals() {
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequest | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getApprovals('PENDING');
      setItems(res.data ?? []);
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Erro ao carregar aprovações.';
      toast.error(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (item: ApprovalRequest) => {
    setBusyId(item.id);
    try {
      await apiClient.approveApproval(item.id);
      toast.success('Solicitação aprovada e executada.');
      await load();
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Não foi possível aprovar.';
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (item: ApprovalRequest) => {
    setRejectTarget(item);
    setReason('');
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error('Informe o motivo da rejeição.');
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      await apiClient.rejectApproval(rejectTarget.id, trimmed);
      toast.success('Solicitação rejeitada.');
      setRejectTarget(null);
      setReason('');
      await load();
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Não foi possível rejeitar.';
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Aprovações"
        subtitle="Solicitações de exportação, ações em massa e exclusão aguardando sua decisão."
      />

      <div className="px-4 md:px-8 py-6">
        <div className="rounded-md border border-border bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
              <span className="ml-2 text-sm">Carregando…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <ClipboardCheck className="text-muted-foreground mb-3" size={32} />
              <p className="text-foreground font-medium">Nenhuma aprovação pendente</p>
              <p className="text-muted-foreground text-sm mt-1">
                Solicitações de export, ações em massa e exclusão aparecerão aqui.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="secondary">{TYPE_LABEL[item.type] ?? item.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground max-w-xs">
                      {item.summary}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.requestedBy?.name || item.requestedBy?.email || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={13} />
                        {expiresInLabel(item.expiresAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={busyId === item.id}
                          onClick={() => handleApprove(item)}
                        >
                          {busyId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          Aprovar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={busyId === item.id}
                          onClick={() => openReject(item)}
                        >
                          <XCircle size={14} />
                          Rejeitar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
            <DialogDescription>
              {rejectTarget ? rejectTarget.summary : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo da rejeição</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explique por que a solicitação foi rejeitada…"
              rows={4}
              maxLength={1000}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setReason('');
              }}
              disabled={busyId === rejectTarget?.id}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={busyId === rejectTarget?.id || !reason.trim()}
            >
              {busyId === rejectTarget?.id ? 'Rejeitando…' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
