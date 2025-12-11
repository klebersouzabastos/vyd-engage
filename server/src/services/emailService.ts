import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

// Email transporter configuration
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  // Use environment variables for email configuration
  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  // If no SMTP credentials, use Ethereal for development (creates test account)
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    logger.warn('SMTP credentials not configured. Using Ethereal Email for development.');
    // In production, this should throw an error
    // For now, we'll create a test account
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'test@ethereal.email',
        pass: 'test',
      },
    });
  } else {
    transporter = nodemailer.createTransport(emailConfig);
  }

  return transporter;
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
    const mailTransporter = getTransporter();
    
    const mailOptions = {
      from: options.from || process.env.SMTP_FROM || 'noreply@flowcrm.com',
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    };

    const info = await mailTransporter.sendMail(mailOptions);
    logger.info('Email sent successfully', { 
      messageId: info.messageId,
      to: options.to,
      subject: options.subject,
    });
  } catch (error: any) {
    logger.error('Error sending email', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

// Email templates
export const emailTemplates = {
  passwordReset: (name: string, resetLink: string) => ({
    subject: 'Recuperação de Senha - FlowCRM',
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
          <p>Recebemos uma solicitação para redefinir a senha da sua conta FlowCRM.</p>
          <p>Clique no botão abaixo para criar uma nova senha:</p>
          <a href="${resetLink}" class="button">Redefinir Senha</a>
          <p>Ou copie e cole este link no seu navegador:</p>
          <p>${resetLink}</p>
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
    subject: 'Verifique seu Email - FlowCRM',
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
          <p>Obrigado por se cadastrar no FlowCRM!</p>
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
    subject: `Convite para ${companyName} - FlowCRM`,
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
          <p><strong>${inviterName}</strong> convidou você para se juntar a <strong>${companyName}</strong> no FlowCRM como <strong>${role}</strong>.</p>
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






