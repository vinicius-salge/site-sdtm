import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter exatamente 11 digitos'),
  dadosCadastro: z.record(z.unknown()),
});

export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

export const downloadSchema = z.object({
  documentId: z.string().uuid('ID do documento invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

export const generatePdfSchema = z.object({
  password: z.string().min(1, 'Senha obrigatoria'),
  dadosCadastro: z.record(z.unknown()),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatoria'),
  newPassword: z.string().min(8, 'Nova senha deve ter no minimo 8 caracteres'),
});

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(i => i.message);
    return { success: false, errors };
  }
  return { success: true, data: result.data };
}
