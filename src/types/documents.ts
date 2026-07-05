// Upgrade RD parity — P2 · Documentos & integrações externas (contrato fixado em
// specs/upgrade-rd-parity.md, reqs 17–22). Tipos consumidos por
// src/services/api/client.ts e pelas telas de Arquivos / Propostas / Modelos de
// proposta / Integrações (assinatura + telefonia) / Enriquecimento por CNPJ.

// ── Central de arquivos (req 22) ─────────────────────

export type AttachmentSource = 'UPLOAD' | 'PROPOSAL';

export interface Attachment {
  id: string;
  tenantId: string;
  name: string;
  mimeType: string;
  size: number; // bytes
  storageProvider: 'db' | 's3';
  dealId: string | null;
  companyId: string | null;
  source: AttachmentSource;
  uploadedById: string | null;
  createdAt: string;
  // Nome do autor, quando o backend faz join (opcional).
  uploadedBy?: { id: string; name: string } | null;
}

export interface StorageUsage {
  usedMB: number;
  limitMB: number; // 0 = ilimitado
}

// ── Modelos de proposta (req 17) ─────────────────────

export type ProposalTemplateStatus = 'DRAFT' | 'PUBLISHED';

export interface ProposalTemplate {
  id: string;
  tenantId: string;
  name: string;
  bodyHtml: string;
  isDefault: boolean;
  status: ProposalTemplateStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalTemplateInput {
  name: string;
  bodyHtml: string;
  isDefault?: boolean;
  status?: ProposalTemplateStatus;
}

export type UpdateProposalTemplateInput = Partial<CreateProposalTemplateInput>;

// ── Propostas geradas (req 18) + assinatura (req 19) ──

export type SignatureStatus = 'NONE' | 'SENT' | 'VIEWED' | 'SIGNED' | 'REFUSED' | 'EXPIRED';

export interface Proposal {
  id: string;
  tenantId: string;
  dealId: string;
  templateId: string | null;
  version: number;
  attachmentId: string;
  totalValue: number | null;
  signatureStatus: SignatureStatus;
  signatureEnvelopeId: string | null;
  createdById: string | null;
  createdAt: string;
  // Anexo do PDF gerado, quando o backend inclui (para baixar).
  attachment?: Attachment | null;
}

export interface GenerateProposalInput {
  templateId?: string; // ausente = usa o modelo padrão do tenant
}

export interface SendSignatureInput {
  signerEmail: string;
  signerName: string;
}

// ── Integrações plugáveis, gated (reqs 19 e 21) ──────

export interface IntegrationStatus {
  configured: boolean;
  provider?: string | null;
  active?: boolean;
}

export interface SignatureConfigInput {
  provider: 'zapsign';
  apiKey: string;
  webhookSecret: string;
}

export interface PhoneConfigInput {
  provider: 'twilio';
  accountSid: string;
  authToken: string;
  twimlAppSid?: string;
}

// ── Telefone virtual (req 21) ────────────────────────

export interface PhoneTokenResult {
  token: string;
  identity?: string;
  expiresAt?: string;
}

export interface LogCallInput {
  leadId?: string;
  dealId?: string;
  companyId?: string;
  toNumber: string;
  durationSec: number;
  recordingUrl?: string;
}

// ── Enriquecimento por CNPJ (req 20) ─────────────────

// Diff campo a campo: `current` = valor atual na empresa; `suggested` = valor
// proposto pela consulta externa. O usuário escolhe quais aplicar (o apply é o
// PUT /companies/:id normal). O backend NUNCA grava aqui.
export interface EnrichFieldDiff {
  key: string; // campo da empresa (name, fantasyName, address, industry, size, ...)
  label: string; // rótulo em pt-BR
  current: string | null;
  suggested: string | null;
}

export interface EnrichCnpjResult {
  fields: EnrichFieldDiff[];
}
