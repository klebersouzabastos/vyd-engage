import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function createTestUser() {
  try {
    console.log('Criando usuário de teste...');
    
    // Verificar se já existe um tenant de teste
    let tenant = await prisma.tenant.findFirst({
      where: { slug: 'teste' },
    });

    if (!tenant) {
      console.log('Criando tenant de teste...');
      tenant = await prisma.tenant.create({
        data: {
          name: 'Empresa Teste',
          slug: 'teste',
        },
      });
      console.log(`✅ Tenant criado: ${tenant.name} (ID: ${tenant.id})`);
    }

    // Verificar se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: 'teste@teste.com' },
    });

    if (existingUser) {
      console.log('✅ Usuário de teste já existe!');
      console.log(`Email: teste@teste.com`);
      console.log(`Senha: senha123`);
      await prisma.$disconnect();
      return;
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash('senha123', SALT_ROUNDS);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email: 'teste@teste.com',
        passwordHash,
        name: 'Usuário Teste',
        tenantId: tenant.id,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });

    // Criar subscription de teste (PRO plan)
    const proPlan = await prisma.plan.findUnique({
      where: { type: 'PRO' },
    });

    if (proPlan) {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 dias de trial

      await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: proPlan.id,
          status: 'TRIAL',
          billingCycle: 'monthly',
          renewalDate: trialEndsAt,
          trialEndsAt,
        },
      });
    }

    console.log('✅ Usuário de teste criado com sucesso!');
    console.log(`Email: teste@teste.com`);
    console.log(`Senha: senha123`);
    console.log(`Tenant: ${tenant.name}`);
  } catch (error) {
    console.error('❌ Erro ao criar usuário de teste:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();

