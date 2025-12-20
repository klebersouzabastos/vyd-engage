import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log('📋 DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ NOT SET');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL não está configurada!');
      process.exit(1);
    }
    
    console.log('🔌 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected successfully!');
    
    console.log('🧪 Testing query...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query test successful:', result);
    
    console.log('👤 Testing user query...');
    const user = await prisma.user.findFirst({
      take: 1,
    });
    console.log('✅ User query successful. Total users:', user ? 'Found' : 'None');
    
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database connection failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

testConnection();


