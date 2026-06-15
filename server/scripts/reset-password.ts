/**
 * Admin password reset — redefine a senha de um usuário direto no banco.
 *
 * Uso (local ou no Railway, com DATABASE_URL no ambiente):
 *   npm run reset-password -- <email> <novaSenha>
 *
 * No Railway:
 *   railway run npm run reset-password -- usuario@exemplo.com NovaSenhaForte123
 *
 * Efeitos: seta passwordHash, marca a conta como ACTIVE + emailVerified, e revoga
 * os refresh tokens antigos. Use quando o reset por email não estiver disponível.
 */
import { hashPassword } from '../src/utils/password.js';

async function main(): Promise<void> {
  const [emailArg, newPassword] = process.argv.slice(2);

  if (!emailArg || !newPassword) {
    console.error('Uso: npm run reset-password -- <email> <novaSenha>');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('A nova senha deve ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  // Importado só após validar os args (evita abrir conexão com o banco à toa).
  const { default: prisma } = await import('../src/config/database.js');

  // register() grava o email como informado; requestPasswordReset() normaliza.
  // Tentamos exato e, se não achar, a versão trim+lowercase.
  const candidates = [emailArg, emailArg.trim().toLowerCase()];
  let user = null;
  for (const email of candidates) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) break;
  }

  if (!user) {
    console.error(`Usuário não encontrado para o email: ${emailArg}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, status: 'ACTIVE', emailVerified: true },
  });
  const revoked = await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  console.log(`✓ Senha redefinida para ${user.email}`);
  console.log('  - status: ACTIVE, emailVerified: true');
  console.log(`  - ${revoked.count} refresh token(s) antigo(s) revogado(s)`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Falha ao redefinir a senha:', err);
  process.exit(1);
});
