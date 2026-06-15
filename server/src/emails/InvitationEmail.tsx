import { Heading, Text, Button, Section } from '@react-email/components';
import { EmailLayout, emailStyles } from './EmailLayout.js';

export function InvitationEmail({
  inviterName,
  companyName,
  invitationLink,
  role,
}: {
  inviterName: string;
  companyName: string;
  invitationLink: string;
  role: string;
}) {
  return (
    <EmailLayout>
      <Heading style={emailStyles.heading}>Você foi convidado!</Heading>
      <Text style={emailStyles.paragraph}>Olá,</Text>
      <Text style={emailStyles.paragraph}>
        <strong>{inviterName}</strong> convidou você para se juntar a <strong>{companyName}</strong> no
        VYD Engage como <strong>{role}</strong>.
      </Text>
      <Text style={emailStyles.paragraph}>
        Clique no botão abaixo para aceitar o convite e criar sua conta:
      </Text>
      <Section style={{ textAlign: 'center', margin: '30px 0' }}>
        <Button href={invitationLink} style={emailStyles.button}>
          Aceitar Convite
        </Button>
      </Section>
      <Text style={{ ...emailStyles.paragraph, color: '#6b7280', fontSize: '14px' }}>
        Ou copie e cole este link no seu navegador:
      </Text>
      <Text style={emailStyles.linkBox}>{invitationLink}</Text>
      <Text style={emailStyles.paragraph}>Este convite expira em 7 dias.</Text>
    </EmailLayout>
  );
}
