import { useState } from "react";
import { EmailConfig } from "../../types/email";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { testEmailConfig } from "../../utils/email/emailService";

interface EmailTestModalProps {
  config: EmailConfig;
  onTest?: () => void;
}

export function EmailTestModal({ config, onTest }: EmailTestModalProps) {
  const [testEmail, setTestEmail] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    error?: string;
  } | null>(null);

  const handleTest = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      setTestResult({
        success: false,
        message: "Email inválido",
        error: "Por favor, insira um email válido",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testEmailConfig(config, testEmail);
      setTestResult({
        success: result.success,
        message: result.message,
        error: result.error,
      });

      if (result.success && onTest) {
        onTest();
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "Erro ao testar configuração",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
          Testar Configuração de Email
        </h3>
        <p className="text-sm text-[#6B7280]">
          Envie um email de teste para verificar se sua configuração está funcionando corretamente.
        </p>
      </div>

      <div>
        <Label htmlFor="testEmail">Email de teste *</Label>
        <Input
          id="testEmail"
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="seu@email.com"
          className="mt-1.5"
          disabled={isTesting}
        />
        <p className="text-xs text-[#6B7280] mt-1">
          O email de teste será enviado para este endereço
        </p>
      </div>

      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            <div className="font-medium">{testResult.message}</div>
            {testResult.error && (
              <div className="mt-1 text-sm">{testResult.error}</div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 pt-4 border-t border-[#E5E7EB]">
        <Button
          onClick={handleTest}
          disabled={isTesting || !testEmail}
          className="bg-[#2563EB] hover:bg-[#1E40AF]"
        >
          {isTesting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            "Enviar Email de Teste"
          )}
        </Button>
      </div>
    </div>
  );
}








