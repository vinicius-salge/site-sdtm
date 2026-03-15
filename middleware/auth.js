import { verifyToken, extractToken } from '../lib/auth.js';

export function requireAuth(handler) {
  return async (req, res) => {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Token de autenticacao ausente' });
    }

    try {
      const decoded = verifyToken(token);
      req.user = { id: decoded.sub, email: decoded.email };
      return handler(req, res);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      return res.status(401).json({ error: 'Token invalido' });
    }
  };
}
