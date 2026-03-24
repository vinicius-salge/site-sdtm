import { describe, it, expect } from 'vitest';
import {
  encryptPDF, decryptPDF,
  encryptData, decryptData,
  generateHash, secureWipe,
} from '../../lib/crypto.js';

describe('crypto.js', () => {

  // --- encryptPDF / decryptPDF ---

  describe('encryptPDF / decryptPDF', () => {
    it('round-trip: criptografa e descriptografa buffer corretamente', async () => {
      const original = Buffer.from('Conteudo do PDF simulado');
      const password = 'senha-segura-123';

      const encrypted = await encryptPDF(original, password);
      const decrypted = await decryptPDF(
        encrypted.encryptedBlob, password, encrypted.salt, encrypted.iv, encrypted.authTag
      );

      expect(decrypted.toString()).toBe('Conteudo do PDF simulado');
    });

    it('retorna formato correto com salt, iv e authTag em hex', async () => {
      const buffer = Buffer.from('test');
      const encrypted = await encryptPDF(buffer, 'password');

      expect(Buffer.isBuffer(encrypted.encryptedBlob)).toBe(true);
      expect(encrypted.salt).toMatch(/^[0-9a-f]{32}$/);
      expect(encrypted.iv).toMatch(/^[0-9a-f]{32}$/);
      expect(encrypted.authTag).toMatch(/^[0-9a-f]{32}$/);
    });

    it('gera salt e iv diferentes a cada chamada', async () => {
      const buffer = Buffer.from('test');
      const e1 = await encryptPDF(buffer, 'password');
      const e2 = await encryptPDF(buffer, 'password');

      expect(e1.salt).not.toBe(e2.salt);
      expect(e1.iv).not.toBe(e2.iv);
    });

    it('falha ao descriptografar com senha errada', async () => {
      const buffer = Buffer.from('dados secretos');
      const encrypted = await encryptPDF(buffer, 'senha-correta');

      await expect(
        decryptPDF(encrypted.encryptedBlob, 'senha-errada', encrypted.salt, encrypted.iv, encrypted.authTag)
      ).rejects.toThrow('Falha na descriptografia');
    });

    it('falha ao descriptografar com authTag adulterado', async () => {
      const buffer = Buffer.from('dados secretos');
      const encrypted = await encryptPDF(buffer, 'senha');

      const fakeAuthTag = 'a'.repeat(32);
      await expect(
        decryptPDF(encrypted.encryptedBlob, 'senha', encrypted.salt, encrypted.iv, fakeAuthTag)
      ).rejects.toThrow('Falha na descriptografia');
    });
  });

  // --- encryptData / decryptData ---

  describe('encryptData / decryptData', () => {
    it('round-trip: criptografa e descriptografa objeto JSON', async () => {
      const dados = {
        nome: 'Joao Silva',
        cpf: '12345678901',
        credenciamentoDetran: 'DET-001',
      };
      const password = 'minha-senha-forte';

      const encrypted = await encryptData(dados, password);
      const decrypted = await decryptData(
        encrypted.encryptedBlob, password, encrypted.salt, encrypted.iv, encrypted.authTag
      );

      expect(decrypted).toEqual(dados);
    });

    it('preserva objetos complexos com nested objects e arrays', async () => {
      const dados = {
        nome: 'Maria',
        enderecos: [{ rua: 'Rua A', numero: 123 }],
        config: { ativo: true, nivel: null },
        vazio: '',
      };

      const encrypted = await encryptData(dados, 'pass');
      const decrypted = await decryptData(
        encrypted.encryptedBlob, 'pass', encrypted.salt, encrypted.iv, encrypted.authTag
      );

      expect(decrypted).toEqual(dados);
    });

    it('preserva caracteres especiais e acentos', async () => {
      const dados = {
        nome: 'Jose da Silva Conceicao',
        cidade: 'Sao Paulo',
        obs: 'Atencao: campo com "aspas" e \'apostrofos\'',
      };

      const encrypted = await encryptData(dados, 'pass');
      const decrypted = await decryptData(
        encrypted.encryptedBlob, 'pass', encrypted.salt, encrypted.iv, encrypted.authTag
      );

      expect(decrypted).toEqual(dados);
    });

    it('falha ao descriptografar dados com senha errada', async () => {
      const dados = { nome: 'Teste' };
      const encrypted = await encryptData(dados, 'senha-certa');

      await expect(
        decryptData(encrypted.encryptedBlob, 'senha-errada', encrypted.salt, encrypted.iv, encrypted.authTag)
      ).rejects.toThrow();
    });

    it('retorna formato correto', async () => {
      const encrypted = await encryptData({ a: 1 }, 'pass');

      expect(Buffer.isBuffer(encrypted.encryptedBlob)).toBe(true);
      expect(typeof encrypted.salt).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.authTag).toBe('string');
    });
  });

  // --- generateHash ---

  describe('generateHash', () => {
    it('gera hash SHA-256 deterministico', () => {
      const hash1 = generateHash('12345678901');
      const hash2 = generateHash('12345678901');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('gera hashes diferentes para entradas diferentes', () => {
      const hash1 = generateHash('12345678901');
      const hash2 = generateHash('12345678902');

      expect(hash1).not.toBe(hash2);
    });
  });

  // --- secureWipe ---

  describe('secureWipe', () => {
    it('preenche buffer com zeros', () => {
      const buffer = Buffer.from('dados sensíveis');
      expect(buffer[0]).not.toBe(0);

      secureWipe(buffer);

      for (let i = 0; i < buffer.length; i++) {
        expect(buffer[i]).toBe(0);
      }
    });

    it('nao lanca erro para valores nao-Buffer', () => {
      expect(() => secureWipe(null)).not.toThrow();
      expect(() => secureWipe(undefined)).not.toThrow();
      expect(() => secureWipe('string')).not.toThrow();
      expect(() => secureWipe(123)).not.toThrow();
    });
  });
});
