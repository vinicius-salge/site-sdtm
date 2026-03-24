import { describe, it, expect } from 'vitest';
import {
  hashPassword, verifyPassword,
  generateToken, verifyToken,
  extractToken,
} from '../../lib/auth.js';

describe('auth.js', () => {

  // --- hashPassword / verifyPassword ---

  describe('hashPassword / verifyPassword', () => {
    it('round-trip: hash e verifica senha corretamente', async () => {
      const password = 'minha-senha-segura';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('rejeita senha incorreta', async () => {
      const hash = await hashPassword('senha-correta');
      const isValid = await verifyPassword('senha-errada', hash);
      expect(isValid).toBe(false);
    });

    it('gera hashes diferentes para a mesma senha', async () => {
      const hash1 = await hashPassword('mesma-senha');
      const hash2 = await hashPassword('mesma-senha');
      expect(hash1).not.toBe(hash2);
    });

    it('hash tem formato bcrypt', async () => {
      const hash = await hashPassword('teste');
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });
  });

  // --- generateToken / verifyToken ---

  describe('generateToken / verifyToken', () => {
    it('round-trip: gera e verifica token JWT', () => {
      const payload = { sub: 'user-123', email: 'test@test.com' };
      const token = generateToken(payload);

      const decoded = verifyToken(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBe('test@test.com');
    });

    it('token contem campo exp (expiracao)', () => {
      const token = generateToken({ sub: 'user-1' });
      const decoded = verifyToken(token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('falha ao verificar token com secret errado', () => {
      const token = generateToken({ sub: 'user-1' });
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'outro-secret';

      expect(() => verifyToken(token)).toThrow();

      process.env.JWT_SECRET = originalSecret;
    });

    it('falha ao verificar token malformado', () => {
      expect(() => verifyToken('token-invalido')).toThrow();
    });
  });

  // --- extractToken ---

  describe('extractToken', () => {
    it('extrai token do header Authorization Bearer', () => {
      const req = { headers: { authorization: 'Bearer meu-token-123' } };
      expect(extractToken(req)).toBe('meu-token-123');
    });

    it('retorna null quando header nao existe', () => {
      const req = { headers: {} };
      expect(extractToken(req)).toBeNull();
    });

    it('retorna null quando header nao comeca com Bearer', () => {
      const req = { headers: { authorization: 'Basic abc123' } };
      expect(extractToken(req)).toBeNull();
    });

    it('retorna null quando authorization e undefined', () => {
      const req = { headers: { authorization: undefined } };
      expect(extractToken(req)).toBeNull();
    });
  });
});
