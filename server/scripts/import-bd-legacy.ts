/**
 * One-off: importa a base legada do CRM (BD - Empresas.xls / BD - Contatos.xls)
 * para o tenant da K2 em produção. Dry-run por padrão; passe `--write` para gravar.
 *
 *   npx tsx scripts/import-bd-legacy.ts            # dry-run (não grava dados)
 *   npx tsx scripts/import-bd-legacy.ts --write    # grava Empresas e Contatos
 *
 * Cria (idempotente) os custom fields necessários em ambos os modos, pois o
 * dry-run só é preciso se as definições existirem.
 */
import fs from 'fs';
import { CustomFieldType, ImportType } from '@prisma/client';
import prisma from '../src/config/database.js';
import {
  parseImportFile,
  analyzeCompanies,
  analyzeLeads,
  createBatch,
  executeBatch,
  type ColumnMapping,
} from '../src/services/importService.js';

const SLUG = 'k2-engenharia-e-tecnologia';
const EMPRESAS = 'C:/Users/Kleber Bastos/Downloads/BD - Empresas.xls';
const CONTATOS = 'C:/Users/Kleber Bastos/Downloads/BD - Contatos.xls';
const WRITE = process.argv.includes('--write');

const CUSTOM_FIELDS: Array<{ name: string; type: CustomFieldType }> = [
  // Empresa
  { name: 'Valor único vendido', type: CustomFieldType.NUMBER },
  { name: 'Valor recorrente vendido', type: CustomFieldType.NUMBER },
  { name: 'Data do último contato', type: CustomFieldType.DATE },
  { name: 'Hora do último contato', type: CustomFieldType.TEXT },
  { name: 'Vendas', type: CustomFieldType.NUMBER },
  { name: 'Perdidos', type: CustomFieldType.NUMBER },
  { name: 'Pausados', type: CustomFieldType.NUMBER },
  { name: 'Em andamento', type: CustomFieldType.NUMBER },
  { name: 'Total', type: CustomFieldType.NUMBER },
  // Contato
  { name: 'Celular', type: CustomFieldType.TEXT },
  { name: 'Consentimento', type: CustomFieldType.TEXT },
  { name: 'Status de consentimento', type: CustomFieldType.TEXT },
];

const COMPANY_MAPPING: ColumnMapping = {
  ID: 'externalId',
  Nome: 'name',
  Resumo: 'notes',
  URL: 'website',
  CNPJ: 'cnpj',
  'Nome Fantasia': 'fantasyName',
  Segmentos: 'industry',
  'Data de criação': 'createdAt',
  'Hora de criação': 'createdAtTime',
  'Valor único vendido': 'Valor único vendido',
  'Valor recorrente vendido': 'Valor recorrente vendido',
  'Data do último contato': 'Data do último contato',
  'Hora do último contato': 'Hora do último contato',
  Vendas: 'Vendas',
  Perdidos: 'Perdidos',
  Pausados: 'Pausados',
  'Em andamento': 'Em andamento',
  Total: 'Total',
};

const CONTACT_MAPPING: ColumnMapping = {
  Nome: 'name',
  Empresa: 'company',
  Cargo: 'position',
  Email: 'email',
  Telefone: 'phone',
  'Data de criação': 'createdAt',
  'Hora de criação': 'createdAtTime',
  'Contato e envio de comunicação': 'Consentimento',
  'Status de contato e envio de comunicação': 'Status de consentimento',
  Celular: 'Celular',
};

const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function main() {
  console.log(`\n=== Importação BD legado → ${SLUG} | modo: ${WRITE ? 'WRITE' : 'DRY-RUN'} ===\n`);

  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true, name: true } });
  if (!tenant) throw new Error(`Tenant ${SLUG} não encontrado`);
  const tenantId = tenant.id;
  const user = await prisma.user.findFirst({ where: { tenantId }, select: { id: true, email: true } });
  if (!user) throw new Error(`Nenhum usuário no tenant ${SLUG}`);
  console.log(`Tenant: ${tenant.name} (${tenantId}) | userId p/ batch: ${user.email}`);

  // 1) Custom fields (idempotente)
  let created = 0;
  for (const cf of CUSTOM_FIELDS) {
    const existing = await prisma.customField.findUnique({
      where: { tenantId_name: { tenantId, name: cf.name } },
      select: { id: true },
    });
    if (!existing) {
      await prisma.customField.create({ data: { tenantId, name: cf.name, type: cf.type, active: true } });
      created++;
    }
  }
  console.log(`Custom fields: ${created} criados, ${CUSTOM_FIELDS.length - created} já existiam.\n`);

  // 2) Parse
  const empBuf = fs.readFileSync(EMPRESAS);
  const conBuf = fs.readFileSync(CONTATOS);
  const empParsed = await parseImportFile(empBuf, 'BD - Empresas.xls', 'application/vnd.ms-excel');
  const conParsed = await parseImportFile(conBuf, 'BD - Contatos.xls', 'application/vnd.ms-excel');
  console.log(`Parse: Empresas=${empParsed.rows.length} linhas | Contatos=${conParsed.rows.length} linhas\n`);

  // 3) Cross-check de vínculo contato→empresa (a nível de arquivo)
  const companyNames = new Set(empParsed.rows.map((r) => norm(r['Nome'])).filter(Boolean));
  let withEmp = 0;
  let linkable = 0;
  let noEmail = 0;
  for (const r of conParsed.rows) {
    const emp = (r['Empresa'] || '').trim();
    if (emp) { withEmp++; if (companyNames.has(norm(emp))) linkable++; }
    if (!(r['Email'] || '').trim()) noEmail++;
  }

  // 4) Análise (dry-run sempre roda)
  const empA = await analyzeCompanies(tenantId, empParsed, COMPANY_MAPPING);
  const conA = await analyzeLeads(tenantId, conParsed, CONTACT_MAPPING, { contactsMode: true });

  console.log('----- EMPRESAS (análise) -----');
  console.log(`novas=${empA.analysis.newCount} | duplicadas=${empA.analysis.duplicateCount} | erros=${empA.analysis.errorCount}`);
  if (empA.analysis.errors.length) console.log('erros:', JSON.stringify(empA.analysis.errors.slice(0, 10)));
  console.log('amostra (linha 1):', JSON.stringify(empA.analysis.previewRows[0]));

  console.log('\n----- CONTATOS (análise) -----');
  console.log(`novos=${conA.analysis.newCount} | duplicados=${conA.analysis.duplicateCount} | erros=${conA.analysis.errorCount}`);
  console.log(`com empresa preenchida=${withEmp} | vinculáveis a empresa (match exato)=${linkable} | sem email=${noEmail}`);
  if (conA.analysis.errors.length) console.log('erros:', JSON.stringify(conA.analysis.errors.slice(0, 10)));
  console.log('amostra (linha 1):', JSON.stringify(conA.analysis.previewRows[0]));
  if (conA.analysis.duplicates.length) {
    console.log('DUPLICADOS (serão mesclados via upsert):');
    for (const d of conA.analysis.duplicates) {
      console.log(`  linha ${d.row}: nome="${d.name}" email="${d.email ?? ''}" (match por ${d.matchedBy})`);
    }
  }

  if (!WRITE) {
    console.log('\n>>> DRY-RUN: nada foi gravado. Rode com --write para importar.');
    return;
  }

  // 5) WRITE — Empresas primeiro, depois Contatos
  console.log('\n=== GRAVANDO ===');
  const empBatch = await createBatch(tenantId, user.id, ImportType.COMPANIES, empParsed.rows.length);
  await executeBatch(
    empBatch.id,
    { tenantId, userId: user.id, type: ImportType.COMPANIES, parsed: empParsed, mapping: COMPANY_MAPPING, duplicateStrategy: 'update' },
    { type: 'COMPANIES', rows: empA.mappedRows },
  );
  const empB = await prisma.importBatch.findUnique({ where: { id: empBatch.id } });
  console.log(`Empresas batch ${empBatch.id}: status=${empB?.status} importadas=${empB?.importedRows} erros=${empB?.errorRows}`);

  const conBatch = await createBatch(tenantId, user.id, ImportType.LEADS, conParsed.rows.length);
  await executeBatch(
    conBatch.id,
    { tenantId, userId: user.id, type: ImportType.LEADS, parsed: conParsed, mapping: CONTACT_MAPPING, duplicateStrategy: 'update', options: { contactsMode: true } },
    { type: 'LEADS', rows: conA.mappedRows },
  );
  const conB = await prisma.importBatch.findUnique({ where: { id: conBatch.id } });
  console.log(`Contatos batch ${conBatch.id}: status=${conB?.status} importados=${conB?.importedRows} erros=${conB?.errorRows}`);

  // 6) Verificação pós-escrita
  const finalCompanies = await prisma.company.count({ where: { tenantId, deletedAt: null } });
  const finalContacts = await prisma.lead.count({ where: { tenantId, deletedAt: null, isContact: true } });
  const linked = await prisma.lead.count({ where: { tenantId, deletedAt: null, isContact: true, companyId: { not: null } } });
  console.log(`\nVERIFICAÇÃO -> empresas=${finalCompanies} | contatos=${finalContacts} | contatos vinculados a empresa=${linked}`);
  console.log(`Batches (para rollback 24h): empresas=${empBatch.id} contatos=${conBatch.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('ERRO:', e?.stack || e?.message || e); process.exit(1); });
