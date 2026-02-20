import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

async function testPasswordReset() {
  const email = process.argv[2] || 'kleber.bastos.1984@gmail.com';
  const apiUrl = process.env.API_URL || 'http://localhost:3001';

  console.log('📧 Testando recuperação de senha...');
  console.log('Email:', email);
  console.log('API URL:', apiUrl);
  console.log('');

  try {
    const response = await fetch(`${apiUrl}/api/auth/password/reset-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro:', response.status, response.statusText);
      console.error('Resposta:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('✅ Sucesso!');
    console.log('Resposta:', JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.error('❌ Erro ao fazer requisição:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testPasswordReset();


