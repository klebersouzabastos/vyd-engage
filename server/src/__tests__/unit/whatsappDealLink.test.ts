import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';

/**
 * Upgrade RD parity — P3 (B2, req 23): WhatsApp do deal/empresa.
 *
 * Prova que `whatsappMessagingService.sendMessage`:
 *  - com dealId/companyId → cria a Interaction WHATSAPP OUTBOUND vinculada ao
 *    deal/empresa (timeline do deal/empresa), validando o vínculo contra o tenant;
 *  - preserva o envio via Meta Graph (fetch), os stats (messagesSent++) e o
 *    comportamento por lead;
 *  - dealId de outro tenant → NÃO vincula (findFirst devolve null) mas ainda envia.
 *
 * Meta Graph (fetch), scoring e encryption são mockados p/ isolar a lógica.
 */
vi.mock('../../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/scoringService.js', () => ({
  scoringService: { processEvent: vi.fn(async () => {}) },
}));
vi.mock('../../utils/encryption.js', () => ({
  safeDecryptConfig: () => ({ phoneNumberId: 'pn-1', accessToken: 'tok-1' }),
}));

import { whatsappMessagingService } from '../../services/whatsappMessagingService.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arg0 = (fn: any) => fn.mock.calls[0][0];

const tenantId = 'tenant-1';
const CONNECTION = {
  id: 'conn-1',
  tenantId,
  status: 'CONNECTED',
  config: 'encrypted',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Conexão CONNECTED do tenant.
  prismaMock.whatsAppConnection.findFirst.mockResolvedValue(CONNECTION as never);
  prismaMock.whatsAppConnection.update.mockResolvedValue({} as never);
  prismaMock.interaction.create.mockResolvedValue({ id: 'int-1' } as never);
  // Meta Graph: fetch OK com messageId.
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ messages: [{ id: 'wamid.123' }] }),
  })) as never;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('whatsappMessagingService.sendMessage — vínculo ao deal (req 23)', () => {
  it('com dealId → Interaction WHATSAPP OUTBOUND vinculada ao deal (validada no tenant)', async () => {
    prismaMock.deal.findFirst.mockResolvedValue({ id: 'deal-1' } as never);

    const result = await whatsappMessagingService.sendMessage(tenantId, {
      connectionId: 'conn-1',
      to: '5511999999999',
      type: 'text',
      content: 'Olá!',
      dealId: 'deal-1',
    });

    // Envio via Meta Graph preservado + stats.
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(prismaMock.whatsAppConnection.update).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ messageId: 'wamid.123', status: 'sent' });

    // Interaction vinculada ao deal.
    const data = arg0(prismaMock.interaction.create).data;
    expect(data).toMatchObject({
      tenantId,
      dealId: 'deal-1',
      companyId: null,
      leadId: null,
      type: 'WHATSAPP',
      direction: 'OUTBOUND',
    });
  });

  it('com companyId → Interaction vinculada à empresa', async () => {
    prismaMock.company.findFirst.mockResolvedValue({ id: 'comp-1' } as never);

    await whatsappMessagingService.sendMessage(tenantId, {
      connectionId: 'conn-1',
      to: '5511999999999',
      type: 'text',
      content: 'Oi empresa',
      companyId: 'comp-1',
    });

    const data = arg0(prismaMock.interaction.create).data;
    expect(data).toMatchObject({ companyId: 'comp-1', dealId: null, type: 'WHATSAPP' });
  });

  it('dealId de outro tenant → não vincula (dealId null) mas ainda envia', async () => {
    prismaMock.deal.findFirst.mockResolvedValue(null as never);

    await whatsappMessagingService.sendMessage(tenantId, {
      connectionId: 'conn-1',
      to: '5511999999999',
      type: 'text',
      content: 'x',
      dealId: 'deal-de-outro-tenant',
    });

    // Envio ocorreu; Interaction NÃO foi criada (sem lead/deal/company válidos).
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(prismaMock.interaction.create).not.toHaveBeenCalled();
  });

  it('comportamento por lead preservado (sem deal/company)', async () => {
    await whatsappMessagingService.sendMessage(tenantId, {
      connectionId: 'conn-1',
      to: '5511999999999',
      type: 'text',
      content: 'lead msg',
      leadId: 'lead-1',
    });

    const data = arg0(prismaMock.interaction.create).data;
    expect(data).toMatchObject({ leadId: 'lead-1', dealId: null, companyId: null });
    // Não consulta deal/company quando só há lead.
    expect(prismaMock.deal.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.company.findFirst).not.toHaveBeenCalled();
  });

  it('sem conexão CONNECTED → 400 WHATSAPP_NOT_CONNECTED (gating)', async () => {
    prismaMock.whatsAppConnection.findFirst.mockResolvedValue(null as never);
    await expect(
      whatsappMessagingService.sendMessage(tenantId, {
        connectionId: 'conn-x',
        to: '5511999999999',
        type: 'text',
        content: 'x',
        dealId: 'deal-1',
      })
    ).rejects.toMatchObject({ statusCode: 400, code: 'WHATSAPP_NOT_CONNECTED' });
  });
});
