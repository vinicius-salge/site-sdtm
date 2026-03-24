import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes as _mockRes } from '../helpers.js';
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

// Extend mockRes to include send() (used by download.js)
function mockRes() {
  const res = _mockRes();
  res.send = (data) => { res.body = data; return res; };
  return res;
}

// Passwords for testing
const TEST_PASSWORD = 'senha-test-123';
let TEST_PASSWORD_HASH;
let TEST_TOKEN;

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_DOC_ID = '660e8400-e29b-41d4-a716-446655440001';

// Encrypted test fixtures
let TEST_ENCRYPTED_PDF;

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
});

// --- download.js ---

describe('POST /api/pdf/download', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/pdf/download.js');
    handler = mod.default;
  });

  it('retorna 400 para body invalido (sem documentId)', async () => {
    const req = mockReq({ method: 'POST', body: {}, token: TEST_TOKEN });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Dados invalidos');
  });

  it('retorna 400 para documentId invalido (nao UUID)', async () => {
    const req = mockReq({
      method: 'POST',
      body: { documentId: 'not-a-uuid', password: TEST_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('retorna 401 para senha incorreta', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ password_hash: TEST_PASSWORD_HASH }],
    }); // user lookup

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
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] }) // user lookup
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

  it('retorna 200 com conteudo PDF descriptografado', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: TEST_PASSWORD_HASH }] }) // user lookup
      .mockResolvedValueOnce({
        rows: [{
          encrypted_blob: TEST_ENCRYPTED_PDF.encryptedBlob,
          iv: TEST_ENCRYPTED_PDF.iv,
          salt: TEST_ENCRYPTED_PDF.salt,
          auth_tag: TEST_ENCRYPTED_PDF.authTag,
        }],
      }) // document found
      .mockResolvedValueOnce({ rows: [] }) // UPDATE downloaded_at
      .mockResolvedValueOnce({ rows: [] }) // INSERT audit_logs
    ;

    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    // Note: secureWipe zeros the buffer after send, so we can't check content
    // in mock tests. We verify the response was sent with correct headers.
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Cache-Control']).toBe('no-store, private');
  });

  it('retorna 401 sem token de autenticacao', async () => {
    const req = mockReq({
      method: 'POST',
      body: { documentId: TEST_DOC_ID, password: TEST_PASSWORD },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});

// --- generate.js ---

describe('POST /api/pdf/generate', () => {
  let handler;

  beforeEach(async () => {
    const mod = await import('../../api/pdf/generate.js');
    handler = mod.default;
  });

  it('retorna 400 para body invalido', async () => {
    const req = mockReq({ method: 'POST', body: {}, token: TEST_TOKEN });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Dados invalidos');
  });

  it('retorna 400 quando dadosCadastro esta ausente', async () => {
    const req = mockReq({
      method: 'POST',
      body: { password: TEST_PASSWORD },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('retorna 401 para senha incorreta', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ password_hash: TEST_PASSWORD_HASH }],
    }); // user lookup

    const req = mockReq({
      method: 'POST',
      body: {
        password: 'senha-errada',
        dadosCadastro: { nome: 'Joao Silva' },
      },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Senha incorreta');
  });

  it('retorna 201 ao gerar PDF com sucesso', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ password_hash: TEST_PASSWORD_HASH }],
    }); // user lookup
    mockClientQuery.mockResolvedValue({ rows: [] });

    const req = mockReq({
      method: 'POST',
      body: {
        password: TEST_PASSWORD,
        dadosCadastro: { nome: 'Joao Silva' },
      },
      token: TEST_TOKEN,
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('PDF gerado');

    // Verify transaction was used
    expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
    expect(mockClientRelease).toHaveBeenCalled();

    // Verify old documents were deleted and new one inserted
    const deleteCall = mockClientQuery.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('DELETE FROM documents')
    );
    expect(deleteCall).toBeDefined();

    const insertCall = mockClientQuery.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO documents')
    );
    expect(insertCall).toBeDefined();
  });

  it('retorna 401 sem token de autenticacao', async () => {
    const req = mockReq({
      method: 'POST',
      body: {
        password: TEST_PASSWORD,
        dadosCadastro: { nome: 'Joao Silva' },
      },
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
