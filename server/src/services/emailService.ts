import { Resend } from 'resend';
import { logger } from '../utils/logger.js';

// Resend client initialization
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured. Please set it in your environment variables.');
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const resend = getResendClient();
    
    // Resend requires verified domain or uses onboarding@resend.dev for testing
    // Format: "Name <email@domain.com>" or just "email@domain.com"
    const fromEmail = options.from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    
    // Resend accepts array of recipients
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    
    // Extract text from HTML if not provided
    const textContent = options.text || options.html.replace(/<[^>]*>/g, '');

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject: options.subject,
      html: options.html,
      text: textContent,
    } as any);

    if (error) {
      logger.error('Resend API error', error);
      logger.error('Resend error details', {
        name: error.name,
        message: error.message,
        statusCode: (error as any).statusCode,
        fullError: JSON.stringify(error, null, 2),
      });
      throw new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
    }

    logger.info('Email sent successfully', { 
      messageId: data?.id,
      to: options.to,
      subject: options.subject,
      from: fromEmail,
    });
  } catch (error: any) {
    logger.error('Error sending email', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// Email templates
export const emailTemplates = {
  passwordReset: (name: string, resetLink: string) => ({
    subject: 'Recuperação de Senha - VYD Engage',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Recuperação de Senha</h1>
          <p>Olá ${name},</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta VYD Engage.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" class="button" style="text-decoration: none;">Redefinir Senha</a>
          </p>
          <p style="text-align: center; color: #6b7280; font-size: 14px; margin: 15px 0;">Ou copie e cole este link no seu navegador:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; word-break: break-all; font-family: 'Courier New', monospace; font-size: 14px; margin: 20px 0; text-align: center; border: 1px solid #d1d5db;">
            <p style="margin: 0; color: #1e3a8a; user-select: all; -webkit-user-select: all;">${resetLink}</p>
          </div>
          <p>Este link expira em 1 hora.</p>
          <p>Se você não solicitou esta recuperação, ignore este email.</p>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  emailVerification: (name: string, verificationLink: string) => ({
    subject: 'Verifique seu Email - VYD Engage',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Verificação de Email</h1>
          <p>Olá ${name},</p>
          <p>Obrigado por se cadastrar no VYD Engage!</p>
          <p>Por favor, verifique seu endereço de email clicando no botão abaixo:</p>
          <a href="${verificationLink}" class="button">Verificar Email</a>
          <p>Ou copie e cole este link no seu navegador:</p>
          <p>${verificationLink}</p>
          <p>Este link expira em 24 horas.</p>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  invitation: (inviterName: string, companyName: string, invitationLink: string, role: string) => ({
    subject: `Convite para ${companyName} - VYD Engage`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Você foi convidado!</h1>
          <p>Olá,</p>
          <p><strong>${inviterName}</strong> convidou você para se juntar a <strong>${companyName}</strong> no VYD Engage como <strong>${role}</strong>.</p>
          <p>Clique no botão abaixo para aceitar o convite e criar sua conta:</p>
          <a href="${invitationLink}" class="button">Aceitar Convite</a>
          <p>Ou copie e cole este link no seu navegador:</p>
          <p>${invitationLink}</p>
          <p>Este convite expira em 7 dias.</p>
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};







