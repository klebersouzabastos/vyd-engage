// Tipos do módulo de Gestão de Atestados Técnicos (frontend).

export type AtestadoOrigem = 'PROPRIO' | 'TERCEIRO';
export type AcervoTipo = 'OPERACIONAL' | 'PROFISSIONAL' | 'AMBOS';
export type VinculoProfissional = 'SOCIO' | 'CLT' | 'CONTRATO' | 'DESLIGADO';
export type NaturezaParceria = 'CONSORCIO' | 'SUBCONTRATACAO' | 'CESSAO_DE_ACERVO';
export type AtestadoDocStatus = 'SEM_DOCUMENTO' | 'PENDENTE_EXTRACAO' | 'OK' | 'ILEGIVEL';
export type MatchStatus = 'ATENDE' | 'ATENDE_PARCIAL' | 'NAO_ATENDE' | 'REVISAR';
export type ConcorrenciaStatus = 'RASCUNHO' | 'ANALISANDO' | 'CONCLUIDA' | 'ARQUIVADA';
export type ExigenciaAcervo = 'OPERACIONAL' | 'PROFISSIONAL' | 'INDEFINIDO';
export type TaxonomiaTipo = 'CATEGORIA' | 'DISCIPLINA' | 'SEGMENTO' | 'SERVICO';

export interface AtestadoFuncao {
  id: string;
  funcao: string;
  categoria: string | null;
}
export interface AtestadoResponsavel {
  id: string;
  profissional: { id: string; nome: string; vinculo?: VinculoProfissional };
  funcoes: AtestadoFuncao[];
}
export interface AtestadoQuantitativo {
  id: string;
  grandeza: string;
  valor: string | number;
  unidade: string;
  descricao: string | null;
}
export interface Atestado {
  id: string;
  numero: string;
  caixa: string | null;
  contratante: string;
  contrato: string | null;
  objeto: string;
  periodoTexto: string | null;
  valorContrato: string | number | null;
  origem: AtestadoOrigem;
  acervoTipo: AcervoTipo;
  artNumero: string | null;
  catNumero: string | null;
  conselho: string | null;
  conselhoUF: string | null;
  docStatus: AtestadoDocStatus;
  documentoAttachmentId: string | null;
  terceiroId: string | null;
  terceiro?: { id: string; empresa: string } | null;
  responsaveis: AtestadoResponsavel[];
  quantitativos: AtestadoQuantitativo[];
}

export interface Profissional {
  id: string;
  nome: string;
  titulo: string | null;
  conselho: string | null;
  conselhoNum: string | null;
  conselhoUF: string | null;
  disciplinas: string[];
  segmento: string | null;
  area: string | null;
  vinculo: VinculoProfissional;
  email: string | null;
  telefone: string | null;
  curriculoResumo: string | null;
}

export interface Terceiro {
  id: string;
  empresa: string;
  contatoNome: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
  validadeParceria: string | null;
  condicoes: string | null;
  usoLivre: boolean;
  naturezaParceria: NaturezaParceria | null;
  _count?: { atestados: number };
}

export interface PendenciaStatus {
  id: string;
  nome: string;
  ordem: number;
  isFinal: boolean;
  builtin: boolean;
}
export interface Pendencia {
  id: string;
  titulo: string;
  descricao: string | null;
  responsavelId: string | null;
  prazo: string | null;
  statusId: string;
  status: PendenciaStatus;
  origem: 'DEAL' | 'CONTRATO' | 'MANUAL';
  dealId: string | null;
  companyId: string | null;
  osRef: string | null;
  atestadoId: string | null;
}

export interface ExigenciaMatch {
  id: string;
  atestadoId: string;
  status: MatchStatus;
  confianca: number | null;
  quantComprovado: string | number | null;
  trecho: string | null;
  incluido: boolean;
  manual: boolean;
  rtDesligado?: boolean;
  alertaTerceiro?: boolean;
  atestado: {
    id: string;
    numero: string;
    contratante: string;
    objeto: string;
    origem: AtestadoOrigem;
    terceiro?: { id: string; empresa: string } | null;
  };
}
export interface ConcorrenciaExigencia {
  id: string;
  ordem: number;
  descricao: string;
  acervo: ExigenciaAcervo;
  grandeza: string | null;
  quantMinimo: string | number | null;
  unidade: string | null;
  permiteSomatorio: boolean;
  somatorioAtual?: number;
  matches: ExigenciaMatch[];
  statusAgregado: MatchStatus;
  alertaRtDesligado: boolean;
  alertaTerceiro?: boolean;
}
export interface Concorrencia {
  id: string;
  titulo: string;
  orgao: string | null;
  editalTexto: string | null;
  editalAttachmentId: string | null;
  dossieAttachmentId: string | null;
  status: ConcorrenciaStatus;
  incluirTerceiros: boolean;
  analiseErro: string | null;
  exigencias: ConcorrenciaExigencia[];
  _count?: { exigencias: number };
}

export interface Curriculo {
  id: string;
  profissionalId: string;
  titulo: string;
  segmento: string | null;
  area: string | null;
  disciplina: string | null;
  corpo: string;
  concorrenciaId: string | null;
  attachmentId: string | null;
  profissional?: { id: string; nome: string };
}

export interface Taxonomia {
  id: string;
  tipo: TaxonomiaTipo;
  nome: string;
  builtin: boolean;
}

export interface AtestadoStatus {
  aiEnabled: boolean;
  embeddingEnabled: boolean;
}

export interface BuscaResult {
  score: number;
  trecho: string;
  atestado: Atestado;
}

export interface ImportReport {
  batchId: string;
  totalRows: number;
  created: number;
  skipped: number;
  errors: Array<{ numero: string; motivo: string }>;
}

export interface AtestadoSuggestion {
  contratante: string | null;
  objeto: string | null;
  contrato: string | null;
  artNumero: string | null;
  catNumero: string | null;
  conselho: string | null;
  conselhoUF: string | null;
  dataInicioISO: string | null;
  dataConclusaoISO: string | null;
  valorContrato: number | null;
  responsaveis: Array<{ nome: string; funcoes: Array<{ funcao: string; categoria: string | null }> }>;
  quantitativos: Array<{ grandeza: string; valor: number; unidade: string }>;
}
export interface SugestaoResponse {
  extraction: { status: string; engine: string; message: string | null };
  suggestion: AtestadoSuggestion | null;
  textoExtraido: string | null;
}

// Payloads de escrita
export interface AtestadoInput {
  numero: string;
  caixa?: string | null;
  contratante: string;
  contrato?: string | null;
  objeto: string;
  periodoTexto?: string | null;
  valorContrato?: number | null;
  origem?: AtestadoOrigem;
  acervoTipo?: AcervoTipo;
  artNumero?: string | null;
  catNumero?: string | null;
  conselho?: string | null;
  conselhoUF?: string | null;
  terceiroId?: string | null;
  responsaveis?: Array<{ profissionalId?: string; nome?: string; funcoes: Array<{ funcao: string; categoria?: string | null }> }>;
  quantitativos?: Array<{ grandeza: string; valor: number; unidade: string; descricao?: string | null }>;
}
