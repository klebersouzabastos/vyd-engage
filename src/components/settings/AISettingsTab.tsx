import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle, XCircle, Sparkles, Info } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../services/api/client';
import type { AIConfig, AIConnectionTest } from '../../types';

export function AISettingsTab() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AIConnectionTest | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const result = await apiClient.getAIConfig();
      setConfig(result.data);
    } catch (error: any) {
      console.error('Erro ao carregar configuracao de IA:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await apiClient.testAIConnection();
      setTestResult(result.data);
      if (result.data.success) {
        toast.success('Conexao com provider de IA testada com sucesso!');
      } else {
        toast.error(`Falha na conexao: ${result.data.error}`);
      }
    } catch (error: any) {
      toast.error('Erro ao testar conexao');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const providerLabel =
    config?.provider === 'openai'
      ? 'OpenAI'
      : config?.provider === 'anthropic'
        ? 'Anthropic'
        : 'Nenhum';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Sparkles size={20} className="text-purple-500" />
          Inteligencia Artificial
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure o provider de IA para geracao de emails e outras funcionalidades inteligentes.
        </p>
      </div>

      {/* Status */}
      <div className="p-4 rounded-lg border border-gray-200 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Status da IA</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Provider: {providerLabel}
              {config?.model && ` | Modelo: ${config.model}`}
            </p>
          </div>
          <Badge
            variant={config?.configured ? 'default' : 'secondary'}
            className={config?.configured ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
          >
            {config?.configured ? (
              <>
                <CheckCircle size={12} className="mr-1" />
                IA Configurada
              </>
            ) : (
              'Sem IA — usando templates'
            )}
          </Badge>
        </div>
      </div>

      {/* Configuration info */}
      <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
        <div className="flex gap-3">
          <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Como configurar</p>
            <p>
              A configuracao do provider de IA e feita via variaveis de ambiente no servidor.
              Adicione as seguintes variaveis ao seu arquivo{' '}
              <code className="bg-blue-100 px-1 rounded">.env</code>:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
              <li>
                <code className="bg-blue-100 px-1 rounded">AI_PROVIDER</code> — <code>openai</code>{' '}
                ou <code>anthropic</code>
              </li>
              <li>
                <code className="bg-blue-100 px-1 rounded">AI_API_KEY</code> — Sua chave de API
              </li>
              <li>
                <code className="bg-blue-100 px-1 rounded">AI_MODEL</code> — Modelo especifico
                (opcional)
              </li>
            </ul>
            <p className="mt-2 text-xs">
              Alternativamente, defina{' '}
              <code className="bg-blue-100 px-1 rounded">OPENAI_API_KEY</code> ou{' '}
              <code className="bg-blue-100 px-1 rounded">ANTHROPIC_API_KEY</code> diretamente.
            </p>
          </div>
        </div>
      </div>

      {/* Test connection */}
      {config?.configured && (
        <div className="p-4 rounded-lg border border-gray-200 bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Testar Conexao</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Verifica se o provider de IA esta acessivel e a chave e valida.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
              className="gap-2"
            >
              {testing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Testando...
                </>
              ) : (
                'Testar Conexao'
              )}
            </Button>
          </div>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
                testResult.success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle size={16} />
                  Conexao com {testResult.provider} bem-sucedida!
                </>
              ) : (
                <>
                  <XCircle size={16} />
                  Falha: {testResult.error}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fallback info */}
      {!config?.configured && (
        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            Sem provider de IA configurado, o sistema utiliza <strong>templates estaticos</strong>{' '}
            para geracao de emails. Os templates preenchem automaticamente os dados do lead/deal e
            estao disponiveis em portugues.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Funcionalidade 100% operacional mesmo sem IA — os templates cobrem os 4 cenarios mais
            comuns: primeiro contato, follow-up, proposta comercial e agradecimento.
          </p>
        </div>
      )}
    </div>
  );
}
