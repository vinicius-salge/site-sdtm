import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { hashPassword, generateToken } from '../../lib/auth.js';
import { encryptPDF, generateHash, secureWipe } from '../../lib/crypto.js';
import { generateFichaCadastral } from '../../lib/pdf-generator.js';
import { validate, registerSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const validation = validate(registerSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Dados invalidos', details: validation.errors });
  }

  const { email, password, cpf, dadosCadastro } = validation.data;

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

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, cpf_hash) VALUES ($1, $2, $3) RETURNING id',
        [email, passwordHash, cpfHash]
      );
      const userId = userResult.rows[0].id;

      await client.query(
        `INSERT INTO documents (user_id, encrypted_blob, iv, salt, auth_tag)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, encrypted.encryptedBlob, encrypted.iv, encrypted.salt, encrypted.authTag]
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
