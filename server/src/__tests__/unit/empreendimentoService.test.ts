import { describe, it, expect } from 'vitest';
import { prismaMock } from '../helpers/prismaMock.js';
import { empreendimentoService } from '../../services/empreendimentoService.js';

/**
 * Caso extremo da spec: empreendimento exige uma empresa válida do mesmo tenant;
 * sem ela, a criação deve falhar com 400 (não criar registro órfão).
 */
describe('empreendimentoService.create — exige empresa válida', () => {
  it('rejeita quando a empresa não existe/não pertence ao tenant', async () => {
    prismaMock.company.findFirst.mockResolvedValue(null as never);

    await expect(
      empreendimentoService.create('tenant-1', 'user-1', {
        companyId: 'inexistente',
        name: 'Obra X',
      })
    ).rejects.toThrow(/Empresa não encontrada/);

    expect(prismaMock.empreendimento.create).not.toHaveBeenCalled();
  });

  it('cria o empreendimento quando a empresa é válida', async () => {
    prismaMock.company.findFirst.mockResolvedValue({ id: 'co1' } as never);
    prismaMock.empreendimento.create.mockResolvedValue({ id: 'emp1', name: 'Obra X' } as never);

    await empreendimentoService.create('tenant-1', 'user-1', { companyId: 'co1', name: 'Obra X' });

    expect(prismaMock.empreendimento.create).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (prismaMock.empreendimento.create as any).mock.calls[0][0].data;
    expect(data).toMatchObject({
      tenantId: 'tenant-1',
      companyId: 'co1',
      name: 'Obra X',
      status: 'ATIVO',
    });
  });
});
