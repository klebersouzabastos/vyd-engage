import { Heading, Text, Button, Section } from '@react-email/components';
import { EmailLayout, emailStyles } from './EmailLayout.js';

export function EmailVerificationEmail({ name, verificationLink }: { name: string; verificationLink: string }) {
  return (
    <EmailLayout>
      <Heading style={emailStyles.heading}>Verificação de Email</Heading>
      <Text style={emailStyles.paragraph}>Olá {name},</Text>
      <Text style={emailStyles.paragraph}>Obrigado por se cadastrar no VYD Engage!</Text>
      <Text style={emailStyles.paragraph}>
        Por favor, verifique seu endereço de email clicando no botão abaixo:
      </Text>
      <Section style={{ textAlign: 'center', margin: '30px 0' }}>
        <Button href={verificationLink} style={emailStyles.button}>
          Verificar Email
        </Button>
      </Section>
      <Text style={{ ...emailStyles.paragraph, color: '#6b7280', fontSize: '14px' }}>
        Ou copie e cole este link no seu navegador:
      </Text>
      <Text style={emailStyles.linkBox}>{verificationLink}</Text>
      <Text style={emailStyles.paragraph}>Este link expira em 24 horas.</Text>
    </EmailLayout>
  );
}
