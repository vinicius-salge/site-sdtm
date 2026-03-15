import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';
import { encryptPDF, secureWipe } from '../../lib/crypto.js';
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
  try {
    pdfBuffer = await generateFichaCadastral(dadosCadastro);
    const encrypted = await encryptPDF(pdfBuffer, password);

    await db.query(
      `INSERT INTO documents (user_id, encrypted_blob, iv, salt, auth_tag)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, encrypted.encryptedBlob, encrypted.iv, encrypted.salt, encrypted.authTag]
    );

    console.log('PDF generated for user:', userId);
    return res.status(201).json({ success: true, message: 'PDF gerado e armazenado com sucesso' });
  } finally {
    if (pdfBuffer) secureWipe(pdfBuffer);
  }
}

export default withSecurityHeaders(methodGuard(['POST'], requireAuth(handler)));
