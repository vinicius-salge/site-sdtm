import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(4, 'Usuario deve ter no minimo 4 caracteres').max(20, 'Usuario deve ter no maximo 20 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Usuario deve conter apenas letras, numeros e _'),
  email: z.string().email('Email invalido'),
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter exatamente 11 digitos'),
  numeroInscricao: z.string().optional(),
  dadosCadastro: z.record(z.unknown()),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email ou usuario obrigatorio'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

export const checkUsernameSchema = z.object({
  username: z.string().min(4, 'Usuario deve ter no minimo 4 caracteres').max(20).regex(/^[a-zA-Z0-9_]+$/),
});

export const downloadSchema = z.object({
  documentId: z.string().uuid('ID do documento invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

export const generatePdfSchema = z.object({
  password: z.string().min(1, 'Senha obrigatoria'),
  dadosCadastro: z.record(z.unknown()),
});

export const retrieveCadastroSchema = z.object({
  documentId: z.string().uuid('ID do documento invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

export const updateCadastroSchema = z.object({
  documentId: z.string().uuid('ID do documento invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
  dadosCadastro: z.record(z.unknown()),
});

export const updateDetranSchema = z.object({
  documentId: z.string().uuid('ID do documento invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
  credenciamentoDetran: z.string().min(1, 'Credenciamento DETRAN obrigatorio').max(50, 'Credenciamento DETRAN muito longo'),
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
