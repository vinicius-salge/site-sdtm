import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes } from '../helpers.js';
import { generateToken } from '../../lib/auth.js';
import { encryptPDF, encryptData } from '../../lib/crypto.js';

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
const NEW_PASSWORD = 'nova-senha-456';
let TEST_PASSWORD_HASH;
let TEST_TOKEN;

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_DOC_ID = '660e8400-e29b-41d4-a716-446655440001';

// Encrypted test fixtures
let TEST_ENCRYPTED_PDF;
let TEST_ENCRYPTED_DATA;

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
  if (!TEST_ENCRYPTED_PDF) {
    TEST_ENCRYPTED_PDF = await encryptPDF(Buffer.from('fake-pdf-content'), TEST_PASSWORD);
  }
  if (!TEST_ENCRYPTED_DATA) {
    TEST_ENCRYPTED_DATA = await encryptData({ nome: 'Joao Silva', cpf: '12345678901' }, TEST_PASSWORD);
  }
});

// --- profile.js ---

describe('GET /api/user/profile', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/user/profile.js');
    handler = mod.default;
  });

  it('retorna 401 sem token de autenticacao', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('retorna 200 com dados do usuario', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: TEST_USER_ID,
          username: 'joaosilva',
          email: 'joao@test.com',
          created_at: '2025-01-01T00:00:00Z',
        }],
      }) // user lookup
      .mockResolvedValueOnce({
        rows: [{
          id: TEST_DOC_ID,
          created_at: '2025-01-01T00:00:00Z',
          downloaded_at: null,
          version: 1,
          updated_at: null,
          has_cadastro_data: true,
        }],
      }) // documents lookup
    ;

    const req = mockReq({ method: 'GET', token: TEST_TOKEN });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.username).toBe('joaosilva');
    expect(res.body.email).toBe('joao@test.com');
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].id).toBe(TEST_DOC_ID);
    expect(res.body.documents[0].hasCadastroData).toBe(true);
  });

  it('retorna 405 para metodo POST', async () => {
    const req = mockReq({ method: 'POST', token: TEST_TOKEN });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

// --- change-password.js ---

describe('POST /api/user/change-password', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/user/change-password.js');
    handler = mod.default;
  });

  it('retorna 400 para body invalido', async () => {
    const req = mockReq({ method: 'POST', body: {}, token: TEST_TOKEN });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Dados invalidos');
  });

  it('retorna 400 quando nova senha e muito curta', async () => {
    const req = mockReq({
      method: 'POST',
      body: { currentPassword: TEST_PASSWORD, newPassword: 'abc' },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Dados invalidos');
  });

  it('retorna 401 para senha atual incorreta', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ password_hash: TEST_PASSWORD_HASH }],
    }); // user lookup

    const req = mockReq({
      method: 'POST',
      body: { currentPassword: 'senha-errada', newPassword: 'nova-senha-456' },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Senha atual incorreta');
  });

  it('retorna 200 ao alterar senha com sucesso (re-encripta documentos)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] }) // user lookup
      .mockResolvedValueOnce({
        rows: [{
          id: TEST_DOC_ID,
          encrypted_blob: TEST_ENCRYPTED_PDF.encryptedBlob,
          iv: TEST_ENCRYPTED_PDF.iv,
          salt: TEST_ENCRYPTED_PDF.salt,
          auth_tag: TEST_ENCRYPTED_PDF.authTag,
          data_encrypted_blob: TEST_ENCRYPTED_DATA.encryptedBlob,
          data_iv: TEST_ENCRYPTED_DATA.iv,
          data_salt: TEST_ENCRYPTED_DATA.salt,
          data_auth_tag: TEST_ENCRYPTED_DATA.authTag,
        }],
      }) // documents lookup
    ;
    mockClientQuery.mockResolvedValue({ rows: [] });

    const req = mockReq({
      method: 'POST',
      body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Senha alterada');

    // Verify transaction was used
    expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    expect(mockClientRelease).toHaveBeenCalled();

    // Verify password hash was updated
    const updateUserCall = mockClientQuery.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('UPDATE users SET password_hash')
    );
    expect(updateUserCall).toBeDefined();

    // Verify document was re-encrypted
    const updateDocCall = mockClientQuery.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('UPDATE documents SET encrypted_blob')
    );
    expect(updateDocCall).toBeDefined();
  });

  it('retorna 200 ao alterar senha com documento sem data_encrypted_blob', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] }) // user lookup
      .mockResolvedValueOnce({
        rows: [{
          id: TEST_DOC_ID,
          encrypted_blob: TEST_ENCRYPTED_PDF.encryptedBlob,
          iv: TEST_ENCRYPTED_PDF.iv,
          salt: TEST_ENCRYPTED_PDF.salt,
          auth_tag: TEST_ENCRYPTED_PDF.authTag,
          data_encrypted_blob: null,
          data_iv: null,
          data_salt: null,
          data_auth_tag: null,
        }],
      }) // documents lookup — legacy document (no cadastro data)
    ;
    mockClientQuery.mockResolvedValue({ rows: [] });

    const req = mockReq({
      method: 'POST',
      body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('retorna 401 sem token de autenticacao', async () => {
    const req = mockReq({
      method: 'POST',
      body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});

// --- delete-account.js ---

describe('DELETE /api/user/delete-account', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/user/delete-account.js');
    handler = mod.default;
  });

  it('retorna 400 sem senha no body', async () => {
    const req = mockReq({ method: 'DELETE', body: {}, token: TEST_TOKEN });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Senha obrigatoria');
  });

  it('retorna 401 para senha incorreta', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ password_hash: TEST_PASSWORD_HASH }],
    }); // user lookup

    const req = mockReq({
      method: 'DELETE',
      body: { password: 'senha-errada' },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Senha incorreta');
  });

  it('retorna 200 ao excluir conta com sucesso', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] }) // user lookup
      .mockResolvedValueOnce({ rows: [] }) // INSERT audit_logs
      .mockResolvedValueOnce({ rows: [] }) // DELETE FROM users
    ;

    const req = mockReq({
      method: 'DELETE',
      body: { password: TEST_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('excluidos permanentemente');
  });

  it('retorna 401 sem token de autenticacao', async () => {
    const req = mockReq({
      method: 'DELETE',
      body: { password: TEST_PASSWORD },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('retorna 405 para metodo GET', async () => {
    const req = mockReq({ method: 'GET', token: TEST_TOKEN });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
