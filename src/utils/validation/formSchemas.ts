import { z } from 'zod';

// ---- Lead Form ----
export const leadFormSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional(),
  phone: z.string().optional(),
  source: z.string().min(1, 'Origem é obrigatória'),
  status: z.string().min(1, 'Status é obrigatório'),
});

export type LeadFormData = z.infer<typeof leadFormSchema>;

// ---- Company Form ----
export const companyFormSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url('URL inválida').or(z.literal('')).optional(),
  notes: z.string().optional(),
});

export type CompanyFormData = z.infer<typeof companyFormSchema>;

// ---- Deal Form ----
export const dealFormSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').min(2, 'Nome deve ter pelo menos 2 caracteres'),
  value: z.string().min(1, 'Valor é obrigatório').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    'Valor deve ser um número positivo'
  ),
  stage: z.string().min(1, 'Estágio é obrigatório'),
  probability: z.string().refine(
    (val) => {
      const num = parseInt(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    },
    'Probabilidade deve ser entre 0 e 100'
  ),
  expectedCloseDate: z.string().optional(),
  leadId: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  lostReason: z.string().optional(),
  funnelId: z.string().optional(),
});

export type DealFormData = z.infer<typeof dealFormSchema>;

// ---- Task Form ----
export const taskFormSchema = z.object({
  leadId: z.string().min(1, 'Lead é obrigatório'),
  title: z.string().min(1, 'Título é obrigatório').min(3, 'Título deve ter pelo menos 3 caracteres'),
  description: z.string().optional(),
  dueDate: z.string().min(1, 'Data de vencimento é obrigatória'),
  dueTime: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

export type TaskFormData = z.infer<typeof taskFormSchema>;

// ---- Public Capture Form ----
export const publicFormSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional(),
  phone: z.string().refine(
    (val) => !val || val.replace(/\D/g, '').length >= 10,
    'Telefone deve ter pelo menos 10 dígitos'
  ).optional(),
  company: z.string().optional(),
  message: z.string().optional(),
});

export type PublicFormData = z.infer<typeof publicFormSchema>;

// ---- Forgot Password ----
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').email('Formato de e-mail inválido'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
