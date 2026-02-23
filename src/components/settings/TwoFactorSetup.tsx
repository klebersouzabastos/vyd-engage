import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Shield, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { apiClient } from "../../services/api/client";
import { toast } from "sonner";

type Step = "idle" | "setup" | "verify" | "disable";

export function TwoFactorSetup() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const res = await apiClient.get2FAStatus();
      setEnabled(res.enabled);
    } catch {
      // Ignore - not critical
    } finally {
      setLoading(false);
    }
  }

  async function handleSetup() {
    try {
      setSubmitting(true);
      const res = await apiClient.setup2FA();
      setQrCode(res.qrCode);
      setSecret(res.secret);
      setStep("verify");
    } catch (err: any) {
      toast.error(err.message || "Erro ao configurar 2FA");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) {
      toast.error("O código deve ter 6 dígitos");
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.verify2FA(code);
      setEnabled(true);
      setStep("idle");
      setCode("");
      setQrCode("");
      setSecret("");
      toast.success("Autenticação de dois fatores ativada!");
    } catch (err: any) {
      toast.error(err.message || "Código inválido");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisable() {
    if (code.length !== 6) {
      toast.error("O código deve ter 6 dígitos");
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.disable2FA(code);
      setEnabled(false);
      setStep("idle");
      setCode("");
      toast.success("Autenticação de dois fatores desativada");
    } catch (err: any) {
      toast.error(err.message || "Código inválido");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Autenticação de Dois Fatores (2FA)</h3>
        <p className="text-sm text-gray-500 mt-1">
          Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador.
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 p-4 rounded-lg border border-gray-300 bg-gray-50">
        {enabled ? (
          <>
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-700">2FA ativado</p>
              <p className="text-sm text-gray-500">Sua conta está protegida com autenticação de dois fatores.</p>
            </div>
          </>
        ) : (
          <>
            <ShieldOff className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium text-amber-700">2FA desativado</p>
              <p className="text-sm text-gray-500">Recomendamos ativar para proteger sua conta.</p>
            </div>
          </>
        )}
      </div>

      {/* Idle state - show enable/disable button */}
      {step === "idle" && (
        <div>
          {enabled ? (
            <Button
              variant="outline"
              onClick={() => { setStep("disable"); setCode(""); }}
              className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
            >
              <ShieldOff className="h-4 w-4" />
              Desativar 2FA
            </Button>
          ) : (
            <Button onClick={handleSetup} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Ativar 2FA
            </Button>
          )}
        </div>
      )}

      {/* Setup step - show QR code */}
      {step === "verify" && qrCode && (
        <div className="space-y-4 p-4 border border-gray-300 rounded-lg">
          <div>
            <p className="font-medium text-gray-900 mb-2">1. Escaneie o QR Code</p>
            <p className="text-sm text-gray-500 mb-4">
              Use um aplicativo autenticador como Google Authenticator, Authy ou 1Password.
            </p>
            <div className="flex justify-center">
              <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-1">Ou insira a chave manualmente:</p>
            <code className="block p-2 bg-gray-100 rounded text-sm font-mono break-all text-center">
              {secret}
            </code>
          </div>

          <div>
            <p className="font-medium text-gray-900 mb-2">2. Insira o código de verificação</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="totp-code" className="sr-only">Código</Label>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <Button onClick={handleVerify} disabled={submitting || code.length !== 6}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
              </Button>
            </div>
          </div>

          <Button variant="ghost" onClick={() => { setStep("idle"); setCode(""); }} className="text-sm">
            Cancelar
          </Button>
        </div>
      )}

      {/* Disable step - ask for code */}
      {step === "disable" && (
        <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-red-50">
          <p className="font-medium text-red-800">Desativar autenticação de dois fatores</p>
          <p className="text-sm text-red-600">
            Insira o código do seu aplicativo autenticador para confirmar.
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="disable-code" className="sr-only">Código</Label>
              <Input
                id="disable-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-lg tracking-widest"
              />
            </div>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={submitting || code.length !== 6}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desativar"}
            </Button>
          </div>
          <Button variant="ghost" onClick={() => { setStep("idle"); setCode(""); }} className="text-sm">
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
