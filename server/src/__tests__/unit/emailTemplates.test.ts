import { describe, it, expect } from 'vitest';
import { emailTemplates } from '../../services/emailService.js';

/**
 * Verifies the react-email components actually render to HTML at runtime
 * (Story 3.2), with the dynamic params interpolated.
 */
describe('emailTemplates (react-email)', () => {
  it('renders password reset with name and link', async () => {
    const { subject, html } = await emailTemplates.passwordReset('Maria', 'https://app/reset?token=abc');
    expect(subject).toContain('Recuperação de Senha');
    expect(html).toContain('Maria');
    expect(html).toContain('https://app/reset?token=abc');
    expect(html).toContain('Redefinir Senha');
    expect(html.toLowerCase()).toContain('<html');
  });

  it('renders email verification with name and link', async () => {
    const { html } = await emailTemplates.emailVerification('João', 'https://app/verify?token=v1');
    expect(html).toContain('João');
    expect(html).toContain('https://app/verify?token=v1');
    expect(html).toContain('Verificar Email');
  });

  it('renders invitation with inviter, company and role', async () => {
    const { subject, html } = await emailTemplates.invitation('Ana', 'Acme', 'https://app/inv?token=xyz', 'Administrador');
    expect(subject).toContain('Acme');
    expect(html).toContain('Ana');
    expect(html).toContain('Acme');
    expect(html).toContain('Administrador');
    expect(html).toContain('https://app/inv?token=xyz');
  });
});
