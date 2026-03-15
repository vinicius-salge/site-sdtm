import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { requireAuth } from '../../middleware/auth.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const userId = req.user.id;

  const result = await db.query(
    'SELECT id, email, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Usuario nao encontrado' });
  }

  const user = result.rows[0];

  const docsResult = await db.query(
    `SELECT id, created_at, downloaded_at
     FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return res.status(200).json({
    email: user.email,
    createdAt: user.created_at,
    documents: docsResult.rows.map(d => ({
      id: d.id,
      createdAt: d.created_at,
      lastDownload: d.downloaded_at,
    })),
  });
}

export default withSecurityHeaders(methodGuard(['GET'], requireAuth(handler)));
