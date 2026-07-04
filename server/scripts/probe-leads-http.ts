/**
 * Reproduz a chamada HTTP do front: minta token do usuário e bate no endpoint
 * REAL (auth + zod + service) do backend local (que aponta pro banco de prod).
 *   npx tsx scripts/probe-leads-http.ts
 */
import prisma from '../src/config/database.js';
import { generateAccessToken } from '../src/utils/jwt.js';

const EMAIL = 'kleber.bastos.1984@gmail.com';
const BASE = process.env.PROBE_BASE || 'http://localhost:3001';

async function hit(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  const count = parsed?.data?.leads?.length ?? parsed?.leads?.length ?? '?';
  const total = parsed?.data?.pagination?.total ?? parsed?.pagination?.total ?? '?';
  console.log(`\nGET ${path}`);
  console.log(`  status=${res.status} | leads.length=${count} | pagination.total=${total}`);
  if (count === '?' || res.status >= 400) {
    console.log('  BODY:', text.slice(0, 600));
  }
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: EMAIL },
    select: { id: true, email: true, tenantId: true, role: true },
  });
  if (!user) { console.log('user não encontrado'); return; }
  const token = generateAccessToken({
    userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role,
  });
  console.log('USER:', user.email, '| tenant:', user.tenantId, '| role:', user.role);

  await hit('/api/v1/leads?page=1&limit=20&isContact=true', token);  // aba Contatos
  await hit('/api/v1/leads?page=1&limit=20&isContact=false', token); // aba Leads
  await hit('/api/v1/leads?page=1&limit=20', token);                 // aba Todos
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERRO:', e?.stack || e); process.exit(1); });
