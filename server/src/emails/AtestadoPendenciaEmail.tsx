import { Heading, Text, Section } from '@react-email/components';
import { EmailLayout, emailStyles } from './EmailLayout.js';

export interface PendenciaLine {
  titulo: string;
  etapa: string;
  prazo: string | null;
  atrasada: boolean;
}

export function AtestadoPendenciaEmail({
  pendencias,
  appUrl,
}: {
  pendencias: PendenciaLine[];
  appUrl: string;
}) {
  return (
    <EmailLayout>
      <Heading style={emailStyles.heading}>Atestados pendentes</Heading>
      <Text style={emailStyles.paragraph}>
        Você tem {pendencias.length} pendência(s) de atestação que precisam de atenção:
      </Text>
      <Section style={{ margin: '20px 0' }}>
        {pendencias.map((p, i) => (
          <Text
            key={i}
            style={{
              ...emailStyles.paragraph,
              margin: '8px 0',
              color: p.atrasada ? '#b91c1c' : '#1f2937',
            }}
          >
            <strong>{p.titulo}</strong> — {p.etapa}
            {p.prazo ? ` · prazo ${p.prazo}` : ''}
            {p.atrasada ? ' (atrasada)' : ''}
          </Text>
        ))}
      </Section>
      <Text style={emailStyles.paragraph}>
        Acesse o módulo de Atestados para atualizar o andamento e não deixar nenhuma para trás.
      </Text>
      <Text style={emailStyles.linkBox}>{appUrl}</Text>
    </EmailLayout>
  );
}
