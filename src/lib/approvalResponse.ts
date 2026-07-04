// Upgrade RD parity — P1 · F2 Governança (spec upgrade-rd-parity.md, reqs 15/16).
//
// Quando o perfil de permissão do usuário exige aprovação do gestor para uma ação
// (export / bulk / delete), o backend NÃO executa a ação: cria um ApprovalRequest e
// responde 202 com { status: 202, data: { approvalId, pending: true } } em vez do
// resultado normal (blob de export, { affected }, {} de delete, etc.).
//
// Este helper detecta esse envelope 202 nas várias formas em que ele chega ao front
// (JSON já parseado OU Blob de download que na verdade carrega o JSON), mostra o toast
// "Enviado para aprovação do gestor" e sinaliza ao chamador que NÃO deve seguir o
// fluxo de sucesso. Quando a resposta é execução imediata (== hoje, sem perfil custom),
// nada acontece e o chamador segue normalmente.

import { toast } from 'sonner';

/** Forma canônica do envelope de aprovação pendente (202). */
export interface PendingApproval {
  approvalId: string;
  pending: true;
}

/**
 * Extrai um PendingApproval de um valor arbitrário retornado por apiClient.
 * Aceita tanto o envelope embrulhado `{ status: 202, data: { approvalId, pending } }`
 * quanto o objeto plano `{ approvalId, pending: true }`. Retorna null se não for pendente.
 */
export function extractPendingApproval(value: unknown): PendingApproval | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;

  // Envelope embrulhado: { status, data: {...} }
  const candidate =
    obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj;

  if (candidate.pending === true && typeof candidate.approvalId === 'string') {
    return { approvalId: candidate.approvalId, pending: true };
  }
  return null;
}

/**
 * Caminho de export: o cliente devolve um Blob (response.blob()). Quando a ação exige
 * aprovação, o Blob na verdade contém o JSON 202. Detecta esse caso lendo o texto do
 * Blob apenas quando o content-type é JSON (blobs binários de CSV/XLSX não são tocados).
 * Retorna o PendingApproval quando for aprovação pendente; null caso contrário.
 */
export async function extractPendingApprovalFromBlob(
  blob: Blob
): Promise<PendingApproval | null> {
  // Exports reais têm type text/csv, application/vnd... ou application/json (JSON export
  // de dados). Só um JSON minúsculo com o envelope é aprovação — testamos o conteúdo.
  const type = blob.type || '';
  if (!type.includes('json')) return null;
  // Envelope de aprovação é pequeno; evita ler megabytes de um JSON export legítimo.
  if (blob.size > 4096) return null;
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as unknown;
    return extractPendingApproval(parsed);
  } catch {
    return null;
  }
}

/** Toast padrão exibido quando uma ação foi enfileirada para aprovação do gestor. */
export function notifyPendingApproval(): void {
  toast.info('Enviado para aprovação do gestor', {
    description: 'A ação será executada quando um gestor aprovar a solicitação.',
  });
}

/**
 * Conveniência para ações que passam pelo apiClient.request (bulk/delete): se `value`
 * for um envelope de aprovação pendente, mostra o toast e retorna true (chamador deve
 * PARAR o fluxo de sucesso). Caso contrário retorna false (segue normalmente).
 */
export function handlePendingApproval(value: unknown): boolean {
  const pending = extractPendingApproval(value);
  if (pending) {
    notifyPendingApproval();
    return true;
  }
  return false;
}
