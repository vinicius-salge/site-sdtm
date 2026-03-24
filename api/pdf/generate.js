import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { encryptPDF, encryptData, secureWipe } from '../../lib/crypto.js';
import { verifyPassword } from '../../lib/auth.js';
import { generateFichaCadastral } from '../../lib/pdf-generator.js';
import { validate, generatePdfSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const validation = validate(generatePdfSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Dados invalidos', details: validation.errors });
  }

  const { password, dadosCadastro } = validation.data;
  const userId = req.user.id;

  const userResult = await db.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'Usuario nao encontrado' });
  }

  const passwordValid = await verifyPassword(password, userResult.rows[0].password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  let pdfBuffer = null;
  const client = await db.getClient();
  try {
    pdfBuffer = await generateFichaCadastral(dadosCadastro);
    const encrypted = await encryptPDF(pdfBuffer, password);
    const encryptedCadastro = await encryptData(dadosCadastro, password);

    await client.query('BEGIN');

    await client.query('DELETE FROM documents WHERE user_id = $1', [userId]);

    await client.query(
      `INSERT INTO documents (user_id, encrypted_blob, iv, salt, auth_tag, data_encrypted_blob, data_iv, data_salt, data_auth_tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, encrypted.encryptedBlob, encrypted.iv, encrypted.salt, encrypted.authTag,
       encryptedCadastro.encryptedBlob, encryptedCadastro.iv, encryptedCadastro.salt, encryptedCadastro.authTag]
    );

    await client.query(
      `INSERT INTO audit_logs (user_id, action) VALUES ($1, 'GENERATE_PDF')`,
      [userId]
    );

    await client.query('COMMIT');

    console.log(JSON.stringify({ action: 'GENERATE_PDF', userId }));
    return res.status(201).json({ success: true, message: 'PDF gerado e armazenado com sucesso' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    if (pdfBuffer) secureWipe(pdfBuffer);
  }
}

export default withSecurityHeaders(methodGuard(['POST'], requireAuth(withRateLimit(handler))));
