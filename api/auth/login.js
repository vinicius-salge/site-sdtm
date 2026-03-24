import { withSecurityHeaders, methodGuard } from '../../middleware/security-headers.js';
import { withRateLimit } from '../../middleware/rate-limit.js';
import { verifyPassword, generateToken } from '../../lib/auth.js';
import { validate, loginSchema } from '../../lib/validators.js';
import db from '../../lib/db.js';

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 30;

async function handler(req, res) {
  const validation = validate(loginSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: 'Dados invalidos', details: validation.errors });
  }

  const { identifier, password } = validation.data;

  try {
    const isEmail = identifier.includes('@');
    const result = await db.query(
      isEmail
        ? 'SELECT id, email, password_hash FROM users WHERE email = $1'
        : 'SELECT id, email, password_hash FROM users WHERE username = $1',
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const user = result.rows[0];

    const lockoutCheck = await db.query(
      `SELECT COUNT(*) as attempts FROM audit_logs
       WHERE user_id = $1 AND action = 'LOGIN_FAILED'
       AND created_at > NOW() - INTERVAL '${LOCKOUT_MINUTES} minutes'`,
      [user.id]
    );

    if (parseInt(lockoutCheck.rows[0].attempts) >= MAX_FAILED_ATTEMPTS) {
      console.log(JSON.stringify({ action: 'LOGIN_LOCKED', userId: user.id }));
      return res.status(429).json({
        error: `Conta temporariamente bloqueada. Tente novamente em ${LOCKOUT_MINUTES} minutos.`,
      });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      await db.query(
        'INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)',
        [user.id, 'LOGIN_FAILED']
      );
      console.log(JSON.stringify({ action: 'LOGIN_FAILED', userId: user.id }));
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const token = generateToken({ sub: user.id, email: user.email });

    await db.query(
      'INSERT INTO audit_logs (user_id, action) VALUES ($1, $2)',
      [user.id, 'LOGIN']
    );

    console.log(JSON.stringify({ action: 'LOGIN', userId: user.id }));
    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error(JSON.stringify({ action: 'LOGIN', error: err.message }));
    return res.status(500).json({ error: 'Erro interno ao autenticar' });
  }
}

export default withSecurityHeaders(methodGuard(['POST'], withRateLimit(handler)));
