import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Phone, PhoneOff, Loader2, PhoneCall } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { toast } from 'sonner';
import type { LogCallInput } from '../../types/documents';

interface CallButtonProps {
  /** Número a discar (ex.: telefone do lead/contato). */
  phone: string;
  /** Vínculo da ligação — ao menos um deve ser informado. */
  leadId?: string;
  dealId?: string;
  companyId?: string;
  /** Recarrega a timeline após registrar a ligação. */
  onLogged?: () => void;
  /** Rótulo opcional do botão; padrão "Ligar". */
  label?: string;
  size?: 'sm' | 'default';
  className?: string;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Click-to-call (req 21, F3).
 *
 * GATING GRACIOSO: o botão só é renderizado quando a telefonia está configurada
 * (getPhoneStatus.configured). Sem credencial, nada é renderizado — o link `tel:`
 * existente permanece como fallback.
 *
 * Dialer mínimo (sem SDK real): ao "ligar", um cronômetro conta a duração;
 * ao encerrar, a ligação é registrada via /phone/log-call (Interaction CALL
 * OUTBOUND) com duração e URL de gravação opcional. A timeline é atualizada.
 */
export function CallButton({
  phone,
  leadId,
  dealId,
  companyId,
  onLogged,
  label = 'Ligar',
  size = 'sm',
  className,
}: CallButtonProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [manualDuration, setManualDuration] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [logging, setLogging] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    apiClient
      .getPhoneStatus()
      .then(({ data }) => {
        if (alive) setConfigured(!!data?.configured);
      })
      .catch(() => {
        if (alive) setConfigured(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const resetDialer = useCallback(() => {
    stopTimer();
    setInCall(false);
    setElapsed(0);
    setManualDuration('');
    setRecordingUrl('');
  }, [stopTimer]);

  const handleOpen = () => {
    resetDialer();
    setOpen(true);
  };

  const startCall = () => {
    setInCall(true);
    setElapsed(0);
    stopTimer();
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const endCall = () => {
    stopTimer();
    setInCall(false);
    // Preenche a duração informada com o tempo cronometrado (editável).
    setManualDuration(String(elapsed));
  };

  const handleLog = async () => {
    // Prioriza a duração informada; cai para o cronômetro.
    const parsed = parseInt(manualDuration, 10);
    const durationSec = Number.isFinite(parsed) && parsed >= 0 ? parsed : elapsed;
    const payload: LogCallInput = {
      leadId,
      dealId,
      companyId,
      toNumber: phone,
      durationSec,
      recordingUrl: recordingUrl.trim() || undefined,
    };
    setLogging(true);
    try {
      await apiClient.logCall(payload);
      toast.success('Ligação registrada na timeline.');
      setOpen(false);
      resetDialer();
      onLogged?.();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao registrar a ligação.');
    } finally {
      setLogging(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetDialer();
  };

  // Gating: enquanto carrega ou se não configurado, não renderiza nada.
  if (!configured) return null;

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={className ? `gap-2 ${className}` : 'gap-2'}
        onClick={handleOpen}
      >
        <Phone size={14} />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ligar para {phone}</DialogTitle>
            <DialogDescription>
              Inicie a ligação e, ao encerrar, registre o desfecho na timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Estado da chamada + cronômetro */}
            <div className="flex flex-col items-center justify-center gap-2 py-4 rounded-lg border border-border bg-muted">
              <span className="text-2xl font-mono tabular-nums text-foreground">
                {formatDuration(inCall ? elapsed : parseInt(manualDuration, 10) || elapsed)}
              </span>
              <span className="text-xs text-muted-foreground">
                {inCall ? 'Em ligação…' : elapsed > 0 ? 'Ligação encerrada' : 'Pronto para discar'}
              </span>
              <div className="mt-1">
                {inCall ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive"
                    onClick={endCall}
                  >
                    <PhoneOff size={14} />
                    Encerrar
                  </Button>
                ) : (
                  <Button size="sm" className="gap-2" onClick={startCall}>
                    <PhoneCall size={14} />
                    {elapsed > 0 ? 'Ligar novamente' : 'Iniciar ligação'}
                  </Button>
                )}
              </div>
            </div>

            {/* Duração informada (editável) */}
            <div>
              <Label htmlFor="call-duration" className="mb-1 block">
                Duração (segundos)
              </Label>
              <Input
                id="call-duration"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={manualDuration}
                onChange={(e) => setManualDuration(e.target.value)}
                disabled={inCall}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Preenchida automaticamente pelo cronômetro; ajuste se necessário.
              </p>
            </div>

            {/* URL de gravação (opcional) */}
            <div>
              <Label htmlFor="call-recording" className="mb-1 block">
                URL da gravação <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="call-recording"
                type="url"
                placeholder="https://…"
                value={recordingUrl}
                onChange={(e) => setRecordingUrl(e.target.value)}
                disabled={inCall}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={logging}
            >
              Cancelar
            </Button>
            <Button size="sm" className="gap-2" onClick={handleLog} disabled={inCall || logging}>
              {logging ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
              Registrar ligação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
