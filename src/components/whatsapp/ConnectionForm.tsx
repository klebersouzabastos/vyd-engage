import { useState, useEffect } from "react";
import { WhatsAppConnection, WhatsAppProvider, ProviderConfig } from "../../types/whatsapp";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { validateConnectionConfig } from "../../utils/whatsapp/connectionValidator";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertCircle, Info } from "lucide-react";

interface ConnectionFormProps {
  connection?: WhatsAppConnection;
  onSubmit: (data: Omit<WhatsAppConnection, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onCancel?: () => void;
}

const PROVIDER_OPTIONS = [
  { value: "official", label: "WhatsApp Business API (Oficial)" },
  { value: "evolution", label: "Evolution API" },
  { value: "baileys", label: "Baileys/WPPConnect" },
  { value: "chatapi", label: "ChatAPI" },
];

export function ConnectionForm({ connection, onSubmit, onCancel }: ConnectionFormProps) {
  const [provider, setProvider] = useState<WhatsAppProvider>(
    connection?.provider || "official"
  );
  const [name, setName] = useState(connection?.name || "");
  const [isDefault, setIsDefault] = useState(connection?.isDefault || false);
  const [config, setConfig] = useState<ProviderConfig>(
    connection?.config || {
      accessToken: "",
      phoneNumberId: "",
    }
  );
  const [validation, setValidation] = useState<{ isValid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (config) {
      const result = validateConnectionConfig(provider, config);
      setValidation(result);
    }
  }, [provider, config]);

  const handleProviderChange = (newProvider: WhatsAppProvider) => {
    setProvider(newProvider);
    // Reset config based on provider
    switch (newProvider) {
      case "official":
        setConfig({ accessToken: "", phoneNumberId: "" });
        break;
      case "evolution":
        setConfig({ instanceName: "", apiUrl: "", apiKey: "" });
        break;
      case "baileys":
        setConfig({ instanceName: "", apiUrl: "", apiKey: "" });
        break;
      case "chatapi":
        setConfig({ apiUrl: "", apiToken: "", instanceId: "" });
        break;
    }
  };

  const handleConfigChange = (field: string, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
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
        config,
        status: connection?.status || {
          status: "disconnected",
        },
        isDefault,
        phoneNumber: "phoneNumber" in config ? (config as any).phoneNumber : undefined,
      });
    } catch (error) {
      console.error("Erro ao salvar conexão:", error);
      alert(error instanceof Error ? error.message : "Erro ao salvar conexão");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderOfficialFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="accessToken">Access Token *</Label>
        <Input
          id="accessToken"
          value={(config as any).accessToken || ""}
          onChange={(e) => handleConfigChange("accessToken", e.target.value)}
          placeholder="EAAey..."
          className="mt-1.5"
          type="password"
        />
        <p className="text-xs text-gray-600 mt-1">
          Token de acesso da API do WhatsApp Business
        </p>
      </div>
      <div>
        <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
        <Input
          id="phoneNumberId"
          value={(config as any).phoneNumberId || ""}
          onChange={(e) => handleConfigChange("phoneNumberId", e.target.value)}
          placeholder="123456789"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="businessAccountId">Business Account ID (Opcional)</Label>
        <Input
          id="businessAccountId"
          value={(config as any).businessAccountId || ""}
          onChange={(e) => handleConfigChange("businessAccountId", e.target.value)}
          placeholder="123456789"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="webhookVerifyToken">Webhook Verify Token (Opcional)</Label>
        <Input
          id="webhookVerifyToken"
          value={(config as any).webhookVerifyToken || ""}
          onChange={(e) => handleConfigChange("webhookVerifyToken", e.target.value)}
          placeholder="seu_token_secreto"
          className="mt-1.5"
        />
      </div>
    </div>
  );

  const renderEvolutionFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="instanceName">Nome da Instância *</Label>
        <Input
          id="instanceName"
          value={(config as any).instanceName || ""}
          onChange={(e) => handleConfigChange("instanceName", e.target.value)}
          placeholder="minha-instancia"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="apiUrl">URL da API *</Label>
        <Input
          id="apiUrl"
          value={(config as any).apiUrl || ""}
          onChange={(e) => handleConfigChange("apiUrl", e.target.value)}
          placeholder="https://api.evolution.com"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="apiKey">API Key *</Label>
        <Input
          id="apiKey"
          value={(config as any).apiKey || ""}
          onChange={(e) => handleConfigChange("apiKey", e.target.value)}
          placeholder="sua_api_key"
          className="mt-1.5"
          type="password"
        />
      </div>
      <div>
        <Label htmlFor="webhookUrl">Webhook URL (Opcional)</Label>
        <Input
          id="webhookUrl"
          value={(config as any).webhookUrl || ""}
          onChange={(e) => handleConfigChange("webhookUrl", e.target.value)}
          placeholder="https://seu-webhook.com"
          className="mt-1.5"
        />
      </div>
    </div>
  );

  const renderBaileysFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="baileys-instanceName">Nome da Instância *</Label>
        <Input
          id="baileys-instanceName"
          value={(config as any).instanceName || ""}
          onChange={(e) => handleConfigChange("instanceName", e.target.value)}
          placeholder="minha-instancia"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="baileys-apiUrl">URL da API *</Label>
        <Input
          id="baileys-apiUrl"
          value={(config as any).apiUrl || ""}
          onChange={(e) => handleConfigChange("apiUrl", e.target.value)}
          placeholder="https://api.wppconnect.io"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="baileys-apiKey">API Key *</Label>
        <Input
          id="baileys-apiKey"
          value={(config as any).apiKey || ""}
          onChange={(e) => handleConfigChange("apiKey", e.target.value)}
          placeholder="sua_api_key"
          className="mt-1.5"
          type="password"
        />
      </div>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Após salvar, você precisará escanear o QR Code para conectar sua conta WhatsApp.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderChatAPIFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="chatapi-apiUrl">URL da API *</Label>
        <Input
          id="chatapi-apiUrl"
          value={(config as any).apiUrl || ""}
          onChange={(e) => handleConfigChange("apiUrl", e.target.value)}
          placeholder="https://api.chatapi.com"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="chatapi-apiToken">API Token *</Label>
        <Input
          id="chatapi-apiToken"
          value={(config as any).apiToken || ""}
          onChange={(e) => handleConfigChange("apiToken", e.target.value)}
          placeholder="seu_token"
          className="mt-1.5"
          type="password"
        />
      </div>
      <div>
        <Label htmlFor="chatapi-instanceId">Instance ID *</Label>
        <Input
          id="chatapi-instanceId"
          value={(config as any).instanceId || ""}
          onChange={(e) => handleConfigChange("instanceId", e.target.value)}
          placeholder="123456789"
          className="mt-1.5"
        />
      </div>
    </div>
  );

  const renderProviderFields = () => {
    switch (provider) {
      case "official":
        return renderOfficialFields();
      case "evolution":
        return renderEvolutionFields();
      case "baileys":
        return renderBaileysFields();
      case "chatapi":
        return renderChatAPIFields();
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Nome da Conexão *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: WhatsApp Principal"
          className="mt-1.5"
          required
        />
        <p className="text-xs text-gray-600 mt-1">
          Um nome descritivo para identificar esta conexão
        </p>
      </div>

      <div>
        <Label htmlFor="provider">Tipo de Provedor *</Label>
        <Select value={provider} onValueChange={handleProviderChange}>
          <SelectTrigger id="provider" className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
          className="rounded border-gray-300"
        />
        <Label htmlFor="isDefault" className="cursor-pointer">
          Definir como conexão padrão
        </Label>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-gray-300">
        <Button
          type="submit"
          disabled={!validation?.isValid || isSubmitting}
          className="bg-primary hover:bg-primary-dark"
        >
          {isSubmitting ? "Salvando..." : connection ? "Atualizar" : "Criar Conexão"}
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








