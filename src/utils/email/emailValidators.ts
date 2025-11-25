import { EmailProvider, ProviderConfig, EmailConfigValidation } from "../../types/email";

export function validateEmailConfig(
  provider: EmailProvider,
  config: ProviderConfig
): EmailConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (provider) {
    case "smtp": {
      const smtpConfig = config as any;
      if (!smtpConfig.host || smtpConfig.host.trim() === "") {
        errors.push("Host SMTP é obrigatório");
      }
      if (!smtpConfig.port || smtpConfig.port < 1 || smtpConfig.port > 65535) {
        errors.push("Porta SMTP deve estar entre 1 e 65535");
      }
      if (!smtpConfig.user || smtpConfig.user.trim() === "") {
        errors.push("Usuário SMTP é obrigatório");
      }
      if (!smtpConfig.password || smtpConfig.password.trim() === "") {
        errors.push("Senha SMTP é obrigatória");
      }
      if (!smtpConfig.fromEmail) {
        warnings.push("Email de remetente não configurado. Será usado o email do usuário.");
      } else if (!isValidEmail(smtpConfig.fromEmail)) {
        errors.push("Email de remetente inválido");
      }
      break;
    }

    case "sendgrid": {
      const sendgridConfig = config as any;
      if (!sendgridConfig.apiKey || sendgridConfig.apiKey.trim() === "") {
        errors.push("API Key do SendGrid é obrigatória");
      }
      if (!sendgridConfig.fromEmail) {
        warnings.push("Email de remetente não configurado. Será usado o email padrão do SendGrid.");
      } else if (!isValidEmail(sendgridConfig.fromEmail)) {
        errors.push("Email de remetente inválido");
      }
      break;
    }

    case "mailgun": {
      const mailgunConfig = config as any;
      if (!mailgunConfig.apiKey || mailgunConfig.apiKey.trim() === "") {
        errors.push("API Key do Mailgun é obrigatória");
      }
      if (!mailgunConfig.domain || mailgunConfig.domain.trim() === "") {
        errors.push("Domínio do Mailgun é obrigatório");
      }
      if (!mailgunConfig.fromEmail) {
        warnings.push("Email de remetente não configurado. Será usado o domínio configurado.");
      } else if (!isValidEmail(mailgunConfig.fromEmail)) {
        errors.push("Email de remetente inválido");
      }
      break;
    }

    case "resend": {
      const resendConfig = config as any;
      if (!resendConfig.apiKey || resendConfig.apiKey.trim() === "") {
        errors.push("API Key do Resend é obrigatória");
      }
      if (!resendConfig.fromEmail) {
        warnings.push("Email de remetente não configurado. Será usado o email padrão do Resend.");
      } else if (!isValidEmail(resendConfig.fromEmail)) {
        errors.push("Email de remetente inválido");
      }
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}


