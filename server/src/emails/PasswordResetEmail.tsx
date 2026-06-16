import { Heading, Text, Button, Section } from '@react-email/components';
import { EmailLayout, emailStyles } from './EmailLayout.js';

export function PasswordResetEmail({ name, resetLink }: { name: string; resetLink: string }) {
  return (
    <EmailLayout>
      <Heading style={emailStyles.heading}>Recuperação de Senha</Heading>
      <Text style={emailStyles.paragraph}>Olá {name},</Text>
      <Text style={emailStyles.paragraph}>
        Recebemos uma solicitação para redefinir a senha da sua conta VYD Engage.
      </Text>
      <Section style={{ textAlign: 'center', margin: '30px 0' }}>
        <Button href={resetLink} style={emailStyles.button}>
          Redefinir Senha
        </Button>
      </Section>
      <Text style={{ ...emailStyles.paragraph, textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
        Ou copie e cole este link no seu navegador:
      </Text>
      <Text style={emailStyles.linkBox}>{resetLink}</Text>
      <Text style={emailStyles.paragraph}>Este link expira em 1 hora.</Text>
      <Text style={emailStyles.paragraph}>
        Se você não solicitou esta recuperação, ignore este email.
      </Text>
    </EmailLayout>
  );
}
