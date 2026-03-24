import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { hashPassword, generateToken } from '../../lib/auth.js';
import { encryptPDF, encryptData, generateHash, secureWipe } from '../../lib/crypto.js';
import { generateFichaCadastral } from '../../lib/pdf-generator.js';
import { validate, registerSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const validation = validate(registerSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Dados invalidos', details: validation.errors });
  }

  const { username, email, password, cpf, numeroInscricao, dadosCadastro } = validation.data;
  const cpfHash = generateHash(cpf);

  let pdfBuffer = null;
  try {
    pdfBuffer = await generateFichaCadastral(dadosCadastro);
    const passwordHash = await hashPassword(password);
    const encrypted = await encryptPDF(pdfBuffer, password);
    const encryptedCadastro = await encryptData(dadosCadastro, password);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash, cpf_hash, numero_inscricao)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [username, email, passwordHash, cpfHash, numeroInscricao || null]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        const conflictField = await detectConflict(client, username, email, cpfHash, numeroInscricao);
        return res.status(409).json({ error: conflictField });
      }

      const userId = userResult.rows[0].id;

      await client.query(
        `INSERT INTO documents (user_id, encrypted_blob, iv, salt, auth_tag, data_encrypted_blob, data_iv, data_salt, data_auth_tag)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, encrypted.encryptedBlob, encrypted.iv, encrypted.salt, encrypted.authTag,
         encryptedCadastro.encryptedBlob, encryptedCadastro.iv, encryptedCadastro.salt, encryptedCadastro.authTag]
      );

      await client.query(
        'INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)',
        [userId, 'REGISTER']
      );

      await client.query('COMMIT');

      const token = generateToken({ sub: userId, email });

      console.log(JSON.stringify({ action: 'REGISTER', userId }));
      return res.status(201).json({ success: true, token });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        const conflictField = await detectConflict(client, username, email, cpfHash, numeroInscricao);
        return res.status(409).json({ error: conflictField });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(JSON.stringify({ action: 'REGISTER', error: err.message }));
    return res.status(500).json({ error: 'Erro interno ao registrar usuario' });
  } finally {
    if (pdfBuffer) secureWipe(pdfBuffer);
  }
}

async function detectConflict(client, username, email, cpfHash, numeroInscricao) {
  const checks = [
    { query: 'SELECT 1 FROM users WHERE email = $1', params: [email], msg: 'Email ja cadastrado' },
    { query: 'SELECT 1 FROM users WHERE username = $1', params: [username], msg: 'Usuario ja esta em uso' },
    { query: 'SELECT 1 FROM users WHERE cpf_hash = $1', params: [cpfHash], msg: 'CPF ja cadastrado' },
  ];
  if (numeroInscricao) {
    checks.push({ query: 'SELECT 1 FROM users WHERE numero_inscricao = $1', params: [numeroInscricao], msg: 'Numero de inscricao ja utilizado' });
  }
  for (const check of checks) {
    const result = await client.query(check.query, check.params);
    if (result.rows.length > 0) return check.msg;
  }
  return 'Dados ja cadastrados';
}

export default withSecurityHeaders(methodGuard(['POST'], withRateLimit(handler)));
