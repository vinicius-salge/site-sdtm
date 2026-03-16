import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { validate, checkUsernameSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const validation = validate(checkUsernameSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Usuario invalido', details: validation.errors });
  }

  const { username } = validation.data;

  const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
  const available = existing.rows.length === 0;

  return res.status(200).json({ available });
}

export default withSecurityHeaders(methodGuard(['POST'], withRateLimit(handler)));
