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

  // Verifica se o numero de inscricao ja foi utilizado
  if (numeroInscricao) {
    const existingInscricao = await db.query('SELECT id FROM users WHERE numero_inscricao = $1', [numeroInscricao]);
    if (existingInscricao.rows.length > 0) {
      return res.status(409).json({ error: 'Numero de inscricao ja utilizado' });
    }
  }

  const existingUsername = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existingUsername.rows.length > 0) {
    return res.status(409).json({ error: 'Usuario ja esta em uso' });
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email ja cadastrado' });
  }

  const cpfHash = generateHash(cpf);
  const existingCpf = await db.query('SELECT id FROM users WHERE cpf_hash = $1', [cpfHash]);
  if (existingCpf.rows.length > 0) {
    return res.status(409).json({ error: 'CPF ja cadastrado' });
  }

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
        'INSERT INTO users (username, email, password_hash, cpf_hash, numero_inscricao) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [username, email, passwordHash, cpfHash, numeroInscricao || null]
      );
      const userId = userResult.rows[0].id;

      await client.query(
        `INSERT INTO documents (user_id, encrypted_blob, iv, salt, auth_tag, data_encrypted_blob, data_iv, data_salt, data_auth_tag)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, encrypted.encryptedBlob, encrypted.iv, encrypted.salt, encrypted.authTag,
         encryptedCadastro.encryptedBlob, encryptedCadastro.iv, encryptedCadastro.salt, encryptedCadastro.authTag]
      );

      await client.query('COMMIT');

      const token = generateToken({ sub: userId, email });

      console.log('User registered:', userId);
      return res.status(201).json({ success: true, token });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    if (pdfBuffer) secureWipe(pdfBuffer);
  }
}

export default withSecurityHeaders(methodGuard(['POST'], withRateLimit(handler)));
