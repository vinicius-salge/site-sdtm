import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { verifyPassword, generateToken } from '../../lib/auth.js';
import { validate, loginSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  const validation = validate(loginSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Dados invalidos', details: validation.errors });
  }

  const { email, password } = validation.data;

  const result = await db.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Credenciais invalidas' });
  }

  const user = result.rows[0];
  const passwordValid = await verifyPassword(password, user.password_hash);

  if (!passwordValid) {
    return res.status(401).json({ error: 'Credenciais invalidas' });
  }

  const token = generateToken({ sub: user.id, email: user.email });

  await db.query(
    `INSERT INTO audit_logs (user_id, action, ip_hash)
     VALUES ($1, $2, $3)`,
    [user.id, 'LOGIN', req.headers['x-forwarded-for'] ? 'hashed' : null]
  );

  console.log('User logged in:', user.id);
  return res.status(200).json({ success: true, token });
}

export default withSecurityHeaders(methodGuard(['POST'], withRateLimit(handler)));
