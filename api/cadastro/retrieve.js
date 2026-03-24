import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { verifyPassword } from '../../lib/auth.js';
import { decryptData } from '../../lib/crypto.js';
import { validate, retrieveCadastroSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const validation = validate(retrieveCadastroSchema, req.body);
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
    `SELECT data_encrypted_blob, data_iv, data_salt, data_auth_tag
     FROM documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId]
  );

  if (docResult.rows.length === 0) {
    return res.status(404).json({ error: 'Documento nao encontrado' });
  }

  const doc = docResult.rows[0];

  if (!doc.data_encrypted_blob) {
    return res.status(422).json({
      error: 'Dados cadastrais nao disponiveis para este documento. Gere um novo documento para habilitar edicao.',
      code: 'LEGACY_DOCUMENT',
    });
  }

  try {
    const dadosCadastro = await decryptData(
      doc.data_encrypted_blob, password, doc.data_salt, doc.data_iv, doc.data_auth_tag
    );

    await db.query(
      'INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)',
      [userId, 'RETRIEVE_CADASTRO']
    );

    res.setHeader('Cache-Control', 'no-store, private');
    return res.status(200).json({ success: true, dadosCadastro });
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao descriptografar dados cadastrais' });
  }
}

export default withSecurityHeaders(methodGuard(['POST'], requireAuth(withRateLimit(handler))));
