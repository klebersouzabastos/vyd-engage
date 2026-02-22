import { useState } from "react";
import { toast } from "sonner";
import { WhatsAppConnection } from "../../types/whatsapp";
import { useWhatsApp } from "../../contexts/WhatsAppContext";
import { DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { ConnectionCard } from "./ConnectionCard";
import { ConnectionForm } from "./ConnectionForm";
import { Plus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";

interface WhatsAppConnectionsModalProps {
  onClose?: () => void;
}

export function WhatsAppConnectionsModal({ onClose }: WhatsAppConnectionsModalProps) {
  const {
    connections,
    addConnection,
    updateConnection,
    deleteConnection,
    setDefaultConnection,
    canAddConnection,
    planLimits,
  } = useWhatsApp();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = async (data: Omit<WhatsAppConnection, "id" | "createdAt" | "updatedAt">) => {
    try {
      await addConnection(data);
      setIsAdding(false);
    } catch (error) {
      throw error;
    }
  };

  const handleUpdate = async (
    id: string,
    updates: Partial<WhatsAppConnection>
  ) => {
    try {
      await updateConnection(id, updates);
      setEditingId(null);
    } catch (error) {
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConnection(id);
    } catch (error) {
      console.error("Erro ao deletar conexão:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao deletar conexão");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultConnection(id);
    } catch (error) {
      console.error("Erro ao definir conexão padrão:", error);
    }
  };

  const editingConnection = editingId
    ? connections.find((c) => c.id === editingId)
    : null;

  const connectionsUsed = connections.length;
  const connectionsLimit = planLimits.maxConnections === Infinity 
    ? "ilimitado" 
    : planLimits.maxConnections;

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>Conexões WhatsApp</DialogTitle>
        <DialogDescription>
          Gerencie suas integrações com WhatsApp. Você pode ter múltiplas conexões de diferentes provedores.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Conexões: {connectionsUsed} / {connectionsLimit}
            </p>
            {!canAddConnection() && (
              <p className="text-xs text-gray-600 mt-1">
                Limite de conexões atingido. Faça upgrade do plano para adicionar mais.
              </p>
            )}
          </div>
          {canAddConnection() && !isAdding && !editingId && (
            <Button
              onClick={() => setIsAdding(true)}
              className="bg-primary hover:bg-primary-dark"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Conexão
            </Button>
          )}
        </div>

        {isAdding && (
          <div className="p-4 border border-gray-300 rounded-lg bg-gray-100">
            <h3 className="font-medium text-gray-900 mb-4">Nova Conexão WhatsApp</h3>
            <ConnectionForm
              onSubmit={handleAdd}
              onCancel={() => setIsAdding(false)}
            />
          </div>
        )}

        {editingConnection && (
          <div className="p-4 border border-gray-300 rounded-lg bg-gray-100">
            <h3 className="font-medium text-gray-900 mb-4">Editar Conexão</h3>
            <ConnectionForm
              connection={editingConnection}
              onSubmit={async (data) => {
                await handleUpdate(editingConnection.id, data);
              }}
              onCancel={() => setEditingId(null)}
            />
          </div>
        )}

        {connections.length === 0 && !isAdding && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma conexão configurada. Adicione uma conexão para começar a enviar mensagens.
            </AlertDescription>
          </Alert>
        )}

        {connections.length > 0 && !isAdding && !editingId && (
          <div className="space-y-4">
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onEdit={() => setEditingId(connection.id)}
                onDelete={() => handleDelete(connection.id)}
                onSetDefault={() => handleSetDefault(connection.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}








