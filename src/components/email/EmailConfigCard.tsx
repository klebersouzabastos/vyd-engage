import { EmailConfig } from "../../types/email";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { 
  Edit, 
  Trash2, 
  TestTube, 
  Star, 
  StarOff,
  Mail,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "../ui/dialog";
import { EmailTestModal } from "./EmailTestModal";

interface EmailConfigCardProps {
  config: EmailConfig;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onTest?: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  smtp: "SMTP",
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
  resend: "Resend",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  connected: { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle },
  disconnected: { bg: "bg-gray-100", text: "text-gray-700", icon: XCircle },
  testing: { bg: "bg-blue-100", text: "text-blue-700", icon: Clock },
  error: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
};

export function EmailConfigCard({
  config,
  onEdit,
  onDelete,
  onSetDefault,
  onTest,
}: EmailConfigCardProps) {
  const providerLabel = PROVIDER_LABELS[config.provider] || config.provider;
  const statusInfo = STATUS_COLORS[config.status.status] || STATUS_COLORS.disconnected;
  const StatusIcon = statusInfo.icon;

  const getFromEmail = () => {
    const cfg = config.config as any;
    return cfg.fromEmail || "Não configurado";
  };

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja deletar a configuração "${config.name}"?`)) {
      onDelete();
    }
  };

  return (
    <Card className="border border-[#E5E7EB]">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-base font-medium text-[#1F2937]">
                {config.name}
              </CardTitle>
              {config.isDefault && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Star className="h-3 w-3 mr-1" />
                  Padrão
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-[#6B7280]">
              <Badge variant="outline" className="text-xs">
                {providerLabel}
              </Badge>
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{getFromEmail()}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
            <StatusIcon size={12} />
            {config.status.status === "connected" ? "Conectado" : 
             config.status.status === "disconnected" ? "Desconectado" :
             config.status.status === "testing" ? "Testando..." :
             "Erro"}
          </div>

          {config.status.errorMessage && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {config.status.errorMessage}
            </div>
          )}

          {config.status.lastTested && (
            <div className="text-xs text-[#6B7280]">
              Último teste: {new Date(config.status.lastTested).toLocaleString("pt-BR")}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {!config.isDefault && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSetDefault}
                className="text-xs"
              >
                <StarOff className="h-3 w-3 mr-1" />
                Definir como padrão
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={onEdit} className="text-xs">
              <Edit className="h-3 w-3 mr-1" />
              Editar
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <TestTube className="h-3 w-3 mr-1" />
                  Testar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <EmailTestModal config={config} onTest={onTest} />
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Deletar
            </Button>
          </div>

          {config.metadata && (
            <div className="text-xs text-[#6B7280] pt-2 border-t border-[#E5E7EB]">
              {config.metadata.emailCount !== undefined && (
                <div>Emails enviados: {config.metadata.emailCount}</div>
              )}
              {config.lastUsedAt && (
                <div>
                  Último uso: {new Date(config.lastUsedAt).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}








