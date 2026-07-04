/**
 * Verificação de integridade pós-importação (read-only). Prova que a carga do
 * BD legado no tenant da K2 está completa e correta — sem perda de dados.
 *   npx tsx scripts/verify-bd-legacy.ts
 */
import fs from 'fs';
import prisma from '../src/config/database.js';
import { parseImportFile, analyzeCompanies, analyzeLeads, type ColumnMapping } from '../src/services/importService.js';

const SLUG = 'k2-engenharia-e-tecnologia';
const EMPRESAS = 'C:/Users/Kleber Bastos/Downloads/BD - Empresas.xls';
const CONTATOS = 'C:/Users/Kleber Bastos/Downloads/BD - Contatos.xls';
const norm = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

const COMPANY_MAPPING: ColumnMapping = {
  ID: 'externalId', Nome: 'name', Resumo: 'notes', URL: 'website', CNPJ: 'cnpj',
  'Nome Fantasia': 'fantasyName', Segmentos: 'industry', 'Data de criação': 'createdAt', 'Hora de criação': 'createdAtTime',
  'Valor único vendido': 'Valor único vendido', 'Valor recorrente vendido': 'Valor recorrente vendido',
  'Data do último contato': 'Data do último contato', 'Hora do último contato': 'Hora do último contato',
  Vendas: 'Vendas', Perdidos: 'Perdidos', Pausados: 'Pausados', 'Em andamento': 'Em andamento', Total: 'Total',
};
const CONTACT_MAPPING: ColumnMapping = {
  Nome: 'name', Empresa: 'company', Cargo: 'position', Email: 'email', Telefone: 'phone',
  'Data de criação': 'createdAt', 'Hora de criação': 'createdAtTime',
  'Contato e envio de comunicação': 'Consentimento', 'Status de contato e envio de comunicação': 'Status de consentimento', Celular: 'Celular',
};

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true } });
  const tenantId = tenant!.id;

  // ---- Arquivos (esperado) ----
  const empParsed = await parseImportFile(fs.readFileSync(EMPRESAS), 'BD - Empresas.xls', 'application/vnd.ms-excel');
  const conParsed = await parseImportFile(fs.readFileSync(CONTATOS), 'BD - Contatos.xls', 'application/vnd.ms-excel');
  const fileExternalIds = new Set(empParsed.rows.map((r) => (r['ID'] || '').trim()).filter(Boolean));

  // ---- 1) Contagens ----
  const companies = await prisma.company.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true, externalId: true, customFields: true } });
  const contacts = await prisma.lead.findMany({ where: { tenantId, deletedAt: null, isContact: true }, select: { id: true, name: true, company: true, companyId: true, email: true, customFields: true } });
  console.log(`[1] Contagens: empresas=${companies.length} (arquivo=${empParsed.rows.length}) | contatos=${contacts.length} (arquivo=${conParsed.rows.length})`);

  // ---- 2) Cobertura de externalId (toda empresa do arquivo está no banco) ----
  const dbExternalIds = new Set(companies.map((c) => c.externalId).filter(Boolean) as string[]);
  const missing = [...fileExternalIds].filter((id) => !dbExternalIds.has(id));
  console.log(`[2] externalId: arquivo=${fileExternalIds.size} | banco=${dbExternalIds.size} | FALTANDO=${missing.length}` + (missing.length ? ` ${JSON.stringify(missing.slice(0, 10))}` : ' ✅'));

  // ---- 3) Precisão de vínculo contato→empresa ----
  const companyByName = new Map(companies.map((c) => [norm(c.name), c.id]));
  let withCompanyStr = 0, matchable = 0, linked = 0;
  const matchableButUnlinked: string[] = [];
  for (const c of contacts) {
    if (c.companyId) linked++;
    if ((c.company || '').trim()) {
      withCompanyStr++;
      if (companyByName.has(norm(c.company))) {
        matchable++;
        if (!c.companyId) matchableButUnlinked.push(`${c.name} / ${c.company}`);
      }
    }
  }
  console.log(`[3] Vínculo: comEmpresa(texto)=${withCompanyStr} | casáveis=${matchable} | linkados=${linked} | casáveis SEM link=${matchableButUnlinked.length}` + (matchableButUnlinked.length ? ` ${JSON.stringify(matchableButUnlinked.slice(0, 20))}` : ' ✅'));

  // ---- 4) Cobertura de custom fields ----
  const cf = (obj: unknown, key: string) => obj && typeof obj === 'object' && (obj as Record<string, unknown>)[key] != null && (obj as Record<string, unknown>)[key] !== '';
  const compValorUnico = companies.filter((c) => cf(c.customFields, 'Valor único vendido')).length;
  const compTotal = companies.filter((c) => cf(c.customFields, 'Total')).length;
  const conCelular = contacts.filter((c) => cf(c.customFields, 'Celular')).length;
  const conConsent = contacts.filter((c) => cf(c.customFields, 'Consentimento')).length;
  const conEmail = contacts.filter((c) => (c.email || '').trim()).length;
  console.log(`[4] Custom fields: empresas c/ 'Valor único vendido'=${compValorUnico} c/ 'Total'=${compTotal} | contatos c/ Celular=${conCelular} c/ Consentimento=${conConsent} | contatos c/ email=${conEmail} (sem email=${contacts.length - conEmail})`);

  // ---- 5) Idempotência: reanalisar os arquivos contra o banco já carregado ----
  const empRe = await analyzeCompanies(tenantId, empParsed, COMPANY_MAPPING);
  const conRe = await analyzeLeads(tenantId, conParsed, CONTACT_MAPPING, { contactsMode: true });
  console.log(`[5] Idempotência (re-análise): empresas novas=${empRe.analysis.newCount} dup=${empRe.analysis.duplicateCount} | contatos novos=${conRe.analysis.newCount} dup=${conRe.analysis.duplicateCount}`);
  console.log(`    (esperado: 0 novas em ambos → reimportar não duplica)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERRO:', e?.stack || e); process.exit(1); });
