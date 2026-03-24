import { describe, it, expect } from 'vitest';
import {
  validate,
  retrieveCadastroSchema,
  updateCadastroSchema,
  updateDetranSchema,
  registerSchema,
  changePasswordSchema,
} from '../../lib/validators.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('validators.js', () => {

  // --- validate function ---

  describe('validate', () => {
    it('retorna success true para dados validos', () => {
      const result = validate(retrieveCadastroSchema, {
        documentId: VALID_UUID,
        password: 'minha-senha',
      });

      expect(result.success).toBe(true);
      expect(result.data.documentId).toBe(VALID_UUID);
    });

    it('retorna success false com array de erros para dados invalidos', () => {
      const result = validate(retrieveCadastroSchema, {
        documentId: 'nao-e-uuid',
        password: '',
      });

      expect(result.success).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // --- retrieveCadastroSchema ---

  describe('retrieveCadastroSchema', () => {
    it('aceita UUID valido e senha', () => {
      const result = validate(retrieveCadastroSchema, {
        documentId: VALID_UUID,
        password: 'senha123',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita UUID invalido', () => {
      const result = validate(retrieveCadastroSchema, {
        documentId: 'invalido',
        password: 'senha123',
      });
      expect(result.success).toBe(false);
      expect(result.errors).toContain('ID do documento invalido');
    });

    it('rejeita senha vazia', () => {
      const result = validate(retrieveCadastroSchema, {
        documentId: VALID_UUID,
        password: '',
      });
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Senha obrigatoria');
    });

    it('rejeita campos ausentes', () => {
      const result = validate(retrieveCadastroSchema, {});
      expect(result.success).toBe(false);
    });
  });

  // --- updateCadastroSchema ---

  describe('updateCadastroSchema', () => {
    it('aceita dados validos', () => {
      const result = validate(updateCadastroSchema, {
        documentId: VALID_UUID,
        password: 'senha123',
        dadosCadastro: { nome: 'Teste' },
      });
      expect(result.success).toBe(true);
    });

    it('rejeita sem documentId', () => {
      const result = validate(updateCadastroSchema, {
        password: 'senha123',
        dadosCadastro: { nome: 'Teste' },
      });
      expect(result.success).toBe(false);
    });

    it('rejeita sem dadosCadastro', () => {
      const result = validate(updateCadastroSchema, {
        documentId: VALID_UUID,
        password: 'senha123',
      });
      expect(result.success).toBe(false);
    });

    it('aceita dadosCadastro como objeto vazio', () => {
      const result = validate(updateCadastroSchema, {
        documentId: VALID_UUID,
        password: 'senha123',
        dadosCadastro: {},
      });
      expect(result.success).toBe(true);
    });
  });

  // --- updateDetranSchema ---

  describe('updateDetranSchema', () => {
    it('aceita credenciamento valido', () => {
      const result = validate(updateDetranSchema, {
        documentId: VALID_UUID,
        password: 'senha123',
        credenciamentoDetran: 'DET-12345',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita credenciamento vazio', () => {
      const result = validate(updateDetranSchema, {
        documentId: VALID_UUID,
        password: 'senha123',
        credenciamentoDetran: '',
      });
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Credenciamento DETRAN obrigatorio');
    });

    it('rejeita credenciamento com mais de 50 caracteres', () => {
      const result = validate(updateDetranSchema, {
        documentId: VALID_UUID,
        password: 'senha123',
        credenciamentoDetran: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Credenciamento DETRAN muito longo');
    });

    it('aceita credenciamento com exatamente 50 caracteres', () => {
      const result = validate(updateDetranSchema, {
        documentId: VALID_UUID,
        password: 'senha123',
        credenciamentoDetran: 'A'.repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it('rejeita sem campo credenciamentoDetran', () => {
      const result = validate(updateDetranSchema, {
        documentId: VALID_UUID,
        password: 'senha123',
      });
      expect(result.success).toBe(false);
    });
  });

  // --- registerSchema ---

  describe('registerSchema', () => {
    const validData = {
      username: 'joao_123',
      email: 'joao@email.com',
      password: '12345678',
      cpf: '12345678901',
      dadosCadastro: { nome: 'Joao' },
    };

    it('aceita dados de registro validos', () => {
      const result = validate(registerSchema, validData);
      expect(result.success).toBe(true);
    });

    it('rejeita username curto (< 4 chars)', () => {
      const result = validate(registerSchema, { ...validData, username: 'abc' });
      expect(result.success).toBe(false);
    });

    it('rejeita username com caracteres especiais', () => {
      const result = validate(registerSchema, { ...validData, username: 'joao@123' });
      expect(result.success).toBe(false);
    });

    it('rejeita CPF com menos de 11 digitos', () => {
      const result = validate(registerSchema, { ...validData, cpf: '1234567890' });
      expect(result.success).toBe(false);
    });

    it('rejeita CPF com letras', () => {
      const result = validate(registerSchema, { ...validData, cpf: '1234567890a' });
      expect(result.success).toBe(false);
    });

    it('rejeita senha curta (< 8 chars)', () => {
      const result = validate(registerSchema, { ...validData, password: '1234567' });
      expect(result.success).toBe(false);
    });

    it('aceita numeroInscricao opcional', () => {
      const result = validate(registerSchema, { ...validData, numeroInscricao: 'SDTM-001000' });
      expect(result.success).toBe(true);
    });
  });

  // --- changePasswordSchema ---

  describe('changePasswordSchema', () => {
    it('aceita dados validos', () => {
      const result = validate(changePasswordSchema, {
        currentPassword: 'senhaatual',
        newPassword: '12345678',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita nova senha curta', () => {
      const result = validate(changePasswordSchema, {
        currentPassword: 'senhaatual',
        newPassword: '1234567',
      });
      expect(result.success).toBe(false);
    });
  });
});
