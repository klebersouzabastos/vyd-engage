import { WhatsAppConnection } from "../../types/whatsapp";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";
import { Badge } from "../ui/badge";
import { 
  Edit, 
  Trash2, 
  TestTube, 
  QrCode, 
  Star, 
  StarOff,
  MessageSquare,
  Phone
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { QRCodeModal } from "./QRCodeModal";
import { TestMessageModal } from "./TestMessageModal";

interface ConnectionCardProps {
  connection: WhatsAppConnection;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onTest?: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  official: "WhatsApp Business API",
  evolution: "Evolution API",
  baileys: "Baileys/WPPConnect",
  chatapi: "ChatAPI",
};

export function ConnectionCard({
  connection,
  onEdit,
  onDelete,
  onSetDefault,
  onTest,
}: ConnectionCardProps) {
  const providerLabel = PROVIDER_LABELS[connection.provider] || connection.provider;

  const handleDelete = () => {
    if (window.confirm(`Tem certeza que deseja deletar a conexão "${connection.name}"?`)) {
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
                {connection.name}
              </CardTitle>
              {connection.isDefault && (
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
              {connection.phoneNumber && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{connection.phoneNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ConnectionStatusBadge
            status={connection.status}
            showBattery={connection.provider === "baileys" || connection.provider === "evolution"}
            showLastSync={true}
          />

          {connection.status.errorMessage && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {connection.status.errorMessage}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {!connection.isDefault && (
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

            {(connection.provider === "baileys" || connection.provider === "evolution") && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    <QrCode className="h-3 w-3 mr-1" />
                    QR Code
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <QRCodeModal connection={connection} />
                </DialogContent>
              </Dialog>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <TestTube className="h-3 w-3 mr-1" />
                  Testar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <TestMessageModal connection={connection} onTest={onTest} />
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

          {connection.metadata && (
            <div className="text-xs text-[#6B7280] pt-2 border-t border-[#E5E7EB]">
              {connection.metadata.messageCount !== undefined && (
                <div>Mensagens enviadas: {connection.metadata.messageCount}</div>
              )}
              {connection.lastUsedAt && (
                <div>
                  Último uso: {new Date(connection.lastUsedAt).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}








