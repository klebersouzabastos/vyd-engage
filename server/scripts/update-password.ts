import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function updatePassword(email: string, newPassword: string) {
  try {
    console.log(`Procurando usuário com email: ${email}...`);
    
    // Encontrar o usuário
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ Usuário com email ${email} não encontrado!`);
      process.exit(1);
    }

    console.log(`✅ Usuário encontrado: ${user.name} (ID: ${user.id})`);
    console.log(`Atualizando senha...`);

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Atualizar a senha
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    console.log(`✅ Senha atualizada com sucesso para o usuário ${email}!`);
  } catch (error) {
    console.error('❌ Erro ao atualizar senha:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Obter argumentos da linha de comando
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('❌ Uso: tsx scripts/update-password.ts <email> <nova-senha>');
  console.error('Exemplo: tsx scripts/update-password.ts kleber.bastos.1984@gmail.com 123456');
  process.exit(1);
}

updatePassword(email, password);

