export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export interface PasswordStrength {
  level: 'weak' | 'medium' | 'strong';
  percentage: number;
  label: string;
  requirements: PasswordRequirement[];
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      level: 'weak',
      percentage: 0,
      label: '',
      requirements: [],
    };
  }

  const requirements: PasswordRequirement[] = [
    {
      label: 'Pelo menos 8 caracteres',
      met: password.length >= 8,
    },
    {
      label: 'Pelo menos uma letra maiúscula',
      met: /[A-Z]/.test(password),
    },
    {
      label: 'Pelo menos uma letra minúscula',
      met: /[a-z]/.test(password),
    },
    {
      label: 'Pelo menos um número',
      met: /[0-9]/.test(password),
    },
    {
      label: 'Pelo menos um caractere especial',
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    },
  ];

  const metCount = requirements.filter((req) => req.met).length;
  const totalRequirements = requirements.length;

  let level: 'weak' | 'medium' | 'strong';
  let label: string;
  let percentage: number;

  if (metCount <= 2) {
    level = 'weak';
    label = 'Senha fraca';
    percentage = (metCount / totalRequirements) * 100;
  } else if (metCount <= 4) {
    level = 'medium';
    label = 'Senha média';
    percentage = (metCount / totalRequirements) * 100;
  } else {
    level = 'strong';
    label = 'Senha forte';
    percentage = 100;
  }

  // Ajustar porcentagem baseado no comprimento
  if (password.length >= 12 && metCount >= 3) {
    percentage = Math.min(100, percentage + 10);
  }

  return {
    level,
    percentage: Math.round(percentage),
    label,
    requirements,
  };
}

