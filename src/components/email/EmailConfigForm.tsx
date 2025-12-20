import { useState, useEffect } from "react";
import { EmailConfig, EmailProvider, ProviderConfig } from "../../types/email";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { EmailProviderSelector } from "./EmailProviderSelector";
import { validateEmailConfig } from "../../utils/email/emailValidators";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, Info } from "lucide-react";

interface EmailConfigFormProps {
  config?: EmailConfig;
  onSubmit: (data: Omit<EmailConfig, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onCancel?: () => void;
}

export function EmailConfigForm({ config, onSubmit, onCancel }: EmailConfigFormProps) {
  const [provider, setProvider] = useState<EmailProvider>(
    config?.provider || "smtp"
  );
  const [name, setName] = useState(config?.name || "");
  const [isDefault, setIsDefault] = useState(config?.isDefault || false);
  const [emailConfig, setEmailConfig] = useState<ProviderConfig>(
    config?.config || {
      host: "",
      port: 587,
      user: "",
      password: "",
      secure: false,
    }
  );
  const [validation, setValidation] = useState<{ isValid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (emailConfig) {
      const result = validateEmailConfig(provider, emailConfig);
      setValidation(result);
    }
  }, [provider, emailConfig]);

  const handleProviderChange = (newProvider: EmailProvider) => {
    setProvider(newProvider);
    // Reset config based on provider
    switch (newProvider) {
      case "smtp":
        setEmailConfig({ host: "", port: 587, user: "", password: "", secure: false });
        break;
      case "sendgrid":
        setEmailConfig({ apiKey: "" });
        break;
      case "mailgun":
        setEmailConfig({ apiKey: "", domain: "" });
        break;
      case "resend":
        setEmailConfig({ apiKey: "" });
        break;
    }
  };

  const handleConfigChange = (field: string, value: any) => {
    setEmailConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validation?.isValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name,
        provider,
        config: emailConfig,
        status: config?.status || {
          status: "disconnected",
        },
        isDefault,
      });
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      alert(error instanceof Error ? error.message : "Erro ao salvar configuração");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSMTPFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="host">Host SMTP *</Label>
        <Input
          id="host"
          value={(emailConfig as any).host || ""}
          onChange={(e) => handleConfigChange("host", e.target.value)}
          placeholder="smtp.gmail.com"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="port">Porta *</Label>
        <Input
          id="port"
          type="number"
          value={(emailConfig as any).port || 587}
          onChange={(e) => handleConfigChange("port", parseInt(e.target.value) || 587)}
          placeholder="587"
          className="mt-1.5"
          min="1"
          max="65535"
        />
      </div>
      <div>
        <Label htmlFor="user">Usuário *</Label>
        <Input
          id="user"
          value={(emailConfig as any).user || ""}
          onChange={(e) => handleConfigChange("user", e.target.value)}
          placeholder="seu@email.com"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="password">Senha *</Label>
        <Input
          id="password"
          type="password"
          value={(emailConfig as any).password || ""}
          onChange={(e) => handleConfigChange("password", e.target.value)}
          placeholder="••••••••"
          className="mt-1.5"
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="secure">Usar SSL/TLS</Label>
          <p className="text-xs text-[#6B7280] mt-1">Recomendado para portas 465</p>
        </div>
        <Switch
          id="secure"
          checked={(emailConfig as any).secure || false}
          onCheckedChange={(checked) => handleConfigChange("secure", checked)}
        />
      </div>
      <div>
        <Label htmlFor="smtp-fromEmail">Email de Remetente (Opcional)</Label>
        <Input
          id="smtp-fromEmail"
          type="email"
          value={(emailConfig as any).fromEmail || ""}
          onChange={(e) => handleConfigChange("fromEmail", e.target.value)}
          placeholder="remetente@email.com"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="smtp-fromName">Nome do Remetente (Opcional)</Label>
        <Input
          id="smtp-fromName"
          value={(emailConfig as any).fromName || ""}
          onChange={(e) => handleConfigChange("fromName", e.target.value)}
          placeholder="Sua Empresa"
          className="mt-1.5"
        />
      </div>
    </div>
  );

  const renderSendGridFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="sendgrid-apiKey">API Key *</Label>
        <Input
          id="sendgrid-apiKey"
          type="password"
          value={(emailConfig as any).apiKey || ""}
          onChange={(e) => handleConfigChange("apiKey", e.target.value)}
          placeholder="SG.xxxxxxxxxxxxx"
          className="mt-1.5"
        />
        <p className="text-xs text-[#6B7280] mt-1">
          Obtenha sua API Key em: https://app.sendgrid.com/settings/api_keys
        </p>
      </div>
      <div>
        <Label htmlFor="sendgrid-fromEmail">Email de Remetente (Opcional)</Label>
        <Input
          id="sendgrid-fromEmail"
          type="email"
          value={(emailConfig as any).fromEmail || ""}
          onChange={(e) => handleConfigChange("fromEmail", e.target.value)}
          placeholder="remetente@email.com"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="sendgrid-fromName">Nome do Remetente (Opcional)</Label>
        <Input
          id="sendgrid-fromName"
          value={(emailConfig as any).fromName || ""}
          onChange={(e) => handleConfigChange("fromName", e.target.value)}
          placeholder="Sua Empresa"
          className="mt-1.5"
        />
      </div>
    </div>
  );

  const renderMailgunFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="mailgun-apiKey">API Key *</Label>
        <Input
          id="mailgun-apiKey"
          type="password"
          value={(emailConfig as any).apiKey || ""}
          onChange={(e) => handleConfigChange("apiKey", e.target.value)}
          placeholder="key-xxxxxxxxxxxxx"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="domain">Domínio *</Label>
        <Input
          id="domain"
          value={(emailConfig as any).domain || ""}
          onChange={(e) => handleConfigChange("domain", e.target.value)}
          placeholder="mg.exemplo.com"
          className="mt-1.5"
        />
        <p className="text-xs text-[#6B7280] mt-1">
          Domínio verificado no Mailgun
        </p>
      </div>
      <div>
        <Label htmlFor="mailgun-fromEmail">Email de Remetente (Opcional)</Label>
        <Input
          id="mailgun-fromEmail"
          type="email"
          value={(emailConfig as any).fromEmail || ""}
          onChange={(e) => handleConfigChange("fromEmail", e.target.value)}
          placeholder="remetente@email.com"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="mailgun-fromName">Nome do Remetente (Opcional)</Label>
        <Input
          id="mailgun-fromName"
          value={(emailConfig as any).fromName || ""}
          onChange={(e) => handleConfigChange("fromName", e.target.value)}
          placeholder="Sua Empresa"
          className="mt-1.5"
        />
      </div>
    </div>
  );

  const renderResendFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="resend-apiKey">API Key *</Label>
        <Input
          id="resend-apiKey"
          type="password"
          value={(emailConfig as any).apiKey || ""}
          onChange={(e) => handleConfigChange("apiKey", e.target.value)}
          placeholder="re_xxxxxxxxxxxxx"
          className="mt-1.5"
        />
        <p className="text-xs text-[#6B7280] mt-1">
          Obtenha sua API Key em: https://resend.com/api-keys
        </p>
      </div>
      <div>
        <Label htmlFor="resend-fromEmail">Email de Remetente (Opcional)</Label>
        <Input
          id="resend-fromEmail"
          type="email"
          value={(emailConfig as any).fromEmail || ""}
          onChange={(e) => handleConfigChange("fromEmail", e.target.value)}
          placeholder="remetente@email.com"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="resend-fromName">Nome do Remetente (Opcional)</Label>
        <Input
          id="resend-fromName"
          value={(emailConfig as any).fromName || ""}
          onChange={(e) => handleConfigChange("fromName", e.target.value)}
          placeholder="Sua Empresa"
          className="mt-1.5"
        />
      </div>
    </div>
  );

  const renderProviderFields = () => {
    switch (provider) {
      case "smtp":
        return renderSMTPFields();
      case "sendgrid":
        return renderSendGridFields();
      case "mailgun":
        return renderMailgunFields();
      case "resend":
        return renderResendFields();
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Nome da Configuração *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Email Principal"
          className="mt-1.5"
          required
        />
        <p className="text-xs text-[#6B7280] mt-1">
          Um nome descritivo para identificar esta configuração
        </p>
      </div>

      <EmailProviderSelector value={provider} onChange={handleProviderChange} />

      {renderProviderFields()}

      {validation && (
        <div className="space-y-2">
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {validation.warnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded border-[#E5E7EB]"
        />
        <Label htmlFor="isDefault" className="cursor-pointer">
          Definir como configuração padrão
        </Label>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-[#E5E7EB]">
        <Button
          type="submit"
          disabled={!validation?.isValid || isSubmitting}
          className="bg-[#2563EB] hover:bg-[#1E40AF]"
        >
          {isSubmitting ? "Salvando..." : config ? "Atualizar" : "Criar Configuração"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}








