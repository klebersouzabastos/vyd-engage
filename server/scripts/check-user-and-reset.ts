import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prisma from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

async function checkUserAndReset() {
  const email = process.argv[2] || 'kleber.bastos.1984@gmail.com';
  const normalizedEmail = email.trim().toLowerCase();

  console.log('🔍 Verificando usuário...');
  console.log('Email original:', email);
  console.log('Email normalizado:', normalizedEmail);
  console.log('');

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        passwordResetToken: true,
        passwordResetExpires: true,
      },
    });

    if (!user) {
      console.log('❌ Usuário NÃO encontrado no banco de dados!');
      console.log('');
      console.log('💡 Isso explica por que o email não está sendo enviado.');
      console.log('   O código retorna silenciosamente quando o usuário não existe.');
      console.log('');
      console.log('📝 Para criar o usuário, use:');
      console.log('   npm run prisma:seed');
      console.log('   ou');
      console.log('   tsx scripts/create-test-user.ts');
      process.exit(1);
    }

    console.log('✅ Usuário encontrado!');
    console.log('ID:', user.id);
    console.log('Nome:', user.name);
    console.log('Email:', user.email);
    console.log('Token de reset atual:', user.passwordResetToken || 'Nenhum');
    console.log('Expira em:', user.passwordResetExpires || 'N/A');
    console.log('');

    // Now test the password reset flow
    console.log('📧 Testando envio de email de recuperação...');
    const { requestPasswordReset } = await import('../src/services/authService.js');
    
    await requestPasswordReset(normalizedEmail);
    
    console.log('✅ Processo concluído!');
    console.log('');
    console.log('💡 Verifique:');
    console.log('   1. Os logs do servidor para ver se o email foi enviado');
    console.log('   2. A caixa de entrada (e spam) do email:', normalizedEmail);
    console.log('   3. O dashboard do Resend: https://resend.com/emails');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserAndReset();

