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

// Tipos mínimos do @twilio/voice-sdk (carregado sob demanda; ver startCall).
type TwilioCall = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  disconnect: () => void;
};
type TwilioDevice = {
  connect: (options?: { params?: Record<string, string> }) => Promise<TwilioCall>;
  destroy: () => void;
};

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
 * Click-to-call (req 21).
 *
 * GATING GRACIOSO: o botão só é renderizado quando a telefonia está configurada
 * (getPhoneStatus.configured). Sem credencial, nada é renderizado — o link `tel:`
 * existente permanece como fallback.
 *
 * WEBPHONE REAL (quando disponível): ao iniciar a ligação buscamos um token via
 * /phone/token, inicializamos o Twilio Voice Device (import dinâmico p/ não pesar
 * o bundle) e chamamos device.connect({ To }). A duração é medida pelos eventos
 * `accept` (chamada atendida) → `disconnect`. Ao encerrar, registramos via
 * /phone/log-call (Interaction CALL OUTBOUND) com a duração e a timeline atualiza.
 *
 * FALLBACK GRACIOSO (registro assistido): se o SDK falhar ao carregar, não houver
 * microfone/permissão, ou o backend não devolver token, caímos no cronômetro
 * manual — o usuário liga por fora e nós apenas cronometramos/registramos o
 * desfecho. Os rótulos deixam claro quando estamos em modo assistido (sem prometer
 * discagem no navegador).
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
  const [connecting, setConnecting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [manualDuration, setManualDuration] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [logging, setLogging] = useState(false);
  // 'webphone' = discou pelo navegador via Twilio; 'manual' = registro assistido.
  const [mode, setMode] = useState<'webphone' | 'manual'>('manual');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceRef = useRef<TwilioDevice | null>(null);
  const callRef = useRef<TwilioCall | null>(null);

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

  const startTimer = useCallback(() => {
    stopTimer();
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, [stopTimer]);

  const teardownDevice = useCallback(() => {
    try {
      callRef.current?.disconnect();
    } catch {
      /* ignora — a chamada pode já ter encerrado */
    }
    try {
      deviceRef.current?.destroy();
    } catch {
      /* ignora */
    }
    callRef.current = null;
    deviceRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      teardownDevice();
    };
  }, [stopTimer, teardownDevice]);

  const resetDialer = useCallback(() => {
    stopTimer();
    teardownDevice();
    setInCall(false);
    setConnecting(false);
    setElapsed(0);
    setManualDuration('');
    setRecordingUrl('');
    setMode('manual');
    setStatusMsg(null);
  }, [stopTimer, teardownDevice]);

  const handleOpen = () => {
    resetDialer();
    setOpen(true);
  };

  // Encerra a ligação (webphone ou manual) e prepara o registro do desfecho.
  const endCall = useCallback(() => {
    stopTimer();
    teardownDevice();
    setInCall(false);
    setConnecting(false);
    // Preenche a duração informada com o tempo cronometrado (editável).
    setElapsed((e) => {
      setManualDuration(String(e));
      return e;
    });
  }, [stopTimer, teardownDevice]);

  // Cronômetro manual (registro assistido): usuário liga por fora, nós medimos.
  const startManual = useCallback(() => {
    setMode('manual');
    setStatusMsg(null);
    setInCall(true);
    startTimer();
  }, [startTimer]);

  const startCall = useCallback(async () => {
    setConnecting(true);
    setStatusMsg('Conectando…');
    let token: string | null;
    try {
      const res = await apiClient.getPhoneToken();
      token = res.data?.token ?? null;
    } catch {
      token = null;
    }

    // Sem token → registro assistido (não promete discagem no navegador).
    if (!token) {
      setConnecting(false);
      setStatusMsg('Webphone indisponível — registrando manualmente.');
      startManual();
      return;
    }

    try {
      const { Device } = (await import('@twilio/voice-sdk')) as unknown as {
        Device: new (token: string) => TwilioDevice;
      };
      const device = new Device(token);
      deviceRef.current = device;

      const call = await device.connect({ params: { To: phone } });
      callRef.current = call;
      setMode('webphone');

      // `accept` = chamada atendida → inicia a contagem de duração.
      call.on('accept', () => {
        setConnecting(false);
        setInCall(true);
        setStatusMsg(null);
        startTimer();
      });
      // `disconnect`/`cancel` = fim da chamada → congela a duração p/ registro.
      const onEnd = () => endCall();
      call.on('disconnect', onEnd);
      call.on('cancel', onEnd);
      call.on('reject', onEnd);
      call.on('error', () => {
        // Falha durante a chamada: cai para registro assistido sem perder o fluxo.
        teardownDevice();
        setConnecting(false);
        setMode('manual');
        setStatusMsg('Falha no webphone — registrando manualmente.');
        if (!inCall) startManual();
        else endCall();
      });
    } catch {
      // SDK indisponível / sem microfone / permissão negada → fallback assistido.
      teardownDevice();
      setConnecting(false);
      setStatusMsg('Webphone indisponível — registrando manualmente.');
      startManual();
    }
  }, [phone, startTimer, startManual, endCall, teardownDevice, inCall]);

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

  const busy = inCall || connecting;
  const timerValue = inCall ? elapsed : parseInt(manualDuration, 10) || elapsed;
  const stateLabel = connecting
    ? 'Conectando…'
    : inCall
      ? mode === 'webphone'
        ? 'Em ligação (webphone)…'
        : 'Cronometrando…'
      : elapsed > 0
        ? 'Ligação encerrada'
        : 'Pronto para discar';

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
                {formatDuration(timerValue)}
              </span>
              <span className="text-xs text-muted-foreground">{stateLabel}</span>
              <div className="mt-1">
                {busy ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive"
                    onClick={endCall}
                    disabled={connecting}
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
              {statusMsg && (
                <span className="text-xs text-muted-foreground" role="status">
                  {statusMsg}
                </span>
              )}
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
                disabled={busy}
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
                disabled={busy}
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
            <Button size="sm" className="gap-2" onClick={handleLog} disabled={busy || logging}>
              {logging ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
              Registrar ligação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
