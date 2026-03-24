import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes } from '../helpers.js';
import { generateToken } from '../../lib/auth.js';

// Mock db module
const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockClientRelease = vi.fn();
const mockGetClient = vi.fn(() => ({
  query: mockClientQuery,
  release: mockClientRelease,
}));

vi.mock('../../lib/db.js', () => ({
  default: {
    query: (...args) => mockQuery(...args),
    getClient: () => mockGetClient(),
  },
}));

// Mock rate-limit to be a pass-through
vi.mock('../../middleware/rate-limit.js', () => ({
  withRateLimit: (handler) => handler,
}));

// Mock pdf-generator
vi.mock('../../lib/pdf-generator.js', () => ({
  generateFichaCadastral: vi.fn(async () => Buffer.from('fake-pdf')),
}));

// Passwords for testing
const TEST_PASSWORD = 'senha-test-123';
let TEST_PASSWORD_HASH;
let TEST_TOKEN;

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

// Valid CPF for testing (passes Luhn-like check)
const VALID_CPF = '52998224725';

// Import bcrypt for hashing
import bcrypt from 'bcrypt';

beforeEach(async () => {
  vi.clearAllMocks();
  mockClientQuery.mockResolvedValue({ rows: [] });

  // Generate test fixtures
  if (!TEST_PASSWORD_HASH) {
    TEST_PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 4); // low rounds for speed
  }
  if (!TEST_TOKEN) {
    TEST_TOKEN = generateToken({ sub: TEST_USER_ID, email: 'test@test.com' });
  }
});

// --- register.js ---

describe('POST /api/auth/register', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/auth/register.js');
    handler = mod.default;
  });

  it('retorna 400 para body invalido (campos faltando)', async () => {
    const req = mockReq({ method: 'POST', body: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Dados invalidos');
  });

  it('retorna 405 para metodo GET', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('retorna 201 ao registrar com sucesso', async () => {
    // Mock: user INSERT returns the new user id
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: TEST_USER_ID }] }) // INSERT users
      .mockResolvedValueOnce({ rows: [] }) // INSERT documents
      .mockResolvedValueOnce({ rows: [] }) // INSERT audit_logs
      .mockResolvedValueOnce({ rows: [] }) // COMMIT
    ;

    const req = mockReq({
      method: 'POST',
      body: {
        username: 'joaosilva',
        email: 'joao@test.com',
        password: 'minha-senha-segura',
        cpf: VALID_CPF,
        dadosCadastro: { nome: 'Joao Silva' },
      },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('retorna 409 quando email ja cadastrado (conflito)', async () => {
    // Mock: user INSERT returns empty rows (ON CONFLICT DO NOTHING)
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // INSERT users — conflict, no rows returned
      .mockResolvedValueOnce({ rows: [] }) // ROLLBACK
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // detectConflict: email check finds match
    ;

    const req = mockReq({
      method: 'POST',
      body: {
        username: 'joaosilva',
        email: 'existente@test.com',
        password: 'minha-senha-segura',
        cpf: VALID_CPF,
        dadosCadastro: { nome: 'Joao Silva' },
      },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Email ja cadastrado');
  });
});

// --- session.js (login) ---

describe('POST /api/auth/login', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/auth/session.js');
    handler = mod.default;
  });

  it('retorna 400 para body invalido', async () => {
    const req = mockReq({ method: 'POST', body: {} });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Dados invalidos');
  });

  it('retorna 401 quando usuario nao encontrado', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // user lookup returns nothing

    const req = mockReq({
      method: 'POST',
      body: { identifier: 'inexistente@test.com', password: 'qualquer' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Credenciais invalidas');
  });

  it('retorna 401 para senha incorreta', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: TEST_USER_ID, email: 'test@test.com', password_hash: TEST_PASSWORD_HASH }] }) // user lookup
      .mockResolvedValueOnce({ rows: [{ attempts: '0' }] }) // lockout check
      .mockResolvedValueOnce({ rows: [] }) // INSERT audit_logs (LOGIN_FAILED)
    ;

    const req = mockReq({
      method: 'POST',
      body: { identifier: 'test@test.com', password: 'senha-errada' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Credenciais invalidas');
  });

  it('retorna 200 com token ao logar com sucesso', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: TEST_USER_ID, email: 'test@test.com', password_hash: TEST_PASSWORD_HASH }] }) // user lookup
      .mockResolvedValueOnce({ rows: [{ attempts: '0' }] }) // lockout check
      .mockResolvedValueOnce({ rows: [] }) // INSERT audit_logs (LOGIN)
    ;

    const req = mockReq({
      method: 'POST',
      body: { identifier: 'test@test.com', password: TEST_PASSWORD },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('retorna 200 com token ao logar por username', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: TEST_USER_ID, email: 'test@test.com', password_hash: TEST_PASSWORD_HASH }] }) // user lookup by username
      .mockResolvedValueOnce({ rows: [{ attempts: '0' }] }) // lockout check
      .mockResolvedValueOnce({ rows: [] }) // INSERT audit_logs (LOGIN)
    ;

    const req = mockReq({
      method: 'POST',
      body: { identifier: 'joaosilva', password: TEST_PASSWORD },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('retorna 429 quando conta esta bloqueada (10+ tentativas falhas)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: TEST_USER_ID, email: 'test@test.com', password_hash: TEST_PASSWORD_HASH }] }) // user lookup
      .mockResolvedValueOnce({ rows: [{ attempts: '10' }] }) // lockout check — 10 failed attempts
    ;

    const req = mockReq({
      method: 'POST',
      body: { identifier: 'test@test.com', password: TEST_PASSWORD },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toContain('bloqueada');
  });
});

// --- session.js (logout) ---

describe('POST /api/auth/logout', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/auth/session.js');
    handler = mod.default;
  });

  it('retorna 401 sem token de autenticacao', async () => {
    const req = mockReq({ method: 'POST', url: '/?action=logout' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('retorna 200 ao fazer logout com sucesso', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT audit_logs

    const req = mockReq({ method: 'POST', token: TEST_TOKEN, url: '/?action=logout' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Logout');
  });

  it('retorna 405 para metodo GET', async () => {
    const req = mockReq({ method: 'GET', token: TEST_TOKEN, url: '/?action=logout' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

// --- check-username.js ---

describe('POST /api/auth/check-username', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/auth/check-username.js');
    handler = mod.default;
  });

  it('retorna 200 com available=true quando username nao existe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no user found

    const req = mockReq({
      method: 'POST',
      body: { username: 'novousuario' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.available).toBe(true);
  });

  it('retorna 200 com available=false quando username ja existe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: TEST_USER_ID }] }); // user found

    const req = mockReq({
      method: 'POST',
      body: { username: 'existente' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('retorna 400 para username invalido (muito curto)', async () => {
    const req = mockReq({
      method: 'POST',
      body: { username: 'ab' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Usuario invalido');
  });

  it('retorna 400 para username com caracteres especiais', async () => {
    const req = mockReq({
      method: 'POST',
      body: { username: 'user@name!' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
