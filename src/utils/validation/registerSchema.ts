import { z } from 'zod';

// Step 1: Dados pessoais (Nome e Empresa)
export const step1Schema = z.object({
  name: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return "";
      return String(val);
    },
    z.string()
      .min(1, 'Nome é obrigatório')
      .trim()
      .min(2, 'Nome deve ter pelo menos 2 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres')
  ),
  
  companyName: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return "";
      return String(val);
    },
    z.string()
      .min(1, 'Nome da empresa é obrigatório')
      .trim()
      .min(2, 'Nome da empresa deve ter pelo menos 2 caracteres')
      .max(100, 'Nome da empresa deve ter no máximo 100 caracteres')
      .regex(/^[a-zA-Z0-9\s\-_+áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+$/, 'Nome da empresa contém caracteres inválidos')
  ),
});

export type Step1FormData = z.infer<typeof step1Schema>;

// Step 2: Senha
export const step2Schema = z.object({
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export type Step2FormData = z.infer<typeof step2Schema>;

// Step 3: Email (obrigatório)
export const step3Schema = z.object({
  email: z
    .string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .toLowerCase()
    .trim(),
});

export type Step3FormData = z.infer<typeof step3Schema>;

// Schema completo para validação final
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email é obrigatório')
    .email('Email inválido'),
  
  companyName: z
    .string()
    .trim()
    .min(1, 'Nome da empresa é obrigatório')
    .min(2, 'Nome da empresa deve ter pelo menos 2 caracteres')
    .max(100, 'Nome da empresa deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-Z0-9\s\-_+áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+$/, 'Nome da empresa contém caracteres inválidos'),
  
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

