/**
 * Convites em lote a partir de um CSV (ex.: export do People por centro de custo).
 *
 * CSV esperado (separador ";" ou ","), com cabeçalho:
 *   email;nome;centro_custo;role
 * - email: obrigatório
 * - nome, centro_custo: informativos (aparecem no relatório)
 * - role: ADMIN | GESTOR | USER | VIEWER (default: USER)
 *
 * Uso:
 *   # Dry-run (não escreve nada — valida o CSV e mostra o plano):
 *   npx tsx scripts/invite-batch.ts data/convites-people.csv
 *
 *   # Execução real (cria convites; envia e-mail se RESEND_API_KEY configurada,
 *   # senão coleta os links para distribuição manual):
 *   ALLOW_PROD_DB=true FRONTEND_URL=https://engage.vydhub.com \
 *     npx tsx scripts/invite-batch.ts data/convites-people.csv --send
 *
 * O relatório final (email;status;link) é gravado em scripts/out/.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { UserRole } from '@prisma/client';
import prisma from '../src/config/database.js';
import { invitationService } from '../src/services/invitationService.js';
import { assertNotProdDatabase } from '../src/config/dbSafety.js';

const INVITER_EMAIL = process.env.INVITER_EMAIL || 'kleber.bastos@k2mais.com.br';

const args = process.argv.slice(2);
const send = args.includes('--send');
const csvArg = args.find((a) => !a.startsWith('--'));

if (!csvArg) {
  console.error('Uso: npx tsx scripts/invite-batch.ts <arquivo.csv> [--send]');
  process.exit(1);
}

if (send) {
  assertNotProdDatabase('scripts/invite-batch.ts --send');
}

interface Row {
  line: number;
  email: string;
  nome: string;
  centroCusto: string;
  role: UserRole;
}

function parseCsv(path: string): { rows: Row[]; errors: string[] } {
  const raw = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: ['CSV vazio (esperado cabeçalho + linhas).'] };
  }

  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const idx = {
    email: header.indexOf('email'),
    nome: header.indexOf('nome'),
    centroCusto: header.findIndex((h) => h === 'centro_custo' || h === 'centro de custo'),
    role: header.indexOf('role'),
  };
  const errors: string[] = [];
  if (idx.email === -1) {
    return { rows: [], errors: [`Cabeçalho sem coluna "email". Encontrado: ${lines[0]}`] };
  }

  const validRoles = new Set(Object.values(UserRole));
  const seen = new Set<string>();
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = (cols[idx.email] ?? '').trim().toLowerCase();
    const lineNo = i + 1;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Linha ${lineNo}: e-mail inválido: "${email}"`);
      continue;
    }
    if (seen.has(email)) {
      errors.push(`Linha ${lineNo}: e-mail duplicado no CSV: ${email} (ignorado)`);
      continue;
    }
    seen.add(email);

    const roleRaw = (idx.role >= 0 ? (cols[idx.role] ?? '') : '').trim().toUpperCase();
    let role: UserRole = UserRole.USER;
    if (roleRaw) {
      if (!validRoles.has(roleRaw as UserRole)) {
        errors.push(`Linha ${lineNo}: role inválida "${roleRaw}" (use ADMIN|GESTOR|USER|VIEWER)`);
        continue;
      }
      role = roleRaw as UserRole;
    }

    rows.push({
      line: lineNo,
      email,
      nome: idx.nome >= 0 ? (cols[idx.nome] ?? '') : '',
      centroCusto: idx.centroCusto >= 0 ? (cols[idx.centroCusto] ?? '') : '',
      role,
    });
  }

  return { rows, errors };
}

async function main() {
  const csvPath = resolve(process.cwd(), csvArg!);
  const { rows, errors } = parseCsv(csvPath);

  console.log(`\n=== invite-batch ${send ? '(EXECUÇÃO REAL)' : '(dry-run)'} ===`);
  console.log(`CSV: ${csvPath} — ${rows.length} convite(s) válido(s)`);
  for (const e of errors) console.warn('⚠️ ', e);

  if (rows.length === 0) {
    console.error('Nada a fazer.');
    process.exitCode = errors.length > 0 ? 1 : 0;
    return;
  }

  const inviter = await prisma.user.findUnique({
    where: { email: INVITER_EMAIL },
    select: { id: true, tenantId: true, email: true, tenant: { select: { slug: true } } },
  });
  if (!inviter) {
    console.error(`❌ Usuário convidador ${INVITER_EMAIL} não encontrado (defina INVITER_EMAIL).`);
    process.exitCode = 1;
    return;
  }
  console.log(`Convidador: ${inviter.email} | tenant: ${inviter.tenant.slug}`);
  console.log(`Link base : ${process.env.FRONTEND_URL || '(FRONTEND_URL não definido!)'}\n`);

  // Pré-checagem (dry-run e execução): quem já existe / já tem convite pendente
  const emails = rows.map((r) => r.email);
  const existingUsers = new Set(
    (
      await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } })
    ).map((u) => u.email)
  );
  const pendingInvites = new Map(
    (
      await prisma.invitation.findMany({
        where: {
          tenantId: inviter.tenantId,
          email: { in: emails },
          accepted: false,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
      })
    ).map((i) => [i.email, i])
  );

  const results: { email: string; status: string; link: string }[] = [];

  for (const row of rows) {
    const label = `${row.email}${row.nome ? ` (${row.nome})` : ''} [${row.role}${row.centroCusto ? ` | ${row.centroCusto}` : ''}]`;

    if (existingUsers.has(row.email)) {
      console.log(`⏭️  JÁ É USUÁRIO      ${label}`);
      results.push({ email: row.email, status: 'ja_e_usuario', link: '' });
      continue;
    }
    const pending = pendingInvites.get(row.email);
    if (pending) {
      const info = `convidado como ${pending.role} em ${pending.createdAt.toISOString().slice(0, 10)}, expira ${pending.expiresAt.toISOString().slice(0, 10)}`;
      if (!send) {
        const action =
          pending.role === row.role
            ? 'REENVIARIA (novo link)'
            : `RECRIARIA como ${row.role} (role divergente)`;
        console.log(`🔁 ${action}  ${label} — ${info}`);
        results.push({ email: row.email, status: 'dry_run_pendente', link: '' });
        continue;
      }
      try {
        if (pending.role !== row.role) {
          // Role divergente: cancela o convite antigo e recria com a role do CSV.
          await invitationService.cancel(inviter.tenantId, pending.id);
          const inv = await invitationService.create(inviter.tenantId, inviter.id, {
            email: row.email,
            role: row.role,
          });
          const status = inv.emailSent ? 'recriado_email_enviado' : 'recriado_link_manual';
          console.log(`🔁 RECRIADO (${row.role}) ${label} — ${info}`);
          results.push({ email: row.email, status, link: inv.invitationLink ?? '' });
        } else {
          const res = await invitationService.resend(inviter.tenantId, pending.id);
          const status = res.emailSent ? 'reenviado_email' : 'reenviado_link_manual';
          console.log(`🔁 REENVIADO         ${label} — ${info}`);
          results.push({ email: row.email, status, link: res.invitationLink ?? '' });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`❌ ERRO              ${label}: ${msg}`);
        results.push({ email: row.email, status: `erro: ${msg}`, link: '' });
      }
      continue;
    }
    if (!send) {
      console.log(`🔎 CONVIDARIA        ${label}`);
      results.push({ email: row.email, status: 'dry_run_ok', link: '' });
      continue;
    }

    try {
      const inv = await invitationService.create(inviter.tenantId, inviter.id, {
        email: row.email,
        role: row.role,
      });
      if (inv.emailSent) {
        console.log(`✅ E-MAIL ENVIADO    ${label}`);
        results.push({ email: row.email, status: 'email_enviado', link: '' });
      } else {
        console.log(`🔗 LINK MANUAL       ${label}`);
        results.push({ email: row.email, status: 'link_manual', link: inv.invitationLink ?? '' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ ERRO              ${label}: ${msg}`);
      results.push({ email: row.email, status: `erro: ${msg}`, link: '' });
    }
  }

  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), 'out');
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const outPath = resolve(outDir, `convites-resultado-${stamp}.csv`);
  writeFileSync(
    outPath,
    ['email;status;link', ...results.map((r) => `${r.email};${r.status};${r.link}`)].join('\n'),
    'utf8'
  );

  const counts = results.reduce<Record<string, number>>((acc, r) => {
    const key = r.status.startsWith('erro') ? 'erro' : r.status;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\n=== Resumo ===');
  for (const [status, n] of Object.entries(counts)) console.log(`  ${status}: ${n}`);
  console.log(`Relatório: ${outPath}`);
  if (!send) console.log('\nDry-run — nada foi escrito. Re-execute com --send para criar os convites.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
