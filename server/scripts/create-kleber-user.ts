import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function createKleberUser() {
  try {
    const email = 'kleber.bastos.1984@gmail.com';
    const password = 'senha123';
    
    console.log('🔍 Verificando se usuário já existe...');
    
    // Verificar se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('✅ Usuário já existe!');
      console.log(`Email: ${email}`);
      console.log(`ID: ${existingUser.id}`);
      console.log(`Nome: ${existingUser.name}`);
      await prisma.$disconnect();
      return;
    }

    console.log('📝 Criando usuário...');
    
    // Verificar se já existe um tenant
    let tenant = await prisma.tenant.findFirst({
      where: { slug: 'kleber' },
    });

    if (!tenant) {
      console.log('Criando tenant...');
      tenant = await prisma.tenant.create({
        data: {
          name: 'Kleber Bastos',
          slug: 'kleber',
        },
      });
      console.log(`✅ Tenant criado: ${tenant.name} (ID: ${tenant.id})`);
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Kleber Bastos',
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

    console.log('✅ Usuário criado com sucesso!');
    console.log(`Email: ${email}`);
    console.log(`Senha: ${password}`);
    console.log(`Nome: ${user.name}`);
    console.log(`Tenant: ${tenant.name}`);
    console.log('');
    console.log('💡 Agora você pode testar a recuperação de senha!');
  } catch (error: any) {
    console.error('❌ Erro ao criar usuário:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createKleberUser();


