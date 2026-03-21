import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { PageSkeleton } from "../components/PageSkeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Plus,
  Trash2,
  Copy,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  Loader2,
  Terminal,
} from "lucide-react";
import { apiClient } from "../services/api/client";

// Types
interface ApiKeyData {
  id: string;
  name: string;
  key: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  active?: boolean;
  createdAt: string;
}

export function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [revokingKey, setRevokingKey] = useState<ApiKeyData | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKeyFor, setShowKeyFor] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const data = await apiClient.getApiKeys();
      setApiKeys(data as unknown as ApiKeyData[]);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Informe um nome para a chave");
      return;
    }

    setSaving(true);
    try {
      const result = await apiClient.createApiKey({ name: newKeyName.trim() });
      setCreatedKey(result.key);
      toast.success("API key criada com sucesso");
      fetchKeys();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar API key");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokingKey) return;
    try {
      await apiClient.deleteApiKey(revokingKey.id);
      toast.success("API key revogada");
      setRevokingKey(null);
      fetchKeys();
    } catch (error: any) {
      toast.error(error.message || "Erro ao revogar API key");
    }
  };

  const copyToClipboard = (text: string, keyId?: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a area de transferencia");
    if (keyId) {
      setCopiedId(keyId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const openCreateDialog = () => {
    setNewKeyName("");
    setCreatedKey(null);
    setIsCreateOpen(true);
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setCreatedKey(null);
    setNewKeyName("");
  };

  const maskKey = (key: string) => {
    if (key.startsWith("fcrm_****")) return key;
    if (key.length > 12) return `${key.slice(0, 5)}${"*".repeat(key.length - 9)}${key.slice(-4)}`;
    return key;
  };

  if (loading) return <PageSkeleton />;

  const apiBaseUrl = window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin;

  return (
    <div className="min-h-screen">
      <Header title="API Keys" subtitle="Gerencie chaves de acesso para a API do VYD Engage" />

      <div className="p-4 md:p-8 space-y-6">
        {/* Keys list */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-300">
          <div className="p-4 md:p-6 border-b border-gray-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Chaves de API ({apiKeys.length})
              </h2>
              <p className="text-sm text-gray-500">
                Use chaves de API para autenticar requisicoes externas.
              </p>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus size={16} className="mr-2" />
              Criar API Key
            </Button>
          </div>

          {apiKeys.length === 0 ? (
            <div className="p-12 text-center">
              <Key size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma API key criada</h3>
              <p className="text-gray-500 mb-6">
                Crie uma chave de API para integrar aplicacoes externas com seu CRM.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus size={16} className="mr-2" />
                Criar API Key
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Nome
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Chave
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">
                      Criado em
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">
                      Ultimo uso
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Status
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{apiKey.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {showKeyFor === apiKey.id ? apiKey.key : maskKey(apiKey.key)}
                          </code>
                          <button
                            onClick={() =>
                              setShowKeyFor(showKeyFor === apiKey.id ? null : apiKey.id)
                            }
                            className="text-gray-400 hover:text-gray-600"
                            title={showKeyFor === apiKey.id ? "Ocultar" : "Mostrar"}
                          >
                            {showKeyFor === apiKey.id ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copiar"
                          >
                            {copiedId === apiKey.id ? (
                              <Check size={14} className="text-green-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 hidden md:table-cell">
                        {new Date(apiKey.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 hidden lg:table-cell">
                        {apiKey.lastUsedAt
                          ? new Date(apiKey.lastUsedAt).toLocaleString("pt-BR")
                          : "Nunca"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={apiKey.active !== false ? "default" : "destructive"}
                        >
                          {apiKey.active !== false ? "Ativa" : "Revogada"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {apiKey.active !== false && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setRevokingKey(apiKey)}
                          >
                            <Trash2 size={14} className="mr-1" />
                            Revogar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Usage instructions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Terminal size={20} className="text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Como usar</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Inclua sua API key no header <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">X-API-Key</code> de cada requisicao:
          </p>
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-green-400 font-mono whitespace-pre">
{`curl -X GET "${apiBaseUrl}/api/v1/leads" \\
  -H "X-API-Key: fcrm_your_api_key_here" \\
  -H "Content-Type: application/json"`}
            </pre>
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Nunca compartilhe suas API keys publicamente ou inclua em codigo client-side. Trate-as como senhas.
            </p>
          </div>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={closeCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createdKey ? "API Key Criada" : "Criar API Key"}
            </DialogTitle>
            <DialogDescription>
              {createdKey
                ? "Copie a chave abaixo. Ela nao sera exibida novamente."
                : "De um nome para identificar esta chave de API."}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="py-4 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Esta e a unica vez que a chave completa sera exibida. Copie e guarde em local seguro.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-3">
                <code className="text-sm font-mono flex-1 break-all">{createdKey}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(createdKey)}
                >
                  <Copy size={14} className="mr-1" />
                  Copiar
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <Label htmlFor="key-name">Nome da chave</Label>
              <Input
                id="key-name"
                placeholder="Ex: Integracao Zapier, App Mobile"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={closeCreateDialog}>Fechar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeCreateDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
                  Gerar chave
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokingKey} onOpenChange={() => setRevokingKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar API key?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave <strong>{revokingKey?.name}</strong> sera desativada permanentemente. Qualquer integracao que use esta chave parara de funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-red-600 hover:bg-red-700">
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
