import { Html, Head, Body, Container, Text, Hr } from '@react-email/components';
import type { ReactNode } from 'react';

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Arial, sans-serif',
  color: '#333333',
  lineHeight: '1.6',
};
const container = { maxWidth: '600px', margin: '0 auto', padding: '20px' };
const footer = { marginTop: '30px', fontSize: '12px', color: '#666666' };

export const emailStyles = {
  heading: { fontSize: '22px', fontWeight: 'bold' as const, color: '#111827' },
  paragraph: { fontSize: '15px', color: '#333333' },
  button: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#2563EB',
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '5px',
    margin: '20px 0',
    fontWeight: 'bold' as const,
  },
  linkBox: {
    backgroundColor: '#f3f4f6',
    padding: '15px',
    borderRadius: '5px',
    wordBreak: 'break-all' as const,
    fontFamily: "'Courier New', monospace",
    fontSize: '13px',
    margin: '16px 0',
    color: '#1e3a8a',
    border: '1px solid #d1d5db',
  },
};

/** Shared wrapper for all transactional emails (container + automatic footer). */
export function EmailLayout({ children }: { children: ReactNode }) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Body style={main}>
        <Container style={container}>
          {children}
          <Hr />
          <Text style={footer}>Este é um email automático, por favor não responda.</Text>
        </Container>
      </Body>
    </Html>
  );
}
