import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { verifyPassword, hashPassword } from '../../lib/auth.js';
import { decryptPDF, encryptPDF, decryptData, encryptData, secureWipe } from '../../lib/crypto.js';
import { validate, changePasswordSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const validation = validate(changePasswordSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Dados invalidos', details: validation.errors });
  }

  const { currentPassword, newPassword } = validation.data;
  const userId = req.user.id;

  const userResult = await db.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'Usuario nao encontrado' });
  }

  const passwordValid = await verifyPassword(currentPassword, userResult.rows[0].password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }

  const docs = await db.query(
    'SELECT id, encrypted_blob, iv, salt, auth_tag, data_encrypted_blob, data_iv, data_salt, data_auth_tag FROM documents WHERE user_id = $1',
    [userId]
  );

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const newPasswordHash = await hashPassword(newPassword);
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    for (const doc of docs.rows) {
      let decrypted = null;
      try {
        decrypted = await decryptPDF(doc.encrypted_blob, currentPassword, doc.salt, doc.iv, doc.auth_tag);
        const reEncrypted = await encryptPDF(decrypted, newPassword);

        if (doc.data_encrypted_blob) {
          const cadastroData = await decryptData(doc.data_encrypted_blob, currentPassword, doc.data_salt, doc.data_iv, doc.data_auth_tag);
          const reEncryptedData = await encryptData(cadastroData, newPassword);

          await client.query(
            `UPDATE documents SET encrypted_blob = $1, iv = $2, salt = $3, auth_tag = $4,
             data_encrypted_blob = $5, data_iv = $6, data_salt = $7, data_auth_tag = $8
             WHERE id = $9`,
            [reEncrypted.encryptedBlob, reEncrypted.iv, reEncrypted.salt, reEncrypted.authTag,
             reEncryptedData.encryptedBlob, reEncryptedData.iv, reEncryptedData.salt, reEncryptedData.authTag, doc.id]
          );
        } else {
          await client.query(
            `UPDATE documents SET encrypted_blob = $1, iv = $2, salt = $3, auth_tag = $4
             WHERE id = $5`,
            [reEncrypted.encryptedBlob, reEncrypted.iv, reEncrypted.salt, reEncrypted.authTag, doc.id]
          );
        }
      } finally {
        if (decrypted) secureWipe(decrypted);
      }
    }

    await client.query(
      `INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)`,
      [userId, 'CHANGE_PASSWORD']
    );

    await client.query('COMMIT');

    console.log('Password changed for user:', userId);
    return res.status(200).json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Password change failed for user:', userId);
    return res.status(500).json({ error: 'Falha ao alterar senha' });
  } finally {
    client.release();
  }
}

export default withSecurityHeaders(methodGuard(['POST'], requireAuth(withRateLimit(handler))));
