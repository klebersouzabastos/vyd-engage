import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportStakeholdersDialog } from '../ImportStakeholdersDialog';
import type { ImportStakeholderRow, StakeholderPreviewRow } from '../../../types/comercial';

/**
 * Diálogo "Importar da pesquisa" (Pesquisa de Empresa → Organograma do
 * Desdobramento). Presentacional: recebe as linhas do cap. 7 já cruzadas com os
 * contatos da empresa e devolve, em onImport, só as confirmadas pelo gestor —
 * os nomes vêm de fontes públicas e podem estar errados, então nada entra sem
 * confirmação humana.
 */
const ROWS: StakeholderPreviewRow[] = [
  {
    name: 'Ana Souza',
    position: 'Diretora de Engenharia',
    email: 'ana@acme.com',
    classification: 'decide',
    suggestedRole: 'DECISOR',
    alreadyStakeholder: false,
  },
  {
    name: 'Carlos Lima',
    position: 'Gerente de Suprimentos',
    classification: 'influencia / veta',
    suggestedRole: 'APROVADOR',
    existingLeadId: 'lead-carlos',
    alreadyStakeholder: false,
  },
  {
    name: 'Bruno Reis',
    position: 'Coordenador',
    classification: 'influencia',
    suggestedRole: 'INFLUENCIADOR',
    existingLeadId: 'lead-bruno',
    alreadyStakeholder: true,
  },
  {
    name: 'Sem Cargo',
    classification: 'influencia',
    suggestedRole: 'INFLUENCIADOR',
    alreadyStakeholder: false,
  },
];

function renderDialog(props: Partial<React.ComponentProps<typeof ImportStakeholdersDialog>> = {}) {
  const onImport = vi.fn(async () => {});
  render(
    <ImportStakeholdersDialog
      open
      onOpenChange={() => {}}
      researchTitle="Empresa: ACME"
      rows={ROWS}
      onImport={onImport}
      {...props}
    />
  );
  return { onImport };
}

describe('ImportStakeholdersDialog', () => {
  it('lista os decisores da pesquisa com cargo e sinaliza quem já existe na empresa', () => {
    renderDialog();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Diretora de Engenharia')).toBeInTheDocument();
    expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
    // Carlos existe como contato → vai ser vinculado; Bruno já é stakeholder.
    expect(screen.getAllByText(/já cadastrado/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/já é stakeholder/i)).toBeInTheDocument();
  });

  it('por padrão seleciona só quem tem nome + cargo e ainda não é stakeholder', () => {
    renderDialog();
    const caixas = screen.getAllByRole('checkbox');
    expect(caixas).toHaveLength(ROWS.length);
    expect(caixas[0]).toHaveAttribute('aria-checked', 'true'); // Ana
    expect(caixas[1]).toHaveAttribute('aria-checked', 'true'); // Carlos (existe, mas ainda não é stakeholder)
    expect(caixas[2]).toHaveAttribute('aria-checked', 'false'); // Bruno: já é stakeholder
    expect(caixas[3]).toHaveAttribute('aria-checked', 'false'); // sem cargo
    expect(screen.getByRole('button', { name: /importar 2/i })).toBeInTheDocument();
  });

  it('importa só as linhas marcadas, com o papel sugerido e o vínculo ao contato existente', async () => {
    const { onImport } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /importar 2/i }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const rows = (onImport.mock.calls as unknown as Array<[ImportStakeholderRow[]]>)[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'Ana Souza',
      position: 'Diretora de Engenharia',
      email: 'ana@acme.com',
      classification: 'decide',
      roleInDecision: 'DECISOR',
    });
    expect(rows[0].existingLeadId).toBeUndefined();
    expect(rows[1]).toMatchObject({ name: 'Carlos Lima', roleInDecision: 'APROVADOR', existingLeadId: 'lead-carlos' });
  });

  it('desmarcar uma linha tira-a da importação e atualiza o contador do botão', () => {
    renderDialog();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: /importar 1/i })).toBeInTheDocument();
  });

  it('sem linhas, explica que a pesquisa não tem Mapa de Stakeholders reconhecível', () => {
    renderDialog({ rows: [] });
    expect(screen.getByText(/mapa de stakeholders/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /importar/i })).toBeDisabled();
  });
});
