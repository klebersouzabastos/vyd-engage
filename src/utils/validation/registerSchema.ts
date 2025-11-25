import { z } from 'zod';

// Step 1: Dados pessoais (Nome e Empresa)
export const step1Schema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  
  companyName: z
    .string()
    .min(2, 'Nome da empresa deve ter pelo menos 2 caracteres')
    .max(100, 'Nome da empresa deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-Z0-9\s\-_áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+$/, 'Nome da empresa contém caracteres inválidos')
    .trim(),
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

// Step 3: Email (opcional)
export const step3Schema = z.object({
  email: z
    .string()
    .optional()
    .refine((val) => {
      // Se não fornecido ou vazio, é válido
      if (!val || val.trim() === '') {
        return true;
      }
      // Se fornecido, deve ser um email válido
      return z.string().email().safeParse(val.toLowerCase().trim()).success;
    }, {
      message: 'Email inválido',
    }),
});

export type Step3FormData = z.infer<typeof step3Schema>;

// Schema completo para validação final
export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  
  email: z
    .string()
    .email('Email inválido')
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal('')),
  
  companyName: z
    .string()
    .min(2, 'Nome da empresa deve ter pelo menos 2 caracteres')
    .max(100, 'Nome da empresa deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-Z0-9\s\-_áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+$/, 'Nome da empresa contém caracteres inválidos')
    .trim(),
  
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

