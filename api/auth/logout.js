import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  try {
    await db.query(
      'INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)',
      [req.user.id, 'LOGOUT']
    );
  } catch (err) {
    // Non-critical — don't fail logout if audit log fails
  }
  console.log(JSON.stringify({ action: 'LOGOUT', userId: req.user.id }));
  return res.status(200).json({ success: true, message: 'Logout realizado com sucesso' });
}

export default withSecurityHeaders(methodGuard(['POST'], requireAuth(handler)));
