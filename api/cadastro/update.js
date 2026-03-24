import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { verifyPassword } from '../../lib/auth.js';
import { encryptPDF, encryptData, decryptData, secureWipe } from '../../lib/crypto.js';
import { generateFichaCadastral } from '../../lib/pdf-generator.js';
import { validate, updateCadastroSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const validation = validate(updateCadastroSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Dados invalidos', details: validation.errors });
  }

  const { documentId, password, dadosCadastro } = validation.data;
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
    `SELECT id, data_encrypted_blob, data_iv, data_salt, data_auth_tag
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

  let pdfBuffer = null;
  try {
    const originalData = await decryptData(
      doc.data_encrypted_blob, password, doc.data_salt, doc.data_iv, doc.data_auth_tag
    );

    dadosCadastro.cpf = originalData.cpf;
    dadosCadastro.numeroInscricao = originalData.numeroInscricao;

    pdfBuffer = await generateFichaCadastral(dadosCadastro);
    const encrypted = await encryptPDF(pdfBuffer, password);
    const encryptedCadastro = await encryptData(dadosCadastro, password);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE documents
         SET encrypted_blob = $1, iv = $2, salt = $3, auth_tag = $4,
             data_encrypted_blob = $5, data_iv = $6, data_salt = $7, data_auth_tag = $8,
             version = COALESCE(version, 1) + 1, updated_at = NOW()
         WHERE id = $9 AND user_id = $10`,
        [encrypted.encryptedBlob, encrypted.iv, encrypted.salt, encrypted.authTag,
         encryptedCadastro.encryptedBlob, encryptedCadastro.iv, encryptedCadastro.salt, encryptedCadastro.authTag,
         documentId, userId]
      );

      await client.query(
        'INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)',
        [userId, 'UPDATE_CADASTRO']
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    console.log('Cadastro updated for user:', userId);
    return res.status(200).json({ success: true, message: 'Dados atualizados e PDF regenerado com sucesso' });
  } catch (err) {
    console.error('Cadastro update failed for user:', userId);
    return res.status(500).json({ error: 'Falha ao atualizar dados cadastrais' });
  } finally {
    if (pdfBuffer) secureWipe(pdfBuffer);
  }
}

export default withSecurityHeaders(methodGuard(['POST'], requireAuth(withRateLimit(handler))));
