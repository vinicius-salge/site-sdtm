import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { decryptPDF, secureWipe } from '../../lib/crypto.js';
import { verifyPassword } from '../../lib/auth.js';
import { validate, downloadSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const validation = validate(downloadSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Dados invalidos', details: validation.errors });
  }

  const { documentId, password } = validation.data;
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

  const docResult = await db.query(
    `SELECT encrypted_blob, iv, salt, auth_tag
     FROM documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId]
  );

  if (docResult.rows.length === 0) {
    return res.status(404).json({ error: 'Documento nao encontrado' });
  }

  const doc = docResult.rows[0];
  let decryptedPdf = null;

  try {
    decryptedPdf = await decryptPDF(
      doc.encrypted_blob,
      password,
      doc.salt,
      doc.iv,
      doc.auth_tag
    );

    await db.query(
      'UPDATE documents SET downloaded_at = NOW() WHERE id = $1',
      [documentId]
    );

    await db.query(
      `INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)`,
      [userId, 'DOWNLOAD']
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ficha-sdtm-${documentId}.pdf"`);
    res.setHeader('Content-Length', decryptedPdf.length);
    res.setHeader('Cache-Control', 'no-store, private');

    console.log('PDF downloaded by user:', userId);
    return res.status(200).send(decryptedPdf);
  } catch (err) {
    console.error('Decryption failed for doc:', documentId);
    return res.status(500).json({ error: 'Falha ao descriptografar documento' });
  } finally {
    if (decryptedPdf) secureWipe(decryptedPdf);
  }
}

export default withSecurityHeaders(methodGuard(['POST'], requireAuth(withRateLimit(handler))));
