/**
 * Seed da configuração-alvo do RD Station (estrutura idêntica) para um tenant:
 * 8 funis de negociação com etapas+siglas, 13 motivos de perda e os ~39 campos
 * personalizados de Negociação. Idempotente (upsert). Dry-run por padrão.
 *
 *   npx tsx scripts/seed-rd-config.ts                 # dry-run (só conta, não grava)
 *   npx tsx scripts/seed-rd-config.ts --write         # grava no tenant padrão
 *   npx tsx scripts/seed-rd-config.ts --write --slug=k2-engenharia-e-tecnologia
 *
 * Refs: spec gestao-negocios-rdstation "Dados de Migração" (reqs 7, 13, 22).
 */
import prisma from '../src/config/database.js';
import { CustomFieldType, FunnelType } from '@prisma/client';

const WRITE = process.argv.includes('--write');
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const SLUG = slugArg ? slugArg.split('=')[1] : 'k2-engenharia-e-tecnologia';

// stage: "Título (SIGLA)" → { title, abbreviation }
function parseStage(s: string): { title: string; abbreviation: string | null } {
  const m = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m
    ? { title: m[1].trim(), abbreviation: m[2].trim() }
    : { title: s.trim(), abbreviation: null };
}

const FUNNELS: { name: string; stages: string[] }[] = [
  {
    name: 'Gestão de Contratos',
    stages: [
      'Registro da Solicitação (RDS)',
      'Análise da Minuta Contratual–Circulação (ADMC-C)',
      'Envio da Minuta Contratual ao Cliente (EDMCAC)',
      'Revisão Final do Contrato (RFDC)',
      'Liberação para Assinatura do Contrato (LPADC)',
      'Contratos Ativos',
      'Contratos Paralisados',
      'Contratos Encerrados',
    ],
  },
  {
    name: 'Desenvolvimento de Negócios',
    stages: [
      'Oportunidades',
      'Licitações Públicas',
      'Qualificação das Oportunidades (QDO)',
      'Habilitação Técnica Financeira (HTF)',
      'Identificação de Contatos e Alianças (IDCEA)',
      'Em tentativa de Contato (ETDC)',
      'Conexão aos Contatos (CAC)',
      'Apresentação',
      'Acompanhamento',
    ],
  },
  {
    name: 'Cadastro no Cliente',
    stages: [
      'Registro do Cadastro (RDC)',
      'Avaliação dos Documentos Solicitados (ADDS)',
      'Solicitação de Documentos aos Setores Internos (SDDASI)',
      'Documentação Enviada ao Cliente (DEAC)',
      'Documentação Não Aprovada (DNA)',
      'Documentação Aprovada',
    ],
  },
  {
    name: 'GO, NO GO – Convites',
    stages: [
      'Registro do Convite (RDC)',
      'Avaliação Inicial–Comercial (AI-C)',
      'Avaliação Diretoria Técnica (ADT)',
      'Avaliação Diretoria Comercial (ADC)',
      'Avaliação Presidência',
      'Propostas GO',
      'Proposta NO GO (PNG)',
    ],
  },
  {
    name: 'Orçamentos',
    stages: [
      'Registro do Número de Proposta (RDNDP)',
      'Reunião de Esclarecimento (RDE)',
      'Elaboração de Proposta e Estimativas Técnicas (EDPEET)',
      'Elaboração de Proposta Comercial (EDPC)',
      'Revisão Comercial',
      'Fechamento–Diretoria (F-D)',
      'Reunião de Entrega com o Cliente (RDECOC)',
      'Envio de Propostas ao Cliente (EDPAC)',
      'Revisão da Proposta a Pedido do Cliente (RDPAPDC)',
    ],
  },
  {
    name: 'Proposta e Estimativas Técnicas',
    stages: [
      'Registro da Solicitação (RDS)',
      'Apresentação do Escopo (ADE)',
      'Estimativa de Recursos (EDR)',
      'Fechamento e Revisão PT (FERP)',
      'Proposta e Estimativa Enviada (PEEE)',
    ],
  },
  {
    name: 'Pipeline de Oportunidades',
    stages: [
      'Leads Identificados',
      'Conexão aos Leads (CAL)',
      'Reunião Agendada',
      'Diagnóstico',
      'Acompanhamento',
    ],
  },
  {
    name: 'Relacionamento com Clientes',
    stages: ['Cliente Ativo', 'Cliente Inativo'],
  },
];

const LOST_REASONS = [
  'Cliente Bloqueado',
  'Cliente optou por não realizar o projeto',
  'Contrato de Pequeno Porte',
  'Equipe Comercial Indisponível',
  'Equipe Técnica Indisponível',
  'Falta de Atestação',
  'Falta de Competitividades',
  'Falta de Expertise',
  'Fechou com outra empresa',
  'Fora da área de negócios da TENAX',
  'Prazo Curto de Proposta',
  'Preço',
  'Sem retorno do Cliente',
];

// type: 'multi' | 'única' | 'texto' | 'data'  → CustomFieldType
const T = {
  multi: CustomFieldType.MULTI_SELECT,
  unica: CustomFieldType.SELECT,
  texto: CustomFieldType.TEXT,
  data: CustomFieldType.DATE,
} as const;

const DEAL_FIELDS: { name: string; type: CustomFieldType }[] = [
  { name: 'Enquadramento', type: T.multi },
  { name: 'Origem', type: T.multi },
  { name: 'Origem da Solicitação', type: T.multi },
  { name: 'Visita Técnica', type: T.multi },
  { name: 'Critérios de Medição', type: T.texto },
  { name: 'Escopo Geral', type: T.texto },
  { name: 'Entrega da Proposta', type: T.data },
  { name: 'Detalhes da Entrega da Proposta', type: T.texto },
  { name: 'Recomendação de GNG Comercial', type: T.unica },
  { name: 'Prazo para Pagamento', type: T.texto },
  { name: 'Seguros/Garantias', type: T.texto },
  { name: 'Riscos Comerciais Identificados', type: T.texto },
  { name: 'Número da Proposta', type: T.texto },
  { name: 'Disciplinas Envolvidas', type: T.multi },
  { name: 'Recomendação de GNG Técnico', type: T.unica },
  { name: 'Metodologia de Projeto', type: T.multi },
  { name: 'Prazo para Elaboração dos Projetos', type: T.texto },
  { name: 'Exclusões de Escopo', type: T.texto },
  { name: 'Necessidade de Subcontratação', type: T.unica },
  { name: 'Riscos Técnicos Identificados', type: T.texto },
  { name: 'Atividades Sob Domínio', type: T.unica },
  { name: 'Considerações Técnicas', type: T.texto },
  { name: 'Tipo de Proposta', type: T.unica },
  { name: 'Revisão', type: T.texto },
  { name: 'Margem Bruta %', type: T.texto },
  { name: 'Empresa TENAX', type: T.unica },
  { name: 'Responsável BI', type: T.unica },
  { name: 'Natureza do Cliente', type: T.unica },
  { name: 'Reajustamento dos Preços', type: T.texto },
  { name: 'Data Base dos Preços', type: T.data },
  { name: 'Critério de Medição', type: T.texto },
  { name: 'Prazo de Execução', type: T.texto },
  { name: 'Riscos Observados', type: T.texto },
  { name: 'Prazo de Vigência do Contrato', type: T.texto },
  { name: 'Classificação do Ticket', type: T.multi },
  { name: 'Pendências', type: T.texto },
  { name: 'Documentos Solicitados', type: T.texto },
  { name: '% Go x Get', type: T.texto },
  { name: 'Recomendação de GNG Presidência', type: T.multi },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } });
  if (!tenant) {
    console.error(`Tenant slug="${SLUG}" não encontrado.`);
    process.exit(1);
  }
  const tenantId = tenant.id;
  const totalStages = FUNNELS.reduce((n, f) => n + f.stages.length, 0);
  console.log(
    `[${WRITE ? 'WRITE' : 'DRY-RUN'}] tenant=${SLUG} → ${FUNNELS.length} funis (${totalStages} etapas), ` +
      `${LOST_REASONS.length} motivos de perda, ${DEAL_FIELDS.length} campos de Negociação.`
  );
  if (!WRITE) {
    console.log('Dry-run: nada gravado. Use --write para aplicar.');
    return;
  }

  // 1) Motivos de perda
  for (let i = 0; i < LOST_REASONS.length; i++) {
    await prisma.lostReason.upsert({
      where: { tenantId_label: { tenantId, label: LOST_REASONS[i] } },
      update: { active: true, order: i },
      create: { tenantId, label: LOST_REASONS[i], order: i },
    });
  }

  // 2) Campos personalizados de Negociação (entity=DEAL)
  for (let i = 0; i < DEAL_FIELDS.length; i++) {
    const f = DEAL_FIELDS[i];
    await prisma.customField.upsert({
      where: { tenantId_name: { tenantId, name: f.name } },
      update: { type: f.type, entity: 'DEAL', order: i, active: true },
      create: { tenantId, name: f.name, type: f.type, entity: 'DEAL', order: i },
    });
  }

  // 3) Funis + etapas (com sigla)
  for (let fi = 0; fi < FUNNELS.length; fi++) {
    const f = FUNNELS[fi];
    const funnel = await prisma.funnel.upsert({
      where: { tenantId_name_type: { tenantId, name: f.name, type: FunnelType.DEAL } },
      update: { order: fi },
      create: { tenantId, name: f.name, type: FunnelType.DEAL, order: fi },
    });
    for (let si = 0; si < f.stages.length; si++) {
      const { title, abbreviation } = parseStage(f.stages[si]);
      const existing = await prisma.funnelColumn.findFirst({
        where: { funnelId: funnel.id, title },
      });
      if (existing) {
        await prisma.funnelColumn.update({
          where: { id: existing.id },
          data: { order: si, abbreviation, isDefault: si === 0 },
        });
      } else {
        await prisma.funnelColumn.create({
          data: { funnelId: funnel.id, title, abbreviation, order: si, isDefault: si === 0 },
        });
      }
    }
  }

  const counts = {
    funis: await prisma.funnel.count({ where: { tenantId, type: FunnelType.DEAL } }),
    motivos: await prisma.lostReason.count({ where: { tenantId } }),
    campos: await prisma.customField.count({ where: { tenantId, entity: 'DEAL' } }),
  };
  console.log('Gravado. Contagens:', JSON.stringify(counts));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERRO:', e?.stack || e);
    process.exit(1);
  });
