import { Resend } from 'resend';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

async function testResend() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const testEmail = process.argv[2] || 'kleber.bastos.1984@gmail.com';

  if (!apiKey) {
    console.error('❌ RESEND_API_KEY não encontrada no .env');
    process.exit(1);
  }

  console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');
  console.log('📧 From:', fromEmail);
  console.log('📬 To:', testEmail);
  console.log('');

  try {
    const resend = new Resend(apiKey);

    console.log('📤 Enviando email de teste...');

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: testEmail,
      subject: 'Teste de Email - VYD Engage',
      html: `
        <h1>Teste de Email</h1>
        <p>Este é um email de teste do VYD Engage usando Resend.</p>
        <p>Se você recebeu este email, o Resend está funcionando corretamente!</p>
      `,
      text: 'Este é um email de teste do VYD Engage usando Resend.',
    });

    if (error) {
      console.error('❌ Erro ao enviar email:', error);
      console.error('Detalhes:', JSON.stringify(error, null, 2));
      process.exit(1);
    }

    if (data) {
      console.log('✅ Email enviado com sucesso!');
      console.log('📧 Message ID:', data.id);
      console.log('');
      console.log('💡 Verifique sua caixa de entrada (e spam) em alguns segundos.');
    }
  } catch (error: any) {
    console.error('❌ Erro inesperado:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testResend();


