import { z } from 'zod';

export function isValidCPF(cpf) {
  // Reject all-same-digit CPFs
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Compute first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i], 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder >= 10) remainder = 0;
  if (remainder !== parseInt(cpf[9], 10)) return false;

  // Compute second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i], 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder >= 10) remainder = 0;
  if (remainder !== parseInt(cpf[10], 10)) return false;

  return true;
}

export const dadosCadastroSchema = z.object({
  // Dados Pessoais
  nome: z.string().min(1, 'Nome obrigatorio').max(200),
  pai: z.string().max(200).optional().default(''),
  mae: z.string().max(200).optional().default(''),
  cpf: z.string().optional().default(''),
  rg: z.string().max(30).optional().default(''),
  ssp: z.string().max(20).optional().default(''),
  estadoCivil: z.string().max(30).optional().default(''),
  dataNascimento: z.string().max(20).optional().default(''),
  naturalidade: z.string().max(100).optional().default(''),
  ufNaturalidade: z.string().max(2).optional().default(''),
  nacionalidade: z.string().max(50).optional().default(''),
  grauInstrucao: z.string().max(50).optional().default(''),
  tituloEleitor: z.string().max(20).optional().default(''),
  zona: z.string().max(10).optional().default(''),
  secao: z.string().max(10).optional().default(''),
  endereco: z.string().max(300).optional().default(''),
  bairro: z.string().max(100).optional().default(''),
  cidade: z.string().max(100).optional().default(''),
  uf: z.string().max(2).optional().default(''),
  cep: z.string().max(10).optional().default(''),
  telefone: z.string().max(20).optional().default(''),
  celular: z.string().max(20).optional().default(''),
  emailPessoal: z.string().max(200).optional().default(''),
  // Dados Comerciais
  cidadeAtuacao: z.string().max(100).optional().default(''),
  despachanteArea: z.string().max(100).optional().default(''),
  credenciamentoDetran: z.string().max(50).optional().default(''),
  enderecoComercial: z.string().max(300).optional().default(''),
  bairroComercial: z.string().max(100).optional().default(''),
  cidadeComercial: z.string().max(100).optional().default(''),
  cepComercial: z.string().max(10).optional().default(''),
  telefoneComercial: z.string().max(20).optional().default(''),
  fax: z.string().max(20).optional().default(''),
  emailComercial: z.string().max(200).optional().default(''),
  // System fields (may be set by backend)
  numeroInscricao: z.string().max(20).optional().default(''),
}).passthrough();

export const registerSchema = z.object({
  username: z.string().min(4, 'Usuario deve ter no minimo 4 caracteres').max(20, 'Usuario deve ter no maximo 20 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Usuario deve conter apenas letras, numeros e _'),
  email: z.string().email('Email invalido'),
  password: z.string().min(8, 'Senha deve ter no minimo 8 caracteres'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter exatamente 11 digitos').refine(isValidCPF, 'CPF invalido'),
  numeroInscricao: z.string().optional(),
  dadosCadastro: dadosCadastroSchema,
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
  dadosCadastro: dadosCadastroSchema,
});

export const retrieveCadastroSchema = z.object({
  documentId: z.string().uuid('ID do documento invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

export const updateCadastroSchema = z.object({
  documentId: z.string().uuid('ID do documento invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
  dadosCadastro: dadosCadastroSchema,
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
