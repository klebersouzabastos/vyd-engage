// Interface comum dos motores de pesquisa profunda (Deep Research).
//
// Dois modos de execução:
//  - assíncrono (isAsync=true): start() dispara e retorna um jobId; o poller
//    consulta poll() até concluir. Ex.: OpenAI Responses (background), Perplexity
//    async. Resiliente a reinício do servidor.
//  - síncrono (isAsync=false): run() executa a chamada (via streaming, para não
//    estourar timeout) e retorna o resultado completo. Ex.: OpenRouter.

export interface ResearchSource {
  title?: string;
  url: string;
  date?: string;
}

export interface ProviderResult {
  status: 'pending' | 'completed' | 'failed';
  markdown?: string;
  /** URLs das fontes (compat). */
  sources?: string[];
  /** Fontes ricas (título/URL/data) quando o provedor as expõe. */
  searchResults?: ResearchSource[];
  error?: string;
}

export interface ResearchProvider {
  name: string;
  /** true = start()+poll(); false = run() síncrono (streaming). */
  isAsync: boolean;
  /** Configurado (chave presente). */
  enabled(): boolean;
  /** Assíncrono: dispara a pesquisa e retorna o id para acompanhamento. */
  start?(prompt: string): Promise<string>;
  /** Assíncrono: consulta o status/resultado de um job. */
  poll?(jobId: string): Promise<ProviderResult>;
  /** Síncrono: executa e retorna o resultado completo. */
  run?(prompt: string): Promise<ProviderResult>;
}
