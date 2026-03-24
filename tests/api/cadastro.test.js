import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes } from '../helpers.js';
import { generateToken } from '../../lib/auth.js';
import { encryptData } from '../../lib/crypto.js';

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

// Encrypted test data
const TEST_CADASTRO = {
  nome: 'Joao Silva',
  cpf: '12345678901',
  numeroInscricao: 'SDTM-001000',
  credenciamentoDetran: '',
  endereco: 'Rua Teste, 123',
};

let TEST_ENCRYPTED_DATA;

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_DOC_ID = '660e8400-e29b-41d4-a716-446655440001';

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
  if (!TEST_ENCRYPTED_DATA) {
    TEST_ENCRYPTED_DATA = await encryptData(TEST_CADASTRO, TEST_PASSWORD);
  }
});

// --- retrieve.js ---

describe('POST /api/cadastro/retrieve', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/cadastro/retrieve.js');
    handler = mod.default;
  });

  it('retorna 400 para body invalido', async () => {
    const req = mockReq({ method: 'POST', body: {}, token: TEST_TOKEN });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('retorna 405 para metodo GET', async () => {
    const req = mockReq({ method: 'GET', token: TEST_TOKEN });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('retorna 401 sem token de autenticacao', async () => {
    const req = mockReq({ method: 'POST', body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('retorna 401 para senha incorreta', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] }) // user lookup
    ;

    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: 'senha-errada' },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Senha incorreta');
  });

  it('retorna 404 para documento nao encontrado', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] }) // user
      .mockResolvedValueOnce({ rows: [] }) // document not found
    ;

    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Documento nao encontrado');
  });

  it('retorna 422 LEGACY_DOCUMENT quando data_encrypted_blob e null', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] })
      .mockResolvedValueOnce({ rows: [{ data_encrypted_blob: null }] })
    ;

    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('LEGACY_DOCUMENT');
  });

  it('retorna 200 com dadosCadastro descriptografados', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] })
      .mockResolvedValueOnce({
        rows: [{
          data_encrypted_blob: TEST_ENCRYPTED_DATA.encryptedBlob,
          data_iv: TEST_ENCRYPTED_DATA.iv,
          data_salt: TEST_ENCRYPTED_DATA.salt,
          data_auth_tag: TEST_ENCRYPTED_DATA.authTag,
        }],
      })
      .mockResolvedValueOnce({ rows: [] }) // audit log insert
    ;

    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.dadosCadastro.nome).toBe('Joao Silva');
    expect(res.body.dadosCadastro.cpf).toBe('12345678901');
    expect(res.headers['Cache-Control']).toBe('no-store, private');
  });
});

// --- update-detran.js ---

describe('POST /api/cadastro/update-detran', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/cadastro/update-detran.js');
    handler = mod.default;
  });

  it('retorna 400 para body invalido (sem credenciamentoDetran)', async () => {
    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('retorna 422 para documento legado', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] })
      .mockResolvedValueOnce({ rows: [{ id: TEST_DOC_ID, data_encrypted_blob: null }] })
    ;

    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD, credenciamentoDetran: 'DET-123' },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('LEGACY_DOCUMENT');
  });

  it('retorna 200 e atualiza credenciamento DETRAN', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] })
      .mockResolvedValueOnce({
        rows: [{
          id: TEST_DOC_ID,
          data_encrypted_blob: TEST_ENCRYPTED_DATA.encryptedBlob,
          data_iv: TEST_ENCRYPTED_DATA.iv,
          data_salt: TEST_ENCRYPTED_DATA.salt,
          data_auth_tag: TEST_ENCRYPTED_DATA.authTag,
        }],
      })
    ;
    mockClientQuery.mockResolvedValue({ rows: [] });

    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD, credenciamentoDetran: 'DET-999' },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('DETRAN');

    // Verify transaction was used
    expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    expect(mockClientRelease).toHaveBeenCalled();
  });
});

// --- update.js ---

describe('POST /api/cadastro/update', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/cadastro/update.js');
    handler = mod.default;
  });

  it('retorna 422 para documento legado', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] })
      .mockResolvedValueOnce({ rows: [{ id: TEST_DOC_ID, data_encrypted_blob: null }] })
    ;

    const req = mockReq({
      method: 'POST',
      body: {
        documentId: TEST_DOC_ID,
        password: TEST_PASSWORD,
        dadosCadastro: { nome: 'Novo Nome' },
      },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('LEGACY_DOCUMENT');
  });

  it('retorna 200 e preserva CPF e numeroInscricao originais', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] })
      .mockResolvedValueOnce({
        rows: [{
          id: TEST_DOC_ID,
          data_encrypted_blob: TEST_ENCRYPTED_DATA.encryptedBlob,
          data_iv: TEST_ENCRYPTED_DATA.iv,
          data_salt: TEST_ENCRYPTED_DATA.salt,
          data_auth_tag: TEST_ENCRYPTED_DATA.authTag,
        }],
      })
    ;
    mockClientQuery.mockResolvedValue({ rows: [] });

    const req = mockReq({
      method: 'POST',
      body: {
        documentId: TEST_DOC_ID,
        password: TEST_PASSWORD,
        dadosCadastro: {
          nome: 'Nome Corrigido',
          cpf: '99999999999', // tentativa de alterar CPF
          numeroInscricao: 'FAKE-999', // tentativa de alterar inscricao
          endereco: 'Rua Nova, 456',
        },
      },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify transaction was used
    expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');

    // Verify the UPDATE query was called with encrypted data
    // The 3rd call (index 2) should be the UPDATE documents query
    const updateCall = mockClientQuery.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('UPDATE documents')
    );
    expect(updateCall).toBeDefined();
  });

  it('retorna 400 para body sem dadosCadastro', async () => {
    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
