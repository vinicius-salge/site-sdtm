import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';
import { verifyPassword } from '../../lib/auth.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ error: 'Senha obrigatoria para confirmar exclusao' });
  }

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

  await db.query('DELETE FROM users WHERE id = $1', [userId]);

  console.log('Account deleted (LGPD):', userId);
  return res.status(200).json({
    success: true,
    message: 'Conta e todos os dados associados foram excluidos permanentemente',
  });
}

export default withSecurityHeaders(methodGuard(['DELETE'], requireAuth(handler)));
